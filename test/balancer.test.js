const EndpointBalanceUtil = require('../src/utils/load/endpoint-balance');
const ChainState = require('../src/utils/state/chain');
const SubgraphState = require('../src/utils/state/subgraph');

jest.mock('../src/utils/env', () => ({
  ENDPOINT_UTILIZATION_PREFERENCE: [0.8, 0.8],
  EnvUtil: {
    endpointsForSubgraph: jest.fn()
  }
}));
const { EnvUtil } = require('../src/utils/env');

jest.mock('../src/utils/load/bottleneck-limiters', () => ({
  isBurstDepleted: jest.fn(),
  getUtilization: jest.fn()
}));
const BottleneckLimiters = require('../src/utils/load/bottleneck-limiters');

// Strategy
// 1. If in blacklist or isBurstDepleted, avoid outright
// 2. If the subgraph has errors, is out of sync, or is not on the latest version,
//    avoid unless some time has passed since last result
// 3. If there are no options, re-consider whatever was removed in step (2)
// 4. If there are still multiple to choose from:
//  a. do not prefer according to (b) or (c) if >100% utilization for the endpoint they would choose
//  b. if an endpoint is in history but not blacklist, prefer that one again if its block >= the chain head
//  c. if both have a result within the last second, prefer one having a later block
//  d. prefer according to utilization

const fakeTimeNow = new Date(1700938811 * 1000);
const fakeTimePrev = new Date(1680938811 * 1000);

const mockEndpointErrors = (idx) => {
  jest.spyOn(SubgraphState, 'endpointHasErrors').mockImplementation((endpointIndex, _) => {
    return endpointIndex === idx;
  });
  jest.spyOn(SubgraphState, 'getLastEndpointErrorTimestamp').mockImplementation((endpointIndex, _) => {
    return endpointIndex === idx ? fakeTimeNow : undefined;
  });
};

const mockEndpointOutOfSync = (idx) => {
  jest.spyOn(SubgraphState, 'isInSync').mockImplementation((endpointIndex, _) => {
    return endpointIndex !== idx;
  });
  jest.spyOn(SubgraphState, 'getLastEndpointOutOfSyncTimestamp').mockImplementation((endpointIndex, _) => {
    return endpointIndex === idx ? fakeTimeNow : undefined;
  });
};

const mockEndpointOnStaleVersion = (idx) => {
  jest.spyOn(SubgraphState, 'isStaleVersion').mockImplementation((endpointIndex, _) => {
    return endpointIndex === idx;
  });
  jest.spyOn(SubgraphState, 'getLastEndpointStaleVersionTimestamp').mockImplementation((endpointIndex, _) => {
    return endpointIndex === idx ? fakeTimeNow : undefined;
  });
};

describe('Endpoint Balancer', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(EnvUtil, 'endpointsForSubgraph').mockReturnValue([0, 1]);
    // Utilization configured in env mocking above (not a mock function)

    jest.spyOn(ChainState, 'getChainHead').mockResolvedValue(500);
    jest.spyOn(SubgraphState, 'endpointHasErrors').mockReturnValue(false);
    jest.spyOn(SubgraphState, 'isInSync').mockReturnValue(true);
    jest.spyOn(SubgraphState, 'getEndpointVersion').mockReturnValue('1.0.0');
    jest.spyOn(SubgraphState, 'getLatestVersion').mockReturnValue('1.0.0');

    // Current utilization
    jest.spyOn(BottleneckLimiters, 'isBurstDepleted').mockReturnValue(false);
    jest.spyOn(BottleneckLimiters, 'getUtilization').mockImplementation((endpointIndex) => {
      return endpointIndex === 0 ? 0.2 : 0.2;
    });
  });

  test('Blacklisted endpoints are not selected', async () => {
    const blacklist = [];
    const choice1 = await EndpointBalanceUtil.chooseEndpoint('bean', blacklist);
    expect(choice1).not.toEqual(-1);
    expect(blacklist).not.toContain(choice1);

    blacklist.push(0);
    const choice2 = await EndpointBalanceUtil.chooseEndpoint('bean', blacklist);
    expect(choice2).not.toEqual(-1);
    expect(choice2).not.toEqual(choice1);
    expect(blacklist).not.toContain(choice2);

    blacklist.push(1);
    expect(await EndpointBalanceUtil.chooseEndpoint('bean', blacklist)).toEqual(-1);
  });

  describe('Prefers to avoid troublesome endpoints', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(fakeTimeNow);
    });

    test('Endpoints with errors are not selected unless time elapsed', async () => {
      mockEndpointErrors(0);
      const choice1 = await EndpointBalanceUtil.chooseEndpoint('bean');
      expect(choice1).toEqual(1);

      jest.setSystemTime(fakeTimePrev);
      const choice2 = await EndpointBalanceUtil.chooseEndpoint('bean');
      expect(choice2).toEqual(0);
    });
    test('Endpoints out of sync are not selected unless time elapsed', async () => {
      mockEndpointOutOfSync(0);
      const choice1 = await EndpointBalanceUtil.chooseEndpoint('bean');
      expect(choice1).toEqual(1);

      jest.setSystemTime(fakeTimePrev);
      const choice2 = await EndpointBalanceUtil.chooseEndpoint('bean');
      expect(choice2).toEqual(0);
    });
    test('Endpoints on older version are not selected unless time elapsed', async () => {
      mockEndpointOnStaleVersion(0);
      const choice1 = await EndpointBalanceUtil.chooseEndpoint('bean');
      expect(choice1).toEqual(1);

      jest.setSystemTime(fakeTimePrev);
      const choice2 = await EndpointBalanceUtil.chooseEndpoint('bean');
      expect(choice2).toEqual(0);
    });
  });

  describe('<100% utilized', () => {
    test('Endpoint under utilization preference cap is preferred', async () => {
      jest
        .spyOn(BottleneckLimiters, 'getUtilization')
        .mockResolvedValueOnce(0.5)
        .mockImplementation((endpointIndex) => {
          return endpointIndex === 0 ? 0.95 : 0.4;
        });
      expect(await EndpointBalanceUtil.chooseEndpoint('bean')).toEqual(0);
      expect(await EndpointBalanceUtil.chooseEndpoint('bean')).toEqual(1);
      expect(await EndpointBalanceUtil.chooseEndpoint('bean', [1])).toEqual(0);
    });

    test('Both above preference cap, underutilized endpoint is chosen', async () => {
      jest.spyOn(BottleneckLimiters, 'getUtilization').mockImplementation((endpointIndex) => {
        return endpointIndex === 0 ? 0.82 : 0.85;
      });
      expect(await EndpointBalanceUtil.chooseEndpoint('bean')).toEqual(0);
      expect(await EndpointBalanceUtil.chooseEndpoint('bean', [0])).toEqual(1);

      jest.spyOn(BottleneckLimiters, 'getUtilization').mockImplementation((endpointIndex) => {
        return endpointIndex === 0 ? 0.88 : 0.85;
      });
      expect(await EndpointBalanceUtil.chooseEndpoint('bean')).toEqual(1);
      expect(await EndpointBalanceUtil.chooseEndpoint('bean', [1])).toEqual(0);
    });

    test('Endpoint with latest block result is chosen', async () => {
      jest.spyOn(BottleneckLimiters, 'getUtilization').mockImplementation((endpointIndex) => {
        return endpointIndex === 0 ? 0.52 : 0.2;
      });
      jest.spyOn(SubgraphState, 'getEndpointBlock').mockImplementation((endpointIndex, _) => {
        return endpointIndex === 0 ? 499 : 500;
      });
      jest.spyOn(SubgraphState, 'getLastEndpointUsageTimestamp').mockReturnValue(fakeTimeNow);
      expect(await EndpointBalanceUtil.chooseEndpoint('bean')).toEqual(1);
      expect(await EndpointBalanceUtil.chooseEndpoint('bean', [1])).toEqual(0);

      // Same should occur even if utilization preference is exceeded (but not >100%)
      jest.spyOn(BottleneckLimiters, 'getUtilization').mockImplementation((endpointIndex) => {
        return endpointIndex === 0 ? 0.52 : 0.9;
      });
      expect(await EndpointBalanceUtil.chooseEndpoint('bean')).toEqual(1);
      expect(await EndpointBalanceUtil.chooseEndpoint('bean', [1])).toEqual(0);

      jest.spyOn(BottleneckLimiters, 'getUtilization').mockImplementation((endpointIndex) => {
        return endpointIndex === 0 ? 0.52 : 1.5;
      });
      expect(await EndpointBalanceUtil.chooseEndpoint('bean')).toEqual(0);
      expect(await EndpointBalanceUtil.chooseEndpoint('bean', [0])).toEqual(1);
    });

    test('Endpoint with latest block result is not chosen due to stale result', async () => {
      jest.spyOn(BottleneckLimiters, 'getUtilization').mockImplementation((endpointIndex) => {
        return endpointIndex === 0 ? 0.52 : 0.2;
      });
      jest.spyOn(SubgraphState, 'getEndpointBlock').mockImplementation((endpointIndex, _) => {
        return endpointIndex === 0 ? 499 : 500;
      });
      jest.spyOn(SubgraphState, 'getLastEndpointUsageTimestamp').mockImplementation((endpointIndex, _) => {
        return endpointIndex === 0 ? fakeTimeNow : fakeTimePrev;
      });
      expect(await EndpointBalanceUtil.chooseEndpoint('bean')).toEqual(0);
      expect(await EndpointBalanceUtil.chooseEndpoint('bean', [0])).toEqual(1);

      // Same should occur even if utilization preference is exceeded (but not >100%)
      jest.spyOn(BottleneckLimiters, 'getUtilization').mockImplementation((endpointIndex) => {
        return endpointIndex === 0 ? 0.92 : 0.3;
      });
      expect(await EndpointBalanceUtil.chooseEndpoint('bean')).toEqual(1);
      expect(await EndpointBalanceUtil.chooseEndpoint('bean', [1])).toEqual(0);

      jest.spyOn(BottleneckLimiters, 'getUtilization').mockImplementation((endpointIndex) => {
        return endpointIndex === 0 ? 0.52 : 1.5;
      });
      expect(await EndpointBalanceUtil.chooseEndpoint('bean')).toEqual(0);
      expect(await EndpointBalanceUtil.chooseEndpoint('bean', [0])).toEqual(1);
    });

    test('History endpoint is preferred to be re-queried', async () => {
      jest.spyOn(SubgraphState, 'getEndpointBlock').mockImplementation((endpointIndex, _) => {
        return endpointIndex === 0 ? 499 : 500;
      });
      expect(await EndpointBalanceUtil.chooseEndpoint('bean', [], [1])).toEqual(1);
      expect(await EndpointBalanceUtil.chooseEndpoint('bean', [1], [1])).toEqual(0);
    });

    test('History endpoint is not preferred to be re-queried', async () => {
      jest.spyOn(SubgraphState, 'getEndpointBlock').mockImplementation((endpointIndex, _) => {
        return endpointIndex === 0 ? 499 : 500;
      });
      expect(await EndpointBalanceUtil.chooseEndpoint('bean', [], [0])).toEqual(1);
      expect(await EndpointBalanceUtil.chooseEndpoint('bean', [1], [0])).toEqual(0);
    });
  });

  describe('>=100% utilized', () => {
    test('Lesser utilized endpoint is chosen', async () => {
      jest.spyOn(EndpointBalanceUtil, 'getSubgraphUtilization').mockResolvedValue({ 0: 2.5, 1: 6 });
      expect(await EndpointBalanceUtil.chooseEndpoint('bean')).toEqual(0);
      expect(await EndpointBalanceUtil.chooseEndpoint('bean', [0])).toEqual(1);
      expect(await EndpointBalanceUtil.chooseEndpoint('bean', [1])).toEqual(0);

      jest.spyOn(EndpointBalanceUtil, 'getSubgraphUtilization').mockResolvedValue({ 0: 8, 1: 1.5 });
      expect(await EndpointBalanceUtil.chooseEndpoint('bean')).toEqual(1);
      expect(await EndpointBalanceUtil.chooseEndpoint('bean', [0])).toEqual(1);
      expect(await EndpointBalanceUtil.chooseEndpoint('bean', [1])).toEqual(0);
    });
    test('No endpoint can be chosen', async () => {
      jest.spyOn(BottleneckLimiters, 'isBurstDepleted').mockReturnValue(true);
      expect(await EndpointBalanceUtil.chooseEndpoint('bean')).toEqual(-1);

      jest.spyOn(BottleneckLimiters, 'isBurstDepleted').mockImplementation((endpointIndex) => {
        return endpointIndex === 0;
      });
      expect(await EndpointBalanceUtil.chooseEndpoint('bean')).toEqual(1);
      expect(await EndpointBalanceUtil.chooseEndpoint('bean', [1])).toEqual(-1);
    });
  });

  describe('Last resort selections', () => {
    test('Chooses endpoint with errors if all remaining endpoints have recent errors', async () => {
      mockEndpointErrors(0);
      expect(await EndpointBalanceUtil.chooseEndpoint('bean')).toEqual(1);
      expect(await EndpointBalanceUtil.chooseEndpoint('bean', [1])).toEqual(0);
    });
    test('Chooses endpoint out of sync if all remaining endpoints are recently out of sync', async () => {
      mockEndpointOutOfSync(0);
      expect(await EndpointBalanceUtil.chooseEndpoint('bean')).toEqual(1);
      expect(await EndpointBalanceUtil.chooseEndpoint('bean', [1])).toEqual(0);
    });
    test('Chooses endpoint on older version if all remaining endpoints are recently on older version', async () => {
      mockEndpointOnStaleVersion(0);
      expect(await EndpointBalanceUtil.chooseEndpoint('bean')).toEqual(1);
      expect(await EndpointBalanceUtil.chooseEndpoint('bean', [1])).toEqual(0);
    });
  });
});
