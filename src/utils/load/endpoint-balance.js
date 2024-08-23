// Add logic to support this:
// If alchemy is <90% utilized, the request should go there.
// Otherwise go to the graph
// If both are >90% utilized, pari passu

const { EnvUtil } = require('../env');
const SubgraphState = require('../state/subgraph');
const BottleneckLimiters = require('./bottleneck-limiters');

// In the case of a crash: if it can identify that the subgraph has crashed, it should not query it again for 5 minutes
// Something similar can be done if a stale deployment version is encountered

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
   *  a. do not prefer according to (b) or (c) if >100% utilization for the endpoint they would choose
   *  b. if an endpoint is in history but not blacklist, prefer that one again if its block >= the chain head
   *  c. if both have a result within the last second, prefer one having a later block
   *  d. prefer according to utilization
   * @param {string} subgraphName
   * @param {number[]} blacklist - none of these endpoints should be returned.
   * @param {number[]} history - sequence of endpoints which have been chosen and queried to serve this request.
   *    This is useful in balancing queries when one subgraph falls behind but not out of sync.
   * @returns {number} the endpoint index that should be used for the next query.
   *    If no endpoints are suitable for a reqeuest, returns -1.
   */
  static async chooseEndpoint(subgraphName, blacklist = [], history = []) {
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

  static _getTroublesomeEndpoints(endpointsIndices, subgraphName) {
    const now = new Date();
    const troublesomeEndpoints = [];
    for (const endpointIndex of endpointsIndices) {
      if (
        now - SubgraphState.getLastEndpointErrorTimestamp(endpointIndex, subgraphName) < 60 * 1000 ||
        now - SubgraphState.getLastEndpointOutOfSyncTimestamp(endpointIndex, subgraphName) < 60 * 1000 ||
        now - SubgraphState.getLastEndpointStaleVersionTimestamp(endpointIndex, subgraphName) < 60 * 1000
      ) {
        troublesomeEndpoints.push(endpointIndex);
      }
    }
    return troublesomeEndpoints;
  }
}

module.exports = EndpointBalanceUtil;
