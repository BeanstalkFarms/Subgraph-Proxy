const SubgraphClients = require('../datasources/subgraph-clients');
const EndpointBalanceUtil = require('../utils/load/endpoint-balance');
const GraphqlQueryUtil = require('../utils/query-manipulation');
const EndpointError = require('../error/endpoint-error');
const RequestError = require('../error/request-error');
const RateLimitError = require('../error/rate-limit-error');
const SubgraphState = require('../utils/state/subgraph');
const ChainState = require('../utils/state/chain');
const LoggingUtil = require('../utils/logging');
const EnvUtil = require('../utils/env');
const DiscordUtil = require('../utils/discord');
const SubgraphStatusService = require('./subgraph-status-service');

class SubgraphProxyService {
  // Proxies a subgraph request, accounting for version numbers and indexed blocks
  static async handleProxyRequest(subgraphName, originalQuery) {
    EnvUtil.throwOnInvalidName(subgraphName);
    const queryWithMetadata = GraphqlQueryUtil.addMetadataToQuery(originalQuery);
    const queryResult = await this._getQueryResult(subgraphName, queryWithMetadata);

    const version = queryResult.version.versionNumber;
    const deployment = queryResult._meta.deployment;
    const chain = queryResult.version.chain;

    const result = GraphqlQueryUtil.removeUnrequestedMetadataFromResult(queryResult, originalQuery);
    return {
      meta: {
        version,
        deployment,
        chain
      },
      body: result
    };
  }

  // Gets the result for this query from one of the available endpoints.
  // Actual proxy/load balancing orchestration occurs here.
  static async _getQueryResult(subgraphName, query) {
    const startTime = new Date();
    const startUtilization = await EndpointBalanceUtil.getSubgraphUtilization(subgraphName);
    const failedEndpoints = [];
    const unsyncdEndpoints = [];
    const endpointHistory = [];
    const errors = [];

    let endpointIndex;
    while (
      (endpointIndex = await EndpointBalanceUtil.chooseEndpoint(
        subgraphName,
        [...failedEndpoints, ...unsyncdEndpoints],
        endpointHistory
      )) !== -1
    ) {
      endpointHistory.push(endpointIndex);
      let queryResult;
      try {
        const client = await SubgraphClients.makeCallableClient(endpointIndex, subgraphName);
        queryResult = await client(query);
      } catch (e) {
        if (e instanceof RateLimitError) {
          break; // Will likely result in rethrowing a different RateLimitError
        }
        if (await this._isFutureBlockException(e, endpointIndex, subgraphName)) {
          continue;
        } else {
          failedEndpoints.push(endpointIndex);
          errors.push(e);
        }
      }

      if (queryResult) {
        this._updateStates(endpointIndex, subgraphName, queryResult, failedEndpoints);

        // Don't use this result if the endpoint is behind
        if (await SubgraphState.isInSync(endpointIndex, subgraphName)) {
          if (queryResult._meta.block.number >= SubgraphState.getLatestBlock(subgraphName)) {
            LoggingUtil.logSuccessfulProxy(subgraphName, endpointIndex, startTime, startUtilization, endpointHistory);
            return queryResult;
          }
          // The endpoint is in sync, but a more recent response had previously been given, either for this endpoint or
          // another. Do not accept this response. A valid response is expected on the next attempt
        } else {
          unsyncdEndpoints.push(endpointIndex);
        }
      }
    }

    LoggingUtil.logFailedProxy(subgraphName, startTime, startUtilization, endpointHistory);
    await this._throwFailureReason(subgraphName, errors, failedEndpoints, unsyncdEndpoints);
  }

  // Updates persistent states upon a successful request
  static async _updateStates(endpointIndex, subgraphName, queryResult, failedEndpoints) {
    SubgraphState.setLastEndpointUsageTimestamp(endpointIndex, subgraphName);
    SubgraphState.setEndpointDeployment(endpointIndex, subgraphName, queryResult._meta.deployment);
    SubgraphState.setEndpointVersion(endpointIndex, subgraphName, queryResult.version.versionNumber);
    SubgraphState.setEndpointChain(endpointIndex, subgraphName, queryResult.version.chain);
    SubgraphState.setEndpointBlock(endpointIndex, subgraphName, queryResult._meta.block.number);
    SubgraphState.setEndpointHasErrors(endpointIndex, subgraphName, false);

    // Query to an endpoint suceeded - any previous failures were not due to the user's query.
    for (const failedIndex of failedEndpoints) {
      SubgraphState.setEndpointHasErrors(failedIndex, subgraphName, true);
    }
  }

  // Identifies whether the failure is due to response being behind an explicitly requested block.
  // "has only indexed up to block number 20580123 and data for block number 22333232 is therefore not yet available"
  static async _isFutureBlockException(e, endpointIndex, subgraphName) {
    const match = e.message.match(/block number (\d+) is therefore/);
    if (match) {
      const blockNumber = parseInt(match[1]);
      const chain = SubgraphState.getEndpointChain(endpointIndex, subgraphName);
      if (blockNumber > (await ChainState.getChainHead(chain)) + 5) {
        // User requested a future block. This is not allowed
        throw new RequestError(`The requested block ${blockNumber} is invalid for chain ${chain}.`);
      }
      return true;
    }
    return false;
  }

  // Throws an exception based on the failure reason
  static async _throwFailureReason(subgraphName, errors, failedEndpoints, unsyncdEndpoints) {
    if (failedEndpoints.length + unsyncdEndpoints.length < EnvUtil.endpointsForSubgraph(subgraphName).length) {
      // If any of the endpoints were not attempted, assume this is a rate limiting issue.
      // This is preferable to performing the status check on a failing endpoint,
      // while another endpoint is presumably alive and actively servicing requests.
      if (failedEndpoints.length + unsyncdEndpoints.length === 0) {
        DiscordUtil.sendWebhookMessage(
          `Rate limit exceeded on all endpoints for ${subgraphName}. No endpoints attempted to service this request.`
        );
      } else {
        DiscordUtil.sendWebhookMessage(
          `Rate limit exceeded on endpoint(s) for ${subgraphName}. At least one endpoint tried and failed this request.`
        );
      }
      throw new RateLimitError(
        'The server is currently experiencing high traffic and cannot process your request. Please try again later.'
      );
    } else if (failedEndpoints.length > 0) {
      if (new Date() - SubgraphState.getLatestSubgraphErrorCheck(subgraphName) < 60 * 1000) {
        if (SubgraphState.allHaveErrors(subgraphName)) {
          throw new EndpointError('Subgraph is unable to process this request and may be offline.');
        } else {
          throw new RequestError(errors[0].message);
        }
      }

      // All endpoints failed. Check status to see if subgraphs are down or the client constructed a bad query.
      let hasErrors = true;
      let fatalError;
      const endpointIndex = await EndpointBalanceUtil.chooseEndpoint(subgraphName);
      try {
        SubgraphState.setLatestSubgraphErrorCheck(subgraphName);
        fatalError = await SubgraphStatusService.checkFatalError(endpointIndex, subgraphName);
        if (!fatalError) {
          hasErrors = false;
        }
      } catch (e) {
        if (e instanceof RateLimitError) {
          throw e;
        }
      }

      if (hasErrors) {
        // Assume the client query was not the issue
        for (const failedIndex of failedEndpoints) {
          SubgraphState.setEndpointHasErrors(failedIndex, subgraphName, true);
        }
        if (!fatalError) {
          console.log(`Failed to retrieve status for ${subgraphName} e-${endpointIndex}.`);
        }
        throw new EndpointError('Subgraph is unable to process this request and may be offline.');
      } else {
        // The endpoint is responsive and therefore the user constructed a bad request
        throw new RequestError(errors[0].message);
      }
    } else if (unsyncdEndpoints.length > 0) {
      throw new EndpointError('Subgraph has not yet indexed up to the latest block.');
    }
  }
}

module.exports = SubgraphProxyService;
