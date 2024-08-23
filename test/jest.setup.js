// Disables any discord messaging
jest.mock('../src/utils/discord', () => {});
// Disable LoggingUtil logs
jest.mock('../src/utils/logging');
// Disable bottleneck limiters
jest.mock('../src/utils/load/bottleneck-limiters', () => {});
