const { EnvUtil } = require('../src/utils/env');
const EndpointBalanceUtil = require('../src/utils/load/endpoint-balance');
const SubgraphState = require('../src/utils/state/subgraph');

// Strategy
// 1. If in blacklist or isBurstDepleted, avoid outright
// 2. If the subgraph has errors, is out of sync, or is not on the latest version,
//    avoid unless some time has passed since last result
// 3. If there are still multiple to choose from:
//  a. do not prefer according to (b) or (c) if >100% utilization for the endpoint they would choose
//  b. if an endpoint is in history but not blacklist, prefer that one again if its block >= the chain head
//  c. if both have a result within the last second, prefer one having a later block
//  d. prefer according to utilization
// 4. If none could be selected, revisit step (3) with any that were removed in step (2)

describe('Endpoint Balancer', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(EnvUtil, 'endpointsForSubgraph').mockReturnValue([0, 1]);
    // TODO: configure utilization

    jest.spyOn(SubgraphState, 'endpointHasErrors').mockReturnValue(false);
    jest.spyOn(SubgraphState, 'isInSync').mockReturnValue(true);
    jest.spyOn(SubgraphState, 'getEndpointVersion').mockReturnValue('1.0.0');
    jest.spyOn(SubgraphState, 'getLatestVersion').mockReturnValue('1.0.0');
  });

  test('Blacklisted endpoints are not selected', async () => {
    const blacklist = [];
    const choice1 = EndpointBalanceUtil.chooseEndpoint('bean', blacklist);
    expect(choice1).not.toEqual(-1);
    expect(blacklist).not.toContain(choice1);

    blacklist.push(0);
    const choice2 = EndpointBalanceUtil.chooseEndpoint('bean', blacklist);
    expect(choice2).not.toEqual(-1);
    expect(choice2).not.toEqual(choice1);
    expect(blacklist).not.toContain(choice2);

    blacklist.push(1);
    expect(EndpointBalanceUtil.chooseEndpoint('bean', blacklist)).toEqual(-1);
  });

  test('Endpoints with errors are not selected unless time elapsed', async () => {
    // WIP
    const choice1 = EndpointBalanceUtil.chooseEndpoint('bean', []);
    expect(choice1).toEqual(1);

    const choice2 = EndpointBalanceUtil.chooseEndpoint('bean', []);
    expect(choice2).toEqual(0);
  });
  test('Endpoints out of sync are not selected unless time elapsed', async () => {});
  test('Endpoints on older version are not selected unless time elapsed', async () => {});

  test('<100% utilized: Underutilized endpoint is chosen', async () => {});
  test('<100% utilized: Endpoint is not selected due to exceeding utilization preference cap', async () => {});
  test('<100% utilized: Endpoint with latest block result is chosen', async () => {});
  test('<100% utilized: History endpoint is re-queried', async () => {});
  test('<100% utilized: History endpoint is not re-queried', async () => {});

  test('>=100% utilized: lesser utilized endpoint is chosen', async () => {});
  test('>=100% utilized: no endpoint can be chosen', async () => {});

  describe('Last resort selections', () => {
    test('Chooses endpoint with errors if all endpoints have errors', async () => {});
    test('Chooses endpoint out of sync if all endpoints are out of sync', async () => {});
    test('Chooses endpoint on older version if all remaining endpoints are ', async () => {});
  });
});
