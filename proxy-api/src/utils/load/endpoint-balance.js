const EnvUtil = require('../env');
const SubgraphState = require('../state/subgraph');
const BottleneckLimiters = require('./bottleneck-limiters');

class EndpointBalanceUtil {
  /**
   * Chooses which endpoint to use for an outgoing request.
   * Strategy:
   * 1. If in blacklist or isBurstDepleted, avoid outright.
   *    If any pass this step, an endpoint is guaranteed to be chosen.
   * 2. If the subgraph has errors, is out of sync, or is not on the latest version,
   *    avoid unless some time has passed since last result
   * 3. If there are no options, re-consider whatever was removed in step (2)
   * 4. If there are still multiple to choose from:
   *  a. Ignore both (b) and (c) if >100% utilization for the endpoint they would choose.
   *  b. If an endpoint is most recent in history but not blacklist:
   *   i. If the query explicitly requests a particular block, query that endpoint again
   *      if its known indexed block >= the explicitly requested block.
   *  ii. Otherwise, query the endpoint again if its block >= the latest known
   *      indexed block for that subgraph.
   * iii. If (i) and (ii) were not satisfied, do not query the same endpoint again in the next attempt.
   *  c. If both have a result within the last second, prefer one having a later block
   *  d. Prefer according to utilization
   * @param {string} subgraphName
   * @param {number[]} blacklist - none of these endpoints should be returned.
   * @param {number[]} history - sequence of endpoints which have been chosen and queried to serve this request.
   *    This is useful in balancing queries when one subgraph falls behind but not out of sync.
   * @param {number} requiredBlock - highest block number that was explicitly requested in the query.
   * @returns {number} the endpoint index that should be used for the next query.
   *    If no endpoints are suitable for a reqeuest, returns -1.
   */
  static async chooseEndpoint(subgraphName, blacklist = [], history = [], requiredBlock = null) {
    const subgraphEndpoints = EnvUtil.endpointsForSubgraph(subgraphName);
    let options = [];
    // Remove blacklisted/overutilized endpoints
    for (const endpointIndex of subgraphEndpoints) {
      if (!(await BottleneckLimiters.isBurstDepleted(endpointIndex)) && !blacklist.includes(endpointIndex)) {
        options.push(endpointIndex);
      }
    }

    if (options.length === 0) {
      return -1;
    } else if (options.length === 1) {
      return options[0];
    }

    // If possible, avoid known troublesome endpoints
    const troublesomeEndpoints = this._getTroublesomeEndpoints(options, subgraphName);
    if (options.length !== troublesomeEndpoints.length) {
      options = options.filter((endpoint) => !troublesomeEndpoints.includes(endpoint));
    }

    if (options.length > 1) {
      const currentUtilization = await this.getSubgraphUtilization(subgraphName);
      const latestIndexedBlock = SubgraphState.getLatestBlock(subgraphName);
      const sortLogic = (a, b) => {
        const isLastHistory = (a) => history[history.length - 1] === a;
        const isOverutilized = (a) => currentUtilization[a] >= 1;
        const canRetryLast = (a) => {
          const minimalBlock = requiredBlock ?? latestIndexedBlock;
          return SubgraphState.getEndpointBlock(a) >= minimalBlock && !isOverutilized(a);
        };
        // Retry previous request to the same endpoint if it didnt fail previously and is fully indexed
        if (isLastHistory(a)) {
          if (canRetryLast(a)) {
            return -1;
          } else if (!isOverutilized(b)) {
            return 1;
          }
        } else if (isLastHistory(b)) {
          if (canRetryLast(b)) {
            return 1;
          } else if (!isOverutilized(a)) {
            return -1;
          }
        }

        // Use endpoint with later results if neither results are stale
        const lastA = SubgraphState.getLastEndpointUsageTimestamp(a, subgraphName);
        const lastB = SubgraphState.getLastEndpointUsageTimestamp(b, subgraphName);
        if (Math.abs(lastA - lastB) < 1000) {
          const useLaterBlock = (a, b) => {
            return SubgraphState.getEndpointBlock(a) > SubgraphState.getEndpointBlock(b);
          };
          if (useLaterBlock(a, b) && !isOverutilized(a)) {
            return -1;
          } else if (useLaterBlock(b, a) && !isOverutilized(a)) {
            return 1;
          }
        }

        // Choose according to utilization
        if (
          currentUtilization[a] < EnvUtil.getEndpointUtilizationPreference()[a] &&
          currentUtilization[b] < EnvUtil.getEndpointUtilizationPreference()[b]
        ) {
          // Neither are exceeding the preference, use the preferred/lower index endpoint
          return a - b;
        }
        // At least one exceeds the preference, choose the lower of the two
        if (currentUtilization[a] !== currentUtilization[b]) {
          return currentUtilization[a] - currentUtilization[b];
        }
        return a - b;
      };
      options.sort(sortLogic);
    }
    return options[0];
  }

  // Returns the current utilization percentage for each endpoint underlying this subgraph
  static async getSubgraphUtilization(subgraphName) {
    const utilization = {};
    for (const endpointIndex of EnvUtil.endpointsForSubgraph(subgraphName)) {
      utilization[endpointIndex] = await BottleneckLimiters.getUtilization(endpointIndex);
    }
    return utilization;
  }

  // A "troublesome endpoint" is defined as an endpoint which is known in the last minute to: (1) have errors,
  // (2) be out of sync/singificantly behind in indexing, or (3) not running the latest subgraph version
  static _getTroublesomeEndpoints(endpointsIndices, subgraphName) {
    const now = new Date();
    const troublesomeEndpoints = [];
    for (const endpointIndex of endpointsIndices) {
      // Dont consider a subgraph troublesome if it hasnt been queried yet
      if (SubgraphState.getEndpointDeployment(endpointIndex, subgraphName)) {
        if (
          (SubgraphState.endpointHasErrors(endpointIndex, subgraphName) &&
            now - SubgraphState.getLastEndpointErrorTimestamp(endpointIndex, subgraphName) < 60 * 1000) ||
          (!SubgraphState.isInSync(endpointIndex, subgraphName) &&
            now - SubgraphState.getLastEndpointOutOfSyncTimestamp(endpointIndex, subgraphName) < 60 * 1000) ||
          (SubgraphState.isStaleVersion(endpointIndex, subgraphName) &&
            now - SubgraphState.getLastEndpointStaleVersionTimestamp(endpointIndex, subgraphName) < 60 * 1000)
        ) {
          troublesomeEndpoints.push(endpointIndex);
        }
      }
    }
    return troublesomeEndpoints;
  }
}

module.exports = EndpointBalanceUtil;
