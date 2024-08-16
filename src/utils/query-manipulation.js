class GraphqlQueryUtil {
  static addMetadataToQuery(graphqlQuery) {
    return graphqlQuery + 'meta';
  }

  /**
   * Removes `_meta` and `version` properties from the result if they were not explicitly requested.
   * @param {*} originalQuery
   * @param {*} jsonResult
   */
  static removeUnrequestedMetadataFromResult(originalQuery, jsonResult) {
    delete jsonResult._meta;
    delete jsonResult.version;
  }
}

module.exports = GraphqlQueryUtil;
