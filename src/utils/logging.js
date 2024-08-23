// TODO: standardize horizontal spacing so each section lines up vertically

const EndpointBalanceUtil = require('./load/endpoint-balance');

class LoggingUtil {
  static async logSuccessfulProxy(subgraphName, endpointIndex, startTime, requestHistory) {
    const utilizationString = await this.getUtilizationString(subgraphName);
    const rqHistoryString = requestHistory.join(',');
    console.log(
      `${new Date().toISOString()} [success]: ${subgraphName} to e-${endpointIndex} after ` +
        `${new Date() - startTime}ms | Steps: ${rqHistoryString} | Utilization: ${utilizationString}`
    );
  }

  static async logFailedProxy(subgraphName, startTime, requestHistory) {
    const utilizationString = await this.getUtilizationString(subgraphName);
    const rqHistoryString = requestHistory.join(',');
    console.log(
      `${new Date().toISOString()} <failure>: ${subgraphName} after ${new Date() - startTime}ms | ` +
        `Steps: ${rqHistoryString} | Utilization: ${utilizationString}`
    );
  }

  static async getUtilizationString(subgraphName) {
    let utilization = await EndpointBalanceUtil.getSubgraphUtilization(subgraphName);
    const strings = Object.keys(utilization).map((key) => `e-${key}:${(utilization[key] * 100).toFixed(0)}%`);
    return strings.join(',');
  }
}

module.exports = LoggingUtil;
