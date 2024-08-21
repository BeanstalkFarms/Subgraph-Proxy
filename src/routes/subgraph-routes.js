const Router = require('koa-router');
const SubgraphProxyService = require('../services/subgraph-proxy-service');

const router = new Router({
  prefix: '/'
});

/**
 * Proxies the subgraph request to one of the underlying subgraph instances
 */
router.post(':subgraphName', async (ctx) => {
  const subgraphName = ctx.params.subgraphName;
  const body = ctx.request.body;

  // Introspection query has a simplified proxy process
  const proxiedResult = body.query.includes('query IntrospectionQuery {')
    ? await SubgraphProxyService.handleProxyIntrospection(subgraphName, body.query)
    : await SubgraphProxyService.handleProxyRequest(subgraphName, body.query);

  ctx.set('X-Version', proxiedResult.meta.version);
  ctx.set('X-Deployment', proxiedResult.meta.deployment);
  ctx.set('X-Chain', proxiedResult.meta.chain);

  ctx.body = {
    data: proxiedResult.body
  };
});

module.exports = router;
