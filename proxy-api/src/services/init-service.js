const SubgraphClients = require('../datasources/subgraph-clients');
const EnvUtil = require('../utils/env');
const GraphqlQueryUtil = require('../utils/graph-query');
const SubgraphState = require('../utils/state/subgraph');

class InitService {
  static async initAllSubgraphStates() {
    const promiseGenerators = [];
    for (const subgraphName of EnvUtil.getEnabledSubgraphs()) {
      for (const endpointIndex of EnvUtil.endpointsForSubgraph(subgraphName)) {
        promiseGenerators.push(async () => {
          try {
            const client = await SubgraphClients.makeCallableClient(endpointIndex, subgraphName);
            const metaAndVersion = await client(`{${GraphqlQueryUtil.METADATA_QUERY}}`);
            SubgraphState.updateStatesWithResult(endpointIndex, subgraphName, metaAndVersion);
            console.log(`Initialized e-${endpointIndex} for ${subgraphName}.`);
          } catch (e) {
            console.log(`Failed to initialize e-${endpointIndex} for ${subgraphName}.`);
            SubgraphState.setEndpointHasErrors(endpointIndex, subgraphName, true);
          }
        });
      }
    }
    await Promise.all(promiseGenerators.map((p) => p()));
  }
}

module.exports = InitService;
