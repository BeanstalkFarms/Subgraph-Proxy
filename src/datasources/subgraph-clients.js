const { GraphQLClient } = require('graphql-request');
const { ENDPOINTS, ENDPOINT_SG_IDS, ENABLED_SUBGRAPHS } = require('../utils/env');
const BottleneckLimiters = require('../utils/load/bottleneck-limiters');

class SubgraphClients {
  // Stores the clients, key format endpointIndex-subgraphIndex (based on the ordering in .env)
  static clients = {};

  static getClient(endpointIndex, subgraphIndex) {
    const key = `${endpointIndex}-${subgraphIndex}`;
    if (!this.clients[key]) {
      this.clients[key] = new GraphQLClient(
        ENDPOINTS[endpointIndex].replace('<sg-id>', ENDPOINT_SG_IDS[endpointIndex][subgraphIndex])
      );
    }
    return this.clients[key];
  }

  static async makeCallableClient(endpointIndex, subgraphName) {
    const subgraphIndex = ENABLED_SUBGRAPHS.indexOf(subgraphName);
    if (subgraphIndex === -1) {
      throw new Error(`Unsupported subgraph: ${subgraphName}`);
    }

    const callableClient = async (query) => {
      const client = this.getClient(endpointIndex, subgraphIndex);
      const response = await client.request(query);
      return response;
    };
    const limiterWrapped = await BottleneckLimiters.wrap(endpointIndex, callableClient);
    return limiterWrapped;
  }
}

module.exports = SubgraphClients;
