const { gql } = require('graphql-request');
const SubgraphClients = require('../datasources/subgraph-clients');
const LoadBalanceUtil = require('../utils/load-balance');
const GraphqlQueryUtil = require('../utils/query-manipulation');
const EndpointError = require('../error/endpoint-error');
const RequestError = require('../error/request-error');
const SubgraphState = require('../utils/state/subgraph');
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

class SubgraphProxyService {
  // Gets the latest known available version of the schema
  static async handleProxyIntrospection(subgraphName, introspectionQuery) {
    const endpointIndex = LoadBalanceUtil.chooseEndpoint([]);
    const client = SubgraphClients.makeCallableClient(endpointIndex, subgraphName);
    return await client(introspectionQuery);
  }

  // Proxies a regular request, accounting for version numbers and indexed blocks
  static async handleProxyRequest(subgraphName, originalQuery) {
    console.log(`Handling request for ${subgraphName}:\n\n${originalQuery}\n-------`);
    const queryWithMetadata = GraphqlQueryUtil.addMetadataToQuery(originalQuery);
    console.log(`Query with metadata added:\n\n${queryWithMetadata}\n-------`);

    // TODO: If this method throws, have middleware catch it and provide message of either 400 or 500 depending.
    const queryResult = await this._getQueryResult(subgraphName, queryWithMetadata);

    const version = queryResult.version.versionNumber;
    const deployment = queryResult._meta.deployment;
    const chain = queryResult.version.chain;

    GraphqlQueryUtil.removeUnrequestedMetadataFromResult(queryResult, originalQuery);
    return {
      meta: {
        version,
        deployment,
        chain
      },
      body: queryResult
    };
  }

  // Gets the result for this query from one of the available endpoints.
  // Actual proxy/load balancing orchestration is here.
  static async _getQueryResult(subgraphName, query) {
    const failedEndpoints = [];
    const unsyncdEndpoints = [];
    const errors = [];

    let endpointIndex;
    while ((endpointIndex = LoadBalanceUtil.chooseEndpoint([...failedEndpoints, ...unsyncdEndpoints])) !== -1) {
      const client = SubgraphClients.makeCallableClient(endpointIndex, subgraphName);
      try {
        const queryResult = await client(query);

        SubgraphState.setEndpointDeployment(endpointIndex, subgraphName, queryResult._meta.deployment);
        SubgraphState.setEndpointVersion(endpointIndex, subgraphName, queryResult.version.versionNumber);
        SubgraphState.setEndpointBlock(endpointIndex, subgraphName, queryResult._meta.block.number);
        SubgraphState.setEndpointHasErrors(endpointIndex, subgraphName, false);

        // The above query succeeded - any previous problem was not due to the user's query.
        for (const failedIndex of failedEndpoints) {
          SubgraphState.setEndpointHasErrors(failedIndex, subgraphName, true);
        }

        // Don't use this result if the endpoint is behind
        if (!SubgraphState.isInSync(endpointIndex, subgraphName, queryResult.version.chain)) {
          unsyncdEndpoints.push(endpointIndex);
          continue;
        }

        // The endpoint is in sync, but a more recent response had previously been given. Do not accept this response
        if (queryResult._meta.block.number < SubgraphState.getLatestBlock(subgraphName)) {
          // same as data for block number 29589999 is therefore not yet available
        }

        return queryResult;
      } catch (e) {
        // TODO: identify whether the failure is due to response being behind an explicitly requested block
        // "has only indexed up to block number 20580123 and data for block number 22333232 is therefore not yet available"
        failedEndpoints.push(endpointIndex);
        errors.push(e);
      }
    }

    this._throwFailureReason(subgraphName, errors, failedEndpoints, unsyncdEndpoints);
  }

  // Throws an exception based on the failure reason
  static async _throwFailureReason(subgraphName, errors, failedEndpoints, unsyncdEndpoints) {
    if (failedEndpoints.length > 0) {
      // All endpoints failed. Attempt a known safe query to see if the subgraphs are down or the client
      // constructed a bad query.
      const client = SubgraphClients.makeCallableClient(LoadBalanceUtil.chooseEndpoint([]), subgraphName);
      try {
        await client(gql`
          {
            _meta {
              deployment
            }
          }
        `);
      } catch (e) {
        // The endpoint cannot process a basic request, assume the user query was ok
        for (const failedIndex of failedEndpoints) {
          SubgraphState.setEndpointHasErrors(failedIndex, subgraphName, true);
        }
        throw new EndpointError('Subgraph is unable to process this request and may be offline.');
      }

      // The endpoint is responsive and therefore the user constructed a bad request
      throw new RequestError(errors[0].message);
    } else if (unsyncdEndpoints.length > 0) {
      throw new EndpointError('Subgraph has not yet indexed up to the latest block.');
    }
    throw new Error('This should be unreachable');
  }
}

module.exports = SubgraphProxyService;
