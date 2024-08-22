require('dotenv').config();

// Need to replace "<sg>" with the name/id of the subgraph to use
const ENDPOINTS = process.env.ENDPOINTS?.split('|');
const ENDPOINT_RATE_LIMITS = process.env.ENDPOINT_RATE_LIMITS?.split('|').map((sg) => sg.split(','));
const ENDPOINT_UTILIZATION_PREFERENCE = process.env.ENDPOINT_UTILIZATION_PREFERENCE?.split('|');
const ENABLED_SUBGRAPHS = process.env.ENABLED_SUBGRAPHS?.split(',');
const ENDPOINT_SG_IDS = process.env.ENDPOINT_SG_IDS?.split('|').map((sg) => sg.split(','));

// Validation
for (const endpointIds of ENDPOINT_SG_IDS) {
  if (endpointIds.length !== ENABLED_SUBGRAPHS.length) {
    throw new Error('Invalid environment configured: underlying subgraph ids could not pair with enabled subgraphs.');
  }
}

if (ENDPOINTS.length !== ENDPOINT_RATE_LIMITS.length || ENDPOINTS.length !== ENDPOINT_UTILIZATION_PREFERENCE.length) {
  throw new Error('Invalid environment configured: endpoin configuration incomplete');
}

if (ENDPOINT_UTILIZATION_PREFERENCE.some((p) => p.length !== 3)) {
  throw new Error('Invalid environment configured: utilization missing required input');
}

module.exports = {
  ENDPOINTS,
  ENDPOINT_RATE_LIMITS,
  ENDPOINT_UTILIZATION_PREFERENCE,
  ENABLED_SUBGRAPHS,
  ENDPOINT_SG_IDS
};