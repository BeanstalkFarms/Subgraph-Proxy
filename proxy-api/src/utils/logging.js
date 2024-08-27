const EndpointBalanceUtil = require('./load/endpoint-balance');

class LoggingUtil {
  // Used to determine how much whitespace should pad the start of the subgraph name
  static longestEncounteredName = 0;

  static async logSuccessfulProxy(subgraphName, endpointIndex, startTime, requestHistory) {
    console.log(await this._formatLog('[success]', subgraphName, startTime, requestHistory, endpointIndex));
  }

  static async logFailedProxy(subgraphName, startTime, requestHistory) {
    console.log(await this._formatLog('<failure>', subgraphName, startTime, requestHistory));
  }

  // Samples:
  // 2024-08-24T01:16:58.197Z [success]: beanstalk_proxy to e-0 after  156ms | Steps: 0 | Load: e-0:  0%, e-1:0%
  // 2024-08-24T01:16:50.403Z [success]: bean----------- to e-0 after  157ms | Steps: 0 | Load: e-0: 33%, e-1:0%
  // 2024-08-24T01:17:41.354Z <failure>: basin---------- ------ after  141ms | Steps: 0 | Load: e-0: 33%
  static async _formatLog(type, subgraphName, startTime, requestHistory, usedEndpoint = undefined) {
    if (subgraphName.length > this.longestEncounteredName) {
      this.longestEncounteredName = subgraphName.length;
    }
    const toEndpoint = usedEndpoint !== undefined ? `to e-${usedEndpoint} ` : ' ';

    const timeElapsed = `${new Date() - startTime}ms`.padStart(6);
    const subgraphAndTime =
      `${subgraphName.padEnd(this.longestEncounteredName, '-')} ${`${toEndpoint}after ${timeElapsed}`.padStart(19, '-')}`.padEnd(
        40
      );
    const steps = `Steps: ${requestHistory.join(',')}`.padEnd(20);
    const utilization = `Load: ${await this._getUtilizationString(subgraphName)}`;
    return `${new Date().toISOString()} ${type}: ${subgraphAndTime} | ${steps} | ${utilization}`;
  }

  static async _getUtilizationString(subgraphName) {
    let utilization = await EndpointBalanceUtil.getSubgraphUtilization(subgraphName);
    const strings = Object.keys(utilization).map(
      (key) => `e-${key}:${(utilization[key] * 100).toFixed(0).padStart(3)}%`
    );
    return strings.join(', ');
  }
}

module.exports = LoggingUtil;