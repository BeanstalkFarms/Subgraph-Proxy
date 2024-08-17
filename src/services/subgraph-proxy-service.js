const SubgraphClients = require('../datasources/subgraph-clients');
const GraphqlQueryUtil = require('../utils/query-manipulation');
require('../datasources/subgraph-clients');

const alchemyConfig = {
  id: 'alchemy-subgraphs',
  requestsPerInterval: 30,
  maxBuffer: 300,
  interval: 1000
};

const graphConfig = {
  id: 'graph-subgraphs',
  requestsPerInterval: 80,
  maxBuffer: 800,
  interval: 1000
};

// Add logic to support this:
// If alchemy is <90% utilized, the request should go there.
// Otherwise go to the graph
// If both are >90% utilized, pari passu

// In the case of a crash: if it can identify that the subgraph has crashed, it should not query it again for 5 minutes
// Something similar can be done if a stale deployment version is encountered

// Consider adding a header with information about which underlying subgraph/verison was used?
// Perhaps version number + deployment hash is the most useful

class SubgraphProxyService {
  static async handleProxyIntrospection(subgraphName, introspectionQuery) {
    // Proxy the introspection request without modification
    console.log('is introspection');
    // Identify underutilized endpoint with preference ratio.
    const underutilizedIndex = 0;

    console.log('query:', introspectionQuery);

    const client = SubgraphClients.makeCallableClient(underutilizedIndex, subgraphName);
    return await client(introspectionQuery);
  }

  static async handleProxyRequest(subgraphName, originalQuery) {
    console.log(`Handling request for ${subgraphName}:\n\n${originalQuery}\n-------`);
    const queryWithMetadata = GraphqlQueryUtil.addMetadataToQuery(originalQuery);
    console.log(`Query with metadata added:\n\n${queryWithMetadata}\n-------`);
    const result = []; // subgraph query here
    const response = GraphqlQueryUtil.removeUnrequestedMetadataFromResult(originalQuery, result);
    // return response;

    const client = SubgraphClients.makeCallableClient(0, subgraphName);
    return await client(originalQuery);
  }
}

module.exports = SubgraphProxyService;
