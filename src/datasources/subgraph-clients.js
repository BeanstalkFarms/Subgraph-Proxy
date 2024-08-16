require('dotenv').config();

const ALCHEMY_PREFIX = `https://graph.bean.money/`;
const GRAPH_PREFIX = `https://gateway-arbitrum.network.thegraph.com/api/${process.env.GRAPH_API_KEY}/subgraphs/id/`;

const ENABLED_SUBGRAPHS = process.env.SUBGRAPH_SLUGS?.split(',');
const UNDERYING_ALCHEMY = process.env.ALCHEMY_SUBGRAPH_NAMES?.split(',');
const UNDERYING_GRAPH = process.env.GRAPH_SUBGRAPH_IDS?.split(',');

if (ENABLED_SUBGRAPHS.length !== UNDERYING_ALCHEMY.length || UNDERYING_ALCHEMY.length !== UNDERYING_GRAPH.length) {
  throw new Error('Invalid environment configured.');
}
console.log(UNDERYING_GRAPH);

const clients = {};

function getClient(url) {
  if (!clients[url]) {
    clients[url] = new GraphQLClient(url);
  }
  return clients[url];
}

function clientBuilder(proxySlug) {
  return async (query) => {
    const client = getClient(url);
    const response = await client.request(query);
    return response;
  };
}
