const SemVerUtil = require('../src/utils/semver');

describe('Utils', () => {
  test('semver comparison', () => {
    expect(SemVerUtil.compareVersions('2.4.1', '2.3.1')).toEqual(1);
    expect(SemVerUtil.compareVersions('2.4.1', '2.3.2')).toEqual(1);
    expect(SemVerUtil.compareVersions('2.3.1', '2.3.2')).toEqual(-1);
    expect(SemVerUtil.compareVersions('2.3.2', '2.3.2.1')).toEqual(-1);
    expect(SemVerUtil.compareVersions('2.3.2', '2.3.2.0')).toEqual(0);
    expect(SemVerUtil.compareVersions('2.3.2', '2.3.2-label')).toEqual(0);
  });
});
