class LoggingUtil {
  static logSuccessfulProxy(subgraphName, endpointIndex, startTime, requestHistory) {
    const currentUtilization = '0.7,0.2'; // placeholder
    requestHistory = [0, 1, 2, 3];
    console.log(
      `${new Date().toISOString()} [success]: ${subgraphName} to e-${endpointIndex} after ` +
        `${new Date() - startTime}ms | Steps: ${requestHistory} | Utilization: ${currentUtilization}`
    );
  }

  static logFailedProxy(subgraphName, startTime, requestHistory) {
    const currentUtilization = '0.7,0.2'; // placeholder
    console.log(
      `${new Date().toISOString()} <failure>: ${subgraphName} after ${new Date() - startTime}ms | ` +
        `Steps: ${requestHistory} | Utilization: ${currentUtilization}`
    );
  }
}

module.exports = LoggingUtil;
