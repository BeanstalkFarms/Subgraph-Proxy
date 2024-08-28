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
    const result = JSON.parse(JSON.stringify(jsonResult));
    if (!this._includesMeta(originalQuery)) {
      delete result._meta;
    }
    if (!this._includesVersion(originalQuery)) {
      delete result.version;
    }
    return result;
  }

  static _includesMeta(originalQuery) {
    return /_meta\s*\{/.test(originalQuery);
  }

  static _includesVersion(originalQuery) {
    return /version\s*\(\s*id\s*:\s*"subgraph"\s*\)\s*\{/.test(originalQuery);
  }
}

module.exports = GraphqlQueryUtil;
