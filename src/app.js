const subgraphRoutes = require('./routes/subgraph-routes.js');

const Koa = require('koa');
const bodyParser = require('koa-bodyparser');
const cors = require('@koa/cors');

async function appStartup() {
  const app = new Koa();

  app.use(bodyParser());
  app.use(
    cors({
      origin: '*'
    })
  );

  app.use(subgraphRoutes.routes());
  app.use(subgraphRoutes.allowedMethods());

  app.listen(3000, () => {
    console.log('Server running on port 3000');
  });
}
appStartup();

// Unhandled promise rejection handler prevents api restart under those circumstances.
// Ideally potential promise rejections are handled locally but that may not be the case.
process.on('unhandledRejection', (reason, promise) => {
  console.log('Unhandled Rejection at:', promise, 'reason:', reason);
});
