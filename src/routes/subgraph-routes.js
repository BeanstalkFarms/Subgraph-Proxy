const Router = require('koa-router');
const SubgraphProxyService = require('../services/subgraph-proxy-service');

const router = new Router({
  prefix: '/'
});

/**
 * Proxies the subgraph request to one of the underlying subgraph instances
 */
router.post(':subgraphName', async (ctx) => {
  const body = ctx.request.body;

  // Introspection query has a simplified proxy process
  const proxiedResult = body.query.includes('query IntrospectionQuery {')
    ? SubgraphProxyService.handleProxyIntrospection(ctx.params.subgraphName, body)
    : SubgraphProxyService.handleProxyRequest(ctx.params.subgraphName, ctx.request.body);

  ctx.body = proxiedResult;
});

module.exports = router;
