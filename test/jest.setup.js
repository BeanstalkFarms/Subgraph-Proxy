// Disables any discord messaging
jest.mock('../src/utils/discord');
// Disable LoggingUtil logs
jest.mock('../src/utils/logging');
// Disable bottleneck limiters. Mock entire module so the static initializer does not execute
jest.mock('../src/utils/load/bottleneck-limiters', () => {
  return {};
});
