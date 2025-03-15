// Setup file for client Jest tests

// Mock WebSocket
jest.mock('ws', () => {
  // Create a Jest mock function that will serve as our constructor
  const mockWebSocketConstructor = jest.fn();
  
  // Define the static properties
  mockWebSocketConstructor.CONNECTING = 0;
  mockWebSocketConstructor.OPEN = 1;
  mockWebSocketConstructor.CLOSING = 2;
  mockWebSocketConstructor.CLOSED = 3;
  
  return mockWebSocketConstructor;
});

// Mock mic
jest.mock('mic', () => {
  return jest.fn();
});

// Mock fs
jest.mock('fs', () => {
  const originalFs = jest.requireActual('fs');
  return {
    ...originalFs,
    writeFileSync: jest.fn(),
    copyFileSync: jest.fn(),
    existsSync: jest.fn().mockReturnValue(false),
    mkdirSync: jest.fn(),
    promises: {
      ...originalFs.promises,
      writeFile: jest.fn().mockResolvedValue(undefined)
    }
  };
});

// Mock child_process
jest.mock('child_process', () => {
  return {
    spawn: jest.fn()
  };
});

// Mock path.join to return predictable paths
jest.mock('path', () => {
  const originalPath = jest.requireActual('path');
  return {
    ...originalPath,
    join: jest.fn((...args) => args.join('/'))
  };
});

// Global timeout for tests
jest.setTimeout(10000);
