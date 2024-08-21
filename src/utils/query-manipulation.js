class GraphqlQueryUtil {
  static addMetadataToQuery(graphqlQuery) {
    return graphqlQuery.replace(
      '{',
      `{
      _meta {
        block {
          number
        }
        deployment
      }
      version(id: "subgraph") {
        subgraphName
        versionNumber
        chain
      }`
    );
  }

  /**
   * Removes `_meta` and `version` properties from the result if they were not explicitly requested.
   * @param {*} jsonResult
   * @param {*} originalQuery
   */
  static removeUnrequestedMetadataFromResult(jsonResult, originalQuery) {
    if (!originalQuery.includes('_meta {')) {
      delete jsonResult._meta;
    }
    if (!originalQuery.includes('version(id: "subgraph") {')) {
      delete jsonResult.version;
    }
  }
}

module.exports = GraphqlQueryUtil;
