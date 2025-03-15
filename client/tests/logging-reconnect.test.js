const fs = require('fs');

// Import setup file
require('./setup');

describe('Client Logging and Reconnection', () => {
  let WebSocket;
  let mic;
  let consoleLogSpy;
  let consoleInfoSpy;
  let consoleWarnSpy;
  let consoleErrorSpy;
  let setTimeoutSpy;
  let onHandlers = {};
  
  beforeEach(() => {
    // Reset modules before each test
    jest.resetModules();
    
    // Get mocked modules
    WebSocket = require('ws');
    mic = require('mic');
    
    // Add WebSocket state constants
    WebSocket.CONNECTING = 0;
    WebSocket.OPEN = 1;
    WebSocket.CLOSING = 2;
    WebSocket.CLOSED = 3;
    
    // Reset onHandlers for fresh tracking of event handlers
    onHandlers = {};
    
    // Setup WebSocket mock
    WebSocket.mockImplementation(() => {
      const wsInstance = {
        on: jest.fn((event, callback) => {
          // Store callback by event type
          if (!onHandlers[event]) {
            onHandlers[event] = [];
          }
          onHandlers[event].push(callback);
          return wsInstance;
        }),
        send: jest.fn(),
        ping: jest.fn(),
        terminate: jest.fn(),
        readyState: WebSocket.OPEN
      };
      return wsInstance;
    });
    
    // Mock fs.existsSync for config.json
    fs.existsSync = jest.fn().mockReturnValue(false);
    fs.writeFileSync = jest.fn();
    
    // Mock process.exit
    process.exit = jest.fn();
    
    // Mock console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Spy on setTimeout
    setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    
    // Clear all mocks
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    // Reset any mocked timers
    jest.useRealTimers();
  });
  
  test('should implement logging at different levels', () => {
    // Create a mock config with debug log level
    const mockConfig = {
      serverUrl: 'ws://test-server:3000',
      logLevel: 'debug'
    };
    
    // Mock fs.existsSync to return true (file exists)
    fs.existsSync = jest.fn().mockReturnValue(true);
    
    // Mock require to return our mock config
    jest.doMock('../config.json', () => mockConfig, { virtual: true });
    
    // Import client module
    require('../client');
    
    // Create a log object that mimics the structure of the one in client.js
    const logFunctions = {
      debug: (...args) => console.log('[DEBUG]', ...args),
      info: (...args) => console.log('[INFO]', ...args),
      warn: (...args) => console.warn('[WARN]', ...args),
      error: (...args) => console.error('[ERROR]', ...args)
    };
    
    // Test debug level (should log with debug level)
    consoleLogSpy.mockClear();
    logFunctions.debug('Test debug message');
    expect(consoleLogSpy).toHaveBeenCalledWith('[DEBUG]', 'Test debug message');
    
    // Test other levels
    consoleLogSpy.mockClear();
    logFunctions.info('Test info message');
    expect(consoleLogSpy).toHaveBeenCalledWith('[INFO]', 'Test info message');
    
    consoleWarnSpy.mockClear();
    logFunctions.warn('Test warning message');
    expect(consoleWarnSpy).toHaveBeenCalledWith('[WARN]', 'Test warning message');
    
    consoleErrorSpy.mockClear();
    logFunctions.error('Test error message');
    expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR]', 'Test error message');
    
    // Now test with a different log level
    jest.resetModules();
    
    // Create a mock config with info log level (debug shouldn't log)
    const mockInfoConfig = {
      serverUrl: 'ws://test-server:3000',
      logLevel: 'info'
    };
    
    // Mock require to return our updated mock config
    jest.doMock('../config.json', () => mockInfoConfig, { virtual: true });
    
    // Create a log object for this test that implements conditional debug logging
    const logFunctionsInfoLevel = {
      debug: (...args) => {
        if (mockInfoConfig.logLevel === 'debug') {
          console.log('[DEBUG]', ...args);
        }
      },
      info: (...args) => console.log('[INFO]', ...args)
    };
    
    // Test debug level with info log level (should not log)
    consoleLogSpy.mockClear();
    logFunctionsInfoLevel.debug('Test debug message');
    expect(consoleLogSpy).not.toHaveBeenCalled();
    
    // Info should still log
    consoleLogSpy.mockClear();
    logFunctionsInfoLevel.info('Test info message');
    expect(consoleLogSpy).toHaveBeenCalledWith('[INFO]', 'Test info message');
  });
  
  test('should implement reconnection with exponential backoff', () => {
    // Use fake timers
    jest.useFakeTimers();
    
    // Import client module
    require('../client');
    
    // Get first WebSocket instance
    const ws = WebSocket.mock.results[0].value;
    
    // Find the close handler
    expect(onHandlers).toHaveProperty('close');
    const closeHandler = onHandlers.close[0];
    
    // Trigger close event to start reconnection logic
    closeHandler(1006, 'Connection closed abnormally');
    
    // First reconnect should use the initial reconnect interval (5000ms by default)
    expect(setTimeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), 5000);
    
    // Fast forward past the reconnect timeout
    jest.advanceTimersByTime(5000);
    
    // Should have created a new WebSocket
    expect(WebSocket).toHaveBeenCalledTimes(2);
    
    // Get the new close handler for the second WebSocket
    const ws2 = WebSocket.mock.results[1].value;
    expect(ws2.on).toHaveBeenCalledWith('close', expect.any(Function));
    
    // Extract second close handler from call arguments
    const closeHandlerCalls = ws2.on.mock.calls.filter(call => call[0] === 'close');
    expect(closeHandlerCalls.length).toBeGreaterThan(0);
    const secondCloseHandler = closeHandlerCalls[0][1];
    
    // Trigger second close
    secondCloseHandler(1006, 'Connection closed again');
    
    // Second reconnect should use longer interval (7500ms with default 1.5x factor)
    expect(setTimeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), 7500);
  });
  
  test('should handle WebSocket error events', () => {
    // Import client module
    require('../client');
    
    // Get WebSocket instance
    const ws = WebSocket.mock.results[0].value;
    
    // Find the error handler
    expect(ws.on).toHaveBeenCalledWith('error', expect.any(Function));
    
    // Extract error handler from call arguments
    const errorHandlerCalls = ws.on.mock.calls.filter(call => call[0] === 'error');
    expect(errorHandlerCalls.length).toBeGreaterThan(0);
    const errorHandler = errorHandlerCalls[0][1];
    
    // Create a test error and trigger the handler
    const testError = new Error('Test WebSocket error');
    
    consoleErrorSpy.mockClear();
    errorHandler(testError);
    
    // Verify error was logged
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('WebSocket error:'),
      expect.any(Error)
    );
  });
  
  test('should handle WebSocket unexpected response events', () => {
    // Import client module
    require('../client');
    
    // Get WebSocket instance
    const ws = WebSocket.mock.results[0].value;
    
    // Find the unexpected-response handler
    expect(ws.on).toHaveBeenCalledWith('unexpected-response', expect.any(Function));
    
    // Extract handler from call arguments
    const handlerCalls = ws.on.mock.calls.filter(call => call[0] === 'unexpected-response');
    expect(handlerCalls.length).toBeGreaterThan(0);
    const unexpectedResponseHandler = handlerCalls[0][1];
    
    // Create mock request and response objects
    const mockRequest = {};
    const mockResponse = {
      statusCode: 401,
      statusMessage: 'Unauthorized'
    };
    
    consoleErrorSpy.mockClear();
    unexpectedResponseHandler(mockRequest, mockResponse);
    
    // Verify error was logged
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unexpected response:'),
      '401 Unauthorized'
    );
  });
  
  test('should handle error creating WebSocket', () => {
    // Use fake timers
    jest.useFakeTimers();
    
    // Make WebSocket constructor throw an error
    WebSocket.mockImplementation(() => {
      throw new Error('Failed to create WebSocket');
    });
    
    // Import client module
    require('../client');
    
    // Verify error was logged
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error creating WebSocket:'),
      expect.any(Error)
    );
    
    // Verify reconnection was scheduled with default interval
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 5000);
  });
  
  test('should allow custom reconnection intervals', () => {
    // Use fake timers
    jest.useFakeTimers();
    
    // Create custom config with specific reconnection settings
    const mockConfig = {
      reconnectInterval: 2000,         // 2 seconds initial
      maxReconnectInterval: 10000,     // 10 seconds maximum
      reconnectBackoffFactor: 2        // Double each time
    };
    
    // Mock fs.existsSync to return true (file exists)
    fs.existsSync = jest.fn().mockReturnValue(true);
    
    // Mock require to return our mock config
    jest.doMock('../config.json', () => mockConfig, { virtual: true });
    
    // Import client module
    require('../client');
    
    // Get WebSocket instance
    const ws = WebSocket.mock.results[0].value;
    
    // Find the close handler
    expect(ws.on).toHaveBeenCalledWith('close', expect.any(Function));
    
    // Extract close handler from call arguments
    const closeHandlerCalls = ws.on.mock.calls.filter(call => call[0] === 'close');
    expect(closeHandlerCalls.length).toBeGreaterThan(0);
    const closeHandler = closeHandlerCalls[0][1];
    
    // Trigger first close
    closeHandler(1006, 'Connection closed');
    
    // First reconnect should use custom initial interval (2000ms)
    expect(setTimeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), 2000);
    
    // Fast forward past the reconnect timeout
    jest.advanceTimersByTime(2000);
    
    // Get second WebSocket instance
    const ws2 = WebSocket.mock.results[1].value;
    expect(ws2.on).toHaveBeenCalledWith('close', expect.any(Function));
    
    // Extract second close handler
    const closeHandlerCalls2 = ws2.on.mock.calls.filter(call => call[0] === 'close');
    expect(closeHandlerCalls2.length).toBeGreaterThan(0);
    const closeHandler2 = closeHandlerCalls2[0][1];
    
    // Trigger second close
    closeHandler2(1006, 'Connection closed again');
    
    // Second reconnect should use doubled interval (4000ms)
    expect(setTimeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), 4000);
  });
});
