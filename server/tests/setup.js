// Setup file for Jest tests

// Mock dependencies
jest.mock('langchain/graph', () => require('./mocks/langchain'));
jest.mock('@langchain/openai', () => require('./mocks/openai'));
jest.mock('fs', () => {
  const originalFs = jest.requireActual('fs');
  return {
    ...originalFs,
    promises: {
      ...originalFs.promises,
      access: jest.fn().mockResolvedValue(true),
      readdir: jest.fn().mockResolvedValue([]),
      writeFile: jest.fn().mockResolvedValue(undefined),
      unlink: jest.fn().mockResolvedValue(undefined),
      stat: jest.fn().mockResolvedValue({ mtimeMs: Date.now() })
    },
    mkdirSync: jest.fn(),
    writeFileSync: jest.fn(),
    unlinkSync: jest.fn(),
    existsSync: jest.fn().mockReturnValue(true)
  };
});

// Increase timeout for all tests (useful for tests that involve DB operations)
jest.setTimeout(10000);

// Mock environment variables
process.env.OPENAI_API_KEY = 'test-api-key';
process.env.PORT = '3001';
process.env.DB_PATH = ':memory:'; // Use in-memory SQLite for tests
process.env.LOG_LEVEL = 'error';  // Reduce noise during tests
process.env.RETAIN_AUDIO_HOURS = '24';
process.env.ALERT_PHRASES = 'help,emergency,fire';

// Silence console output during tests (comment out for debugging)
global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
  // Keep error enabled for test debugging
  // error: jest.fn()
};