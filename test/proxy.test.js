const { gql } = require('graphql-request');
const SubgraphProxyService = require('../src/services/subgraph-proxy-service');
const GraphqlQueryUtil = require('../src/utils/query-manipulation');

const beanCrossesResponse = require('./mock-responses/beanCrosses.json');

describe('Subgraph Proxy - Core', () => {
  describe('handleProxyRequest tests', () => {
    test('Add and removes extra metadata from request/response', async () => {
      const spy = jest.spyOn(SubgraphProxyService, '_getQueryResult').mockResolvedValueOnce(beanCrossesResponse);
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
      const spy = jest.spyOn(SubgraphProxyService, '_getQueryResult').mockResolvedValueOnce(beanCrossesResponse);
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

  test('Can successfully update the global state', async () => {});

  test('Initial endpoint succeeds', async () => {});
  test('Second endpoint succeeds', async () => {});
  test('Both endpoints fail - user error', async () => {});
  test('Both endpoints fail - endpoint error', async () => {});
  test('One endpoint is out of sync', async () => {});

  test('User queries far future block', async () => {});
  test('User queries current block that is indexed but temporarily unavailable', async () => {});
});
