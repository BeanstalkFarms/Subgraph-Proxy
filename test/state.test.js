const { EnvUtil } = require('../src/utils/env');
const ChainState = require('../src/utils/state/chain');
const SubgraphState = require('../src/utils/state/subgraph');

describe('State: Derived functions', () => {
  beforeAll(() => {
    jest.spyOn(EnvUtil, 'endpointsForSubgraph').mockReturnValue([0, 1]);
  });

  test('Gets aggregate latest subgraph version', () => {
    SubgraphState.setEndpointVersion(0, 'bean', '2.1.0');
    SubgraphState.setEndpointVersion(0, 'beanstalk', '2.2.5');
    SubgraphState.setEndpointVersion(1, 'bean', '2.1.2');
    SubgraphState.setEndpointVersion(1, 'beanstalk', '1.2.4');

    expect(SubgraphState.getLatestVersion('bean')).toEqual('2.1.2');
    expect(SubgraphState.getLatestVersion('beanstalk')).toEqual('2.2.5');
  });
  test('Gets aggregate latest subgraph block', () => {
    SubgraphState.setEndpointBlock(0, 'bean', 28);
    SubgraphState.setEndpointBlock(0, 'beanstalk', 13);
    SubgraphState.setEndpointBlock(1, 'bean', 23);
    SubgraphState.setEndpointBlock(1, 'beanstalk', 19);

    expect(SubgraphState.getLatestBlock('bean')).toEqual(28);
    expect(SubgraphState.getLatestBlock('beanstalk')).toEqual(19);
  });
  test('Checks whether the endpoint is in sync', async () => {
    jest.spyOn(ChainState, 'getChainHead').mockResolvedValue(500);

    SubgraphState.setEndpointBlock(0, 'bean', 495);
    SubgraphState.setEndpointBlock(1, 'bean', 100);

    expect(await SubgraphState.isInSync(0, 'bean', 'ethereum')).toBeTruthy();
    expect(await SubgraphState.isInSync(1, 'bean', 'ethereum')).toBeFalsy();
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
  test('Can set endpoint timestamps', () => {
    const fakeNow = new Date(1700938811 * 1000);
    jest.useFakeTimers();
    jest.setSystemTime(fakeNow);

    SubgraphState.setLastEndpointStaleVersionTimestamp(0, 'bean');
    expect(SubgraphState.getLastEndpointStaleVersionTimestamp(0, 'bean')).toEqual(fakeNow);

    const fakeNow2 = new Date(1750938811 * 1000);
    jest.setSystemTime(fakeNow2);

    SubgraphState.setLastEndpointOutOfSyncTimestamp(0, 'bean');
    expect(SubgraphState.getLastEndpointStaleVersionTimestamp(0, 'bean')).toEqual(fakeNow);
    expect(SubgraphState.getLastEndpointOutOfSyncTimestamp(0, 'bean')).toEqual(fakeNow2);
  });
});
