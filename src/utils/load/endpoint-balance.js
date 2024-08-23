// Add logic to support this:
// If alchemy is <90% utilized, the request should go there.
// Otherwise go to the graph
// If both are >90% utilized, pari passu

const { EnvUtil } = require('../env');
const BottleneckLimiters = require('./bottleneck-limiters');

// In the case of a crash: if it can identify that the subgraph has crashed, it should not query it again for 5 minutes
// Something similar can be done if a stale deployment version is encountered

class EndpointBalanceUtil {
  /**
   * Chooses which endpoint to use for an outgoing request.
   * @param {string} subgraphName
   * @param {number[]} blacklist - none of these endpoints should be returned.
   * @param {number[]} history - sequence of endpoints which have been chosen and queried to serve this request.
   *    This is useful in balancing queries when one subgraph falls behind but not out of sync.
   * @returns {number} the endpoint index that should be used for the next query.
   *    If no endpoints are suitable for a reqeuest, returns -1.
   */
  static chooseEndpoint(subgraphName, blacklist = [], history = []) {
    if (blacklist.includes(0)) {
      return -1;
    }
    return 0;

    // Strategy
    // 1. If in blacklist or isBurstDepleted, avoid outright
    // 2. If the subgraph has errors, is out of sync, or is not on the latest version,
    //    avoid unless some time has passed since last result
    // 3. If there are still multiple to choose from:
    //  a. do not prefer according to (b) or (c) if >100% utilization for the endpoint they would choose
    //  b. if an endpoint is in history but not blacklist, prefer that one again if its block >= the chain head
    //  c. if both have a result within the last second, prefer one having a later block
    //  d. prefer according to utilization
    // 4. If none could be selected, revisit step (3) with any that were removed in step (2)
  }

  // Returns the current utilization percentage for each endpoint underlying this subgraph
  static async getSubgraphUtilization(subgraphName) {
    const utilization = [];
    for (const endpointIndex of EnvUtil.endpointsForSubgraph(subgraphName)) {
      utilization.push(await BottleneckLimiters.getUtilization(endpointIndex));
    }
    return utilization;
  }
}

module.exports = EndpointBalanceUtil;
