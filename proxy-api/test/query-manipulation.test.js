const { gql } = require('graphql-request');
const GraphqlQueryUtil = require('../src/utils/query-manipulation');
const SubgraphProxyService = require('../src/services/subgraph-proxy-service');

const beanResponse = require('./mock-responses/bean.json');
const responseBlock = beanResponse._meta.block.number;

describe('Query manipulation tests', () => {
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
    expect(result.body._meta.block.number).toEqual(responseBlock);
    expect(result.body.version).toBeUndefined();
  });
});
