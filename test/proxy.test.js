const { gql } = require('graphql-request');
const SubgraphProxyService = require('../src/services/subgraph-proxy-service');
const GraphqlQueryUtil = require('../src/utils/query-manipulation');
const SubgraphState = require('../src/utils/state/subgraph');

const beanResponse = require('./mock-responses/bean.json');
const beanBehindResponse = require('./mock-responses/beanBehind.json');
const beanNewDeploymentResponse = require('./mock-responses/beanNewDeployment.json');

describe('Subgraph Proxy - Core', () => {
  describe('handleProxyRequest tests', () => {
    test('Add and removes extra metadata from request/response', async () => {
      const spy = jest.spyOn(SubgraphProxyService, '_getQueryResult').mockResolvedValueOnce(beanResponse);
      const query = gql`
        {
          beanCrosses(first: 5) {
            id
          }
        }
      `;
      const result = await SubgraphProxyService.handleProxyRequest('bean', query);

      expect(spy).toHaveBeenCalledWith('bean', GraphqlQueryUtil.addMetadataToQuery(query));
      expect(result.meta.deployment).toEqual('QmXXZrhjqb4ygSWVgkPYBWJ7AzY4nKEUqiN5jnDopWBSCD');
      expect(result.body.beanCrosses.length).toEqual(5);
      expect(result.body._meta).toBeUndefined();
      expect(result.body.version).toBeUndefined();
    });

    test('Does not remove explicitly requested metadata', async () => {
      const spy = jest.spyOn(SubgraphProxyService, '_getQueryResult').mockResolvedValueOnce(beanResponse);
      const query = gql`
        {
          _meta {
            block {
              number
            }
          }
          beanCrosses(first: 5) {
            id
          }
        }
      `;
      const result = await SubgraphProxyService.handleProxyRequest('bean', query);

      expect(spy).toHaveBeenCalledWith('bean', GraphqlQueryUtil.addMetadataToQuery(query));
      expect(result.meta.deployment).toEqual('QmXXZrhjqb4ygSWVgkPYBWJ7AzY4nKEUqiN5jnDopWBSCD');
      expect(result.body.beanCrosses.length).toEqual(5);
      expect(result.body._meta.block.number).toEqual(20581045);
      expect(result.body.version).toBeUndefined();
    });
  });

  test('Can successfully update the global state', async () => {
    SubgraphProxyService._updateStates(0, 'bean', beanResponse, []);
    expect(SubgraphState.getEndpointBlock(0, 'bean')).toEqual(20581045);
    expect(SubgraphState.getEndpointChain(0, 'bean')).toEqual('ethereum');
    expect(SubgraphState.getEndpointVersion(0, 'bean')).toEqual('2.3.1');
    expect(SubgraphState.getEndpointDeployment(0, 'bean')).toEqual('QmXXZrhjqb4ygSWVgkPYBWJ7AzY4nKEUqiN5jnDopWBSCD');

    // Subgraph is behind, should not effect endpoint 0
    SubgraphProxyService._updateStates(0, 'bean', beanBehindResponse, []);
    expect(SubgraphState.getEndpointBlock(0, 'bean')).toEqual(20581045);
    SubgraphProxyService._updateStates(1, 'bean', beanBehindResponse, []);
    expect(SubgraphState.getEndpointBlock(1, 'bean')).toEqual(20581043);

    SubgraphProxyService._updateStates(0, 'bean', beanNewDeploymentResponse, []);
    expect(SubgraphState.getEndpointBlock(0, 'bean')).toEqual(16000000);
    expect(SubgraphState.getEndpointVersion(0, 'bean')).toEqual('2.3.2');

    // The new version on endpoint 0 crashed
    SubgraphProxyService._updateStates(1, 'bean', beanResponse, [0]);
    expect(SubgraphState.getEndpointBlock(0, 'bean')).toEqual(0);
    expect(SubgraphState.endpointHasErrors(0, 'bean')).toBeTruthy();
  });

  test('Initial endpoint succeeds', async () => {});
  test('Second endpoint succeeds', async () => {});
  test('Both endpoints fail - user error', async () => {});
  test('Both endpoints fail - endpoint error', async () => {});
  test('One endpoint is out of sync', async () => {});

  test('User queries far future block', async () => {});
  test('User queries current block that is indexed but temporarily unavailable', async () => {});
});
