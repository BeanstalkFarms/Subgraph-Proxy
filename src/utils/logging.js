// TODO: standardize horizontal spacing so each section lines up vertically

const { EnvUtil } = require('./env');
const BottleneckLimiters = require('./load/bottleneck-limiters');

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
    const utilization = [];
    for (const i of EnvUtil.endpointsForSubgraph(subgraphName)) {
      utilization.push(`e-${i}:${((await BottleneckLimiters.getUtilization(i)) * 100).toFixed(0)}%`);
    }
    return utilization.join(',');
  }
}

module.exports = LoggingUtil;
