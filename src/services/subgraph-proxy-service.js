const GraphqlQueryUtil = require('../utils/query-manipulation');
require('../datasources/subgraph-clients');

class SubgraphProxyService {
  static async handleProxyIntrospection(subgraphName, introspectionQuery) {
    // Proxy the introspection request without modification
    console.log('is introspection');
  }

  static async handleProxyRequest(subgraphName, originalQuery) {
    console.log(`Handling request for ${subgraphName}:\n\n${originalQuery}\n-------`);
    const queryWithMetadata = GraphqlQueryUtil.addMetadataToQuery(originalQuery);
    console.log(`Query with metadata added:\n\n${queryWithMetadata}\n-------`);
    const result = []; // subgraph query here
    const response = GraphqlQueryUtil.removeUnrequestedMetadataFromResult(originalQuery, result);
    return response;
  }
}

module.exports = SubgraphProxyService;
