const { ENDPOINTS } = require('./env');

// Add logic to support this:
// If alchemy is <90% utilized, the request should go there.
// Otherwise go to the graph
// If both are >90% utilized, pari passu

// In the case of a crash: if it can identify that the subgraph has crashed, it should not query it again for 5 minutes
// Something similar can be done if a stale deployment version is encountered

class LoadBalanceUtil {
  /**
   * Chooses which endpoint to use for an outgoing request. Prefers the latest version by default, and then
   * selects according to the .env utilization and rate limiting configuration.
   *
   * @param {number[]} blacklist - none of these endpoints should be returned
   * @returns {number} the endpoint index that should be used for the next query.
   *    If no endpoints are suitable for a reqeuest, returns -1.
   */
  static chooseEndpoint(blacklist) {
    if (blacklist.includes(0)) {
      return -1;
    }
    return 0;
  }

  static numEndpointsConfigured() {
    return ENDPOINTS.length;
  }
}

module.exports = LoadBalanceUtil;
