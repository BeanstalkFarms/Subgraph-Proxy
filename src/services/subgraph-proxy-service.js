const { gql } = require('graphql-request');
const SubgraphClients = require('../datasources/subgraph-clients');
const LoadBalanceUtil = require('../utils/load-balance');
const GraphqlQueryUtil = require('../utils/query-manipulation');
const EndpointError = require('../error/endpoint-error');
const RequestError = require('../error/request-error');
const SubgraphState = require('../utils/state/subgraph');
const ChainState = require('../utils/state/chain');
const LoggingUtil = require('../utils/logging');
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
  // Proxies a subgraph request, accounting for version numbers and indexed blocks
  static async handleProxyRequest(subgraphName, originalQuery) {
    const queryWithMetadata = GraphqlQueryUtil.addMetadataToQuery(originalQuery);
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
  // Actual proxy/load balancing orchestration occurs here.
  static async _getQueryResult(subgraphName, query) {
    const startTime = new Date();
    const failedEndpoints = [];
    const unsyncdEndpoints = [];
    const endpointHistory = [];
    const errors = [];

    let endpointIndex;
    while (
      (endpointIndex = LoadBalanceUtil.chooseEndpoint([...failedEndpoints, ...unsyncdEndpoints], endpointHistory)) !==
      -1
    ) {
      endpointHistory.push(endpointIndex);
      let queryResult;
      try {
        const client = SubgraphClients.makeCallableClient(endpointIndex, subgraphName);
        queryResult = await client(query);
      } catch (e) {
        if (this._isFutureBlockException(e)) {
          continue;
        } else {
          failedEndpoints.push(endpointIndex);
          errors.push(e);
        }
      }

      if (queryResult) {
        this._updateStates(endpointIndex, subgraphName, queryResult, failedEndpoints);

        // Don't use this result if the endpoint is behind
        if (SubgraphState.isInSync(endpointIndex, subgraphName, queryResult.version.chain)) {
          if (queryResult._meta.block.number >= SubgraphState.getLatestBlock(subgraphName)) {
            LoggingUtil.logSuccessfulProxy(subgraphName, endpointIndex, startTime, endpointHistory);
            return queryResult;
          }
          // The endpoint is in sync, but a more recent response had previously been given, either for this endpoint or
          // another. Do not accept this response. A valid response is expected on the next attempt
        } else {
          unsyncdEndpoints.push(endpointIndex);
        }
      }
    }

    LoggingUtil.logFailedProxy(subgraphName, startTime, endpointHistory);
    await this._throwFailureReason(subgraphName, errors, failedEndpoints, unsyncdEndpoints);
  }

  // Updates persistent states upon a successful request
  static async _updateStates(endpointIndex, subgraphName, queryResult, failedEndpoints) {
    SubgraphState.setEndpointDeployment(endpointIndex, subgraphName, queryResult._meta.deployment);
    SubgraphState.setEndpointVersion(endpointIndex, subgraphName, queryResult.version.versionNumber);
    SubgraphState.setEndpointChain(endpointIndex, subgraphName, queryResult.version.chain);
    SubgraphState.setEndpointBlock(endpointIndex, subgraphName, queryResult._meta.block.number);
    SubgraphState.setEndpointHasErrors(endpointIndex, subgraphName, false);

    // Query to this endpoint suceeded - any previous failures were not due to the user's query.
    for (const failedIndex of failedEndpoints) {
      SubgraphState.setEndpointHasErrors(failedIndex, subgraphName, true);
    }
  }

  // Identifies whether the failure is due to response being behind an explicitly requested block.
  // "has only indexed up to block number 20580123 and data for block number 22333232 is therefore not yet available"
  static _isFutureBlockException(e) {
    const match = e.message.match(/block number (\d+) is therefore/);
    if (match) {
      const blockNumber = parseInt(match[1]);
      const chain = SubgraphState.getEndpointChain(endpointIndex, subgraphName);
      if (blockNumber > ChainState.getChainHead(chain) + 5) {
        // User requested a future block. This is not allowed
        throw new RequestError(`The requested block ${blockNumber} is invalid for chain ${chain}.`);
      }
      return true;
    }
    return false;
  }

  // Throws an exception based on the failure reason
  static async _throwFailureReason(subgraphName, errors, failedEndpoints, unsyncdEndpoints) {
    if (failedEndpoints.length > 0) {
      if (new Date() - SubgraphState.getLatestErrorCheck(subgraphName) < 60 * 1000) {
        if (SubgraphState.allHaveErrors(subgraphName)) {
          throw new EndpointError('Subgraph is unable to process this request and may be offline.');
        } else {
          throw new RequestError(errors[0].message);
        }
      }

      // All endpoints failed. Attempt a known safe query to see if the subgraphs are down or the client
      // constructed a bad query.
      try {
        SubgraphState.setLatestErrorCheck(subgraphName);
        const client = SubgraphClients.makeCallableClient(LoadBalanceUtil.chooseEndpoint(), subgraphName);
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
