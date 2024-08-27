const axios = require('axios');
const EnvUtil = require('../utils/env');
const SubgraphState = require('../utils/state/subgraph');
const BottleneckLimiters = require('../utils/load/bottleneck-limiters');

class SubgraphStatusService {
  // If there is any fatal error with this deployment, return the reason message.
  // Underlying implementation is different depending on the subgraph provider.
  static async getFatalError(endpointIndex, subgraphName) {
    const endpointType = EnvUtil.getEndpointTypes()[endpointIndex];
    switch (endpointType) {
      case 'alchemy':
        const alchemyStatus = await this._getAlchemyStatus(endpointIndex, subgraphName);
        return alchemyStatus.data.data.indexingStatusForCurrentVersion.fatalError?.message;
      case 'graph':
        const graphStatus = await this._getGraphStatus(endpointIndex, subgraphName);
        return graphStatus.data.data.indexingStatuses[0].fatalError?.message;
      default:
        throw new Error(`Unrecognized endpoint type '${endpointType}'.`);
    }
  }

  // TODO: these need to use the bottleneck limiter
  static async _getAlchemyStatus(endpointIndex, subgraphName) {
    const statusUrl = EnvUtil.underlyingUrl(endpointIndex, subgraphName).replace('/api', '/status');
    const status = BottleneckLimiters.schedule(endpointIndex, async () => await axios.post(statusUrl));
    return status;
  }

  static async _getGraphStatus(endpointIndex, subgraphName) {
    const statusUrl = 'https://api.thegraph.com/index-node/graphql';
    const deploymentHash = SubgraphState.getEndpointDeployment(endpointIndex, subgraphName);
    if (!deploymentHash) {
      throw new Error(
        `Can't retrieve status for Graph Network subgraph '${subgraphName}': the deployment hash is unknown.`
      );
    }

    const status = BottleneckLimiters.schedule(
      endpointIndex,
      async () =>
        await axios.post(statusUrl, {
          operationName: 'SubgraphIndexingStatusFatalError',
          variables: {
            deploymentIds: [deploymentHash]
          },
          query:
            'query SubgraphIndexingStatusFatalError($deploymentIds: [String!]!) {\n  indexingStatuses(subgraphs: $deploymentIds) {\n    health\n    fatalError {\n      message\n      block {\n        number\n        hash\n        __typename\n      }\n      handler\n      __typename\n    }\n    __typename\n  }\n}'
        })
    );
    return status;
  }
}

module.exports = SubgraphStatusService;
