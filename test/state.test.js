const { EnvUtil } = require('../src/utils/env');
const ChainState = require('../src/utils/state/chain');
const SubgraphState = require('../src/utils/state/subgraph');

const fakeTime1 = new Date(1700938811 * 1000);
const fakeTime2 = new Date(1750938811 * 1000);

describe('State: Derived functions', () => {
  beforeAll(() => {
    jest.spyOn(EnvUtil, 'endpointsForSubgraph').mockReturnValue([0, 1]);
    jest.spyOn(ChainState, 'getChainHead').mockResolvedValue(500);
  });

  beforeEach(() => {
    // Reset static members between test
    for (const property of Object.keys(SubgraphState)) {
      SubgraphState[property] = {};
    }
  });

  test('Gets aggregate latest subgraph version', () => {
    SubgraphState.setEndpointVersion(0, 'bean', '2.1.0');
    SubgraphState.setEndpointVersion(0, 'beanstalk', '2.2.5');
    SubgraphState.setEndpointVersion(1, 'bean', '2.1.2');
    SubgraphState.setEndpointVersion(1, 'beanstalk', '1.2.4');

    expect(SubgraphState.getLatestVersion('bean')).toEqual('2.1.2');
    expect(SubgraphState.getLatestVersion('beanstalk')).toEqual('2.2.5');
  });
  test('Gets aggregate latest subgraph block', async () => {
    await SubgraphState.setEndpointBlock(0, 'bean', 28);
    await SubgraphState.setEndpointBlock(0, 'beanstalk', 13);
    await SubgraphState.setEndpointBlock(1, 'bean', 23);
    await SubgraphState.setEndpointBlock(1, 'beanstalk', 19);

    expect(SubgraphState.getLatestBlock('bean')).toEqual(28);
    expect(SubgraphState.getLatestBlock('beanstalk')).toEqual(19);
  });
  test('Checks whether the endpoint is in sync', async () => {
    await SubgraphState.setEndpointBlock(0, 'bean', 495);
    await SubgraphState.setEndpointBlock(1, 'bean', 100);

    expect(await SubgraphState.isInSync(0, 'bean')).toBeTruthy();
    expect(await SubgraphState.isInSync(1, 'bean')).toBeFalsy();
  });
  test('Checks whether all endpoints have errors', () => {
    SubgraphState.setEndpointHasErrors(0, 'beanstalk', true);
    SubgraphState.setEndpointHasErrors(1, 'beanstalk', true);

    SubgraphState.setEndpointHasErrors(0, 'bean', true);
    SubgraphState.setEndpointHasErrors(1, 'bean', false);

    expect(SubgraphState.allHaveErrors('beanstalk')).toBeTruthy();
    expect(SubgraphState.allHaveErrors('bean')).toBeFalsy();
    expect(SubgraphState.allHaveErrors('basin')).toBeFalsy();
  });
  describe('Timestamps', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(fakeTime1);
    });

    test('Can set endpoint timestamps', () => {
      SubgraphState.setLastEndpointStaleVersionTimestamp(0, 'bean');
      expect(SubgraphState.getLastEndpointStaleVersionTimestamp(0, 'bean')).toEqual(fakeTime1);

      jest.setSystemTime(fakeTime2);

      SubgraphState.setLastEndpointOutOfSyncTimestamp(0, 'bean');
      expect(SubgraphState.getLastEndpointStaleVersionTimestamp(0, 'bean')).toEqual(fakeTime1);
      expect(SubgraphState.getLastEndpointOutOfSyncTimestamp(0, 'bean')).toEqual(fakeTime2);
    });
    test('Endpoint timestamps get set under appropriate circumstances', async () => {
      expect(SubgraphState.getLastEndpointUsageTimestamp(0, 'bean')).toBeUndefined();
      SubgraphState.setLastEndpointUsageTimestamp(0, 'bean');
      expect(SubgraphState.getLastEndpointUsageTimestamp(0, 'bean')).toEqual(fakeTime1);

      expect(SubgraphState.getLastEndpointErrorTimestamp(0, 'bean')).toBeUndefined();
      SubgraphState.setEndpointHasErrors(0, 'bean', true);
      expect(SubgraphState.getLastEndpointErrorTimestamp(0, 'bean')).toEqual(fakeTime1);

      expect(SubgraphState.getLastEndpointOutOfSyncTimestamp(0, 'bean')).toBeUndefined();
      await SubgraphState.setEndpointBlock(0, 'bean', 15);
      expect(SubgraphState.getLastEndpointOutOfSyncTimestamp(0, 'bean')).toEqual(fakeTime1);

      expect(SubgraphState.getLastEndpointStaleVersionTimestamp(0, 'bean')).toBeUndefined();
      SubgraphState.setEndpointVersion(1, 'bean', '1.0.0');
      SubgraphState.setEndpointVersion(0, 'bean', '0.9.5');
      expect(SubgraphState.getLastEndpointStaleVersionTimestamp(0, 'bean')).toEqual(fakeTime1);
    });
  });
});
