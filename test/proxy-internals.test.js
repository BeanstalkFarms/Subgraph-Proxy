const SubgraphProxyService = require('../src/services/subgraph-proxy-service');
const SubgraphState = require('../src/utils/state/subgraph');
const LoadBalanceUtil = require('../src/utils/load/endpoint-balance');
const SubgraphClients = require('../src/datasources/subgraph-clients');
const ChainState = require('../src/utils/state/chain');
const RequestError = require('../src/error/request-error');
const EndpointError = require('../src/error/endpoint-error');
const { captureAndReturn } = require('./utils/capture-args');

const beanResponse = require('./mock-responses/bean.json');
const beanBehindResponse = require('./mock-responses/beanBehind.json');
const beanNewDeploymentResponse = require('./mock-responses/beanNewDeployment.json');
const responseBlock = beanResponse._meta.block.number;
const responseBehindBlock = beanBehindResponse._meta.block.number;
const newDeploymentBlock = beanNewDeploymentResponse._meta.block.number;

// For capturing arguments to LoadBalanceUtil.chooseEndpoint
let endpointArgCapture;

describe('Subgraph Proxy - Core', () => {
  beforeEach(() => {
    // Clears call history (NOT implementations)
    jest.clearAllMocks();
  });

  beforeAll(() => {
    jest.spyOn(ChainState, 'getChainHead').mockResolvedValue(responseBlock);
  });

  test('Can successfully update the global state', async () => {
    SubgraphProxyService._updateStates(0, 'bean', beanResponse, []);
    expect(SubgraphState.getEndpointBlock(0, 'bean')).toEqual(responseBlock);
    expect(SubgraphState.getEndpointChain(0, 'bean')).toEqual('ethereum');
    expect(SubgraphState.getEndpointVersion(0, 'bean')).toEqual('2.3.1');
    expect(SubgraphState.getEndpointDeployment(0, 'bean')).toEqual('QmXXZrhjqb4ygSWVgkPYBWJ7AzY4nKEUqiN5jnDopWBSCD');

    // Subgraph is behind, should not affect endpoint 0
    SubgraphProxyService._updateStates(0, 'bean', beanBehindResponse, []);
    expect(SubgraphState.getEndpointBlock(0, 'bean')).toEqual(responseBlock);
    SubgraphProxyService._updateStates(1, 'bean', beanBehindResponse, []);
    expect(SubgraphState.getEndpointBlock(1, 'bean')).toEqual(responseBehindBlock);

    SubgraphProxyService._updateStates(0, 'bean', beanNewDeploymentResponse, []);
    expect(SubgraphState.getEndpointBlock(0, 'bean')).toEqual(newDeploymentBlock);
    expect(SubgraphState.getEndpointVersion(0, 'bean')).toEqual('2.3.2');

    // The new version on endpoint 0 crashed
    SubgraphProxyService._updateStates(1, 'bean', beanResponse, [0]);
    expect(SubgraphState.getEndpointBlock(0, 'bean')).toEqual(0);
    expect(SubgraphState.endpointHasErrors(0, 'bean')).toBeTruthy();
  });

  describe('Core retry logic', () => {
    beforeEach(() => {
      endpointArgCapture = [];
      jest
        .spyOn(LoadBalanceUtil, 'chooseEndpoint')
        .mockReset()
        .mockImplementationOnce((...args) => captureAndReturn(endpointArgCapture, 0, ...args))
        .mockImplementationOnce((...args) => captureAndReturn(endpointArgCapture, 1, ...args))
        .mockImplementationOnce((...args) => captureAndReturn(endpointArgCapture, -1, ...args))
        .mockImplementationOnce((...args) => captureAndReturn(endpointArgCapture, 0, ...args));
      jest.spyOn(SubgraphState, 'getLatestErrorCheck').mockReturnValue(undefined);
    });

    test('Initial endpoint succeeds', async () => {
      jest.spyOn(SubgraphClients, 'makeCallableClient').mockResolvedValueOnce(async () => beanResponse);
      await expect(SubgraphProxyService._getQueryResult('bean', 'graphql query')).resolves.not.toThrow();

      expect(LoadBalanceUtil.chooseEndpoint).toHaveBeenCalledTimes(1);
      expect(endpointArgCapture[0]).toEqual([[], []]);
    });
    test('Second endpoint succeeds', async () => {
      jest
        .spyOn(SubgraphClients, 'makeCallableClient')
        .mockImplementationOnce(async () => async () => {
          throw new Error('Generic failure reason');
        })
        .mockResolvedValueOnce(async () => beanResponse);

      await expect(SubgraphProxyService._getQueryResult('bean', 'graphql query')).resolves.not.toThrow();

      expect(LoadBalanceUtil.chooseEndpoint).toHaveBeenCalledTimes(2);
      expect(endpointArgCapture[0]).toEqual([[], []]);
      expect(endpointArgCapture[1]).toEqual([[0], [0]]);
    });
    test('Both endpoints fail - user error', async () => {
      jest
        .spyOn(SubgraphClients, 'makeCallableClient')
        .mockImplementationOnce(async () => async () => {
          throw new Error('Generic failure reason');
        })
        .mockImplementationOnce(async () => async () => {
          throw new Error('Generic failure reason');
        })
        // Both endpoints failed the user request but succeed the simple request
        .mockResolvedValueOnce(async () => beanResponse);

      await expect(SubgraphProxyService._getQueryResult('bean', 'graphql query')).rejects.toThrow(RequestError);
      expect(LoadBalanceUtil.chooseEndpoint).toHaveBeenCalledTimes(4);
      expect(endpointArgCapture[0]).toEqual([[], []]);
      expect(endpointArgCapture[1]).toEqual([[0], [0]]);
      expect(endpointArgCapture[2]).toEqual([
        [0, 1],
        [0, 1]
      ]);
      expect(endpointArgCapture[3]).toEqual([]);
    });
    test('Both endpoints fail - endpoint error', async () => {
      jest.spyOn(SubgraphClients, 'makeCallableClient').mockImplementation(async () => async () => {
        throw new Error('Generic failure reason');
      }); // This implementation will be used 3 times, all are failure

      await expect(SubgraphProxyService._getQueryResult('bean', 'graphql query')).rejects.toThrow(EndpointError);
      expect(LoadBalanceUtil.chooseEndpoint).toHaveBeenCalledTimes(4);
      expect(endpointArgCapture[0]).toEqual([[], []]);
      expect(endpointArgCapture[1]).toEqual([[0], [0]]);
      expect(endpointArgCapture[2]).toEqual([
        [0, 1],
        [0, 1]
      ]);
      expect(endpointArgCapture[3]).toEqual([]);
    });
    test('One endpoint is out of sync', async () => {
      jest
        .spyOn(SubgraphClients, 'makeCallableClient')
        .mockResolvedValueOnce(async () => beanNewDeploymentResponse)
        .mockResolvedValueOnce(async () => beanResponse);

      await expect(SubgraphProxyService._getQueryResult('bean', 'graphql query')).resolves.not.toThrow();

      expect(LoadBalanceUtil.chooseEndpoint).toHaveBeenCalledTimes(2);
      expect(endpointArgCapture[1]).toEqual([[0], [0]]);
    });
    test('Both endpoints are out of sync', async () => {
      jest
        .spyOn(SubgraphClients, 'makeCallableClient')
        .mockResolvedValueOnce(async () => beanNewDeploymentResponse)
        .mockResolvedValueOnce(async () => beanNewDeploymentResponse);

      await expect(SubgraphProxyService._getQueryResult('bean', 'graphql query')).rejects.toThrow(EndpointError);

      expect(LoadBalanceUtil.chooseEndpoint).toHaveBeenCalledTimes(3);
      expect(endpointArgCapture[1]).toEqual([[0], [0]]);
      expect(endpointArgCapture[2]).toEqual([
        [0, 1],
        [0, 1]
      ]);
    });

    test('User explicitly queries far future block', async () => {
      jest.spyOn(SubgraphClients, 'makeCallableClient').mockImplementationOnce(async () => async () => {
        throw new Error(`block number ${responseBlock + 1000} is therefore not yet available`);
      });

      await expect(SubgraphProxyService._getQueryResult('bean', 'graphql query')).rejects.toThrow(RequestError);
      expect(LoadBalanceUtil.chooseEndpoint).toHaveBeenCalledTimes(1);
    });
    test('User explicitly queries current block that is indexed but temporarily unavailable', async () => {
      // Request fails the first 2 times, and succeeds on the third
      jest
        .spyOn(SubgraphClients, 'makeCallableClient')
        .mockImplementationOnce(async () => async () => {
          throw new Error(`block number ${responseBlock} is therefore not yet available`);
        })
        .mockImplementationOnce(async () => async () => {
          throw new Error(`block number ${responseBlock} is therefore not yet available`);
        })
        .mockResolvedValueOnce(async () => beanResponse);

      // Different logic here to prevent returning -1 on third invocation
      jest
        .spyOn(LoadBalanceUtil, 'chooseEndpoint')
        .mockReset()
        .mockImplementationOnce((...args) => captureAndReturn(endpointArgCapture, 0, ...args))
        .mockImplementationOnce((...args) => captureAndReturn(endpointArgCapture, 1, ...args))
        .mockImplementationOnce((...args) => captureAndReturn(endpointArgCapture, 0, ...args));

      await expect(SubgraphProxyService._getQueryResult('bean', 'graphql query')).resolves.not.toThrow();
      expect(LoadBalanceUtil.chooseEndpoint).toHaveBeenCalledTimes(3);
      expect(endpointArgCapture[1]).toEqual([[], [0]]);
      expect(endpointArgCapture[2]).toEqual([[], [0, 1]]);
    });
    test('Latest known indexed block is temporarily unavailable', async () => {
      jest
        .spyOn(LoadBalanceUtil, 'chooseEndpoint')
        .mockReset()
        .mockImplementationOnce((...args) => captureAndReturn(endpointArgCapture, 0, ...args))
        .mockImplementationOnce((...args) => captureAndReturn(endpointArgCapture, 0, ...args))
        .mockImplementationOnce((...args) => captureAndReturn(endpointArgCapture, 1, ...args))
        .mockImplementationOnce((...args) => captureAndReturn(endpointArgCapture, 0, ...args));

      jest
        .spyOn(SubgraphClients, 'makeCallableClient')
        .mockResolvedValueOnce(async () => beanResponse)
        .mockResolvedValueOnce(async () => beanBehindResponse)
        .mockResolvedValueOnce(async () => beanBehindResponse)
        .mockResolvedValueOnce(async () => beanResponse);
      // Initial query that gets the latest block successfully
      await expect(SubgraphProxyService._getQueryResult('bean', 'graphql query')).resolves.not.toThrow();
      expect(LoadBalanceUtil.chooseEndpoint).toHaveBeenCalledTimes(1);

      // Second query that fails to get the latest block on first 2 attempts
      await expect(SubgraphProxyService._getQueryResult('bean', 'graphql query')).resolves.not.toThrow();
      expect(LoadBalanceUtil.chooseEndpoint).toHaveBeenCalledTimes(4);
      expect(endpointArgCapture[2]).toEqual([[], [0]]);
      expect(endpointArgCapture[3]).toEqual([[], [0, 1]]);
    });
  });

  test('No endpoints are available', async () => {
    // TODO: might be better to write this once the circumstances are clearer by which it can happen.
    // The idea is that an incoming request may immediately be rejected and have no available endpoints.
    // in this situation currently, it would reach the unreachable code exception. Unclear what is the proper
    // status code to return in this case.
  });
});
