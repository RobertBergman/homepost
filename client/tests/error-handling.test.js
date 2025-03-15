const fs = require('fs');
const path = require('path');

// Import setup file
require('./setup');

describe('Client Error Handling', () => {
  let originalExit;
  let originalOn;
  let WebSocket;
  let writeFileSpy;
  let processHandlers = {};
  
  beforeEach(() => {
    // Reset modules before each test
    jest.resetModules();
    
    // Get mocked modules
    WebSocket = require('ws');
    
    // Mock process.exit and store original
    originalExit = process.exit;
    process.exit = jest.fn();
    
    // Mock process.on and store original
    originalOn = process.on;
    
    // Reset processHandlers for this test
    processHandlers = {};
    
    // Mock process.on to capture handlers in our object
    process.on = jest.fn((signal, handler) => {
      processHandlers[signal] = handler;
    });
    
    // Add dummy WebSocket readyState values
    WebSocket.CONNECTING = 0;
    WebSocket.OPEN = 1;
    WebSocket.CLOSING = 2;
    WebSocket.CLOSED = 3;
    
    // Create basic WebSocket mock
    WebSocket.mockImplementation(() => {
      return {
        on: jest.fn(),
        send: jest.fn(),
        terminate: jest.fn(),
        readyState: WebSocket.OPEN
      };
    });
    
    // Mock fs.existsSync for config.json
    fs.existsSync = jest.fn().mockReturnValue(false);
    fs.writeFileSync = jest.fn();
    writeFileSpy = jest.spyOn(fs, 'writeFileSync');
    
    // Clear console mocks
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Mock mic
    const mic = require('mic');
    mic.mockImplementation(() => ({
      start: jest.fn(),
      stop: jest.fn(),
      getAudioStream: jest.fn().mockReturnValue({
        on: jest.fn()
      })
    }));
    
    // Clear all mocks
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    // Restore original process methods
    process.exit = originalExit;
    process.on = originalOn;
    
    // Reset any mocked timers
    jest.useRealTimers();
  });
  
  test('should register process signal handlers', () => {
    // Import client module
    require('../client');
    
    // Verify that signal handlers were registered
    expect(process.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    expect(process.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    expect(process.on).toHaveBeenCalledWith('SIGHUP', expect.any(Function));
    
    // Verify handlers were captured
    expect(processHandlers).toHaveProperty('SIGINT');
    expect(processHandlers).toHaveProperty('SIGTERM');
    expect(processHandlers).toHaveProperty('SIGHUP');
  });
  
  test('should handle process signals gracefully', () => {
    // Use fake timers
    jest.useFakeTimers();
    
    // Mock for mic object to test shutdown
    const mockMicStop = jest.fn();
    const mic = require('mic');
    mic.mockImplementation(() => ({
      start: jest.fn(),
      stop: mockMicStop,
      getAudioStream: jest.fn().mockReturnValue({
        on: jest.fn()
      })
    }));
    
    // Import client module
    require('../client');
    
    // Make sure we have captured the SIGINT handler
    expect(processHandlers).toHaveProperty('SIGINT');
    
    // Trigger the SIGINT handler
    processHandlers.SIGINT();
    
    // Advance timer to check for process.exit call
    jest.advanceTimersByTime(1100);
    
    // Verify process.exit was called
    expect(process.exit).toHaveBeenCalledWith(0);
  });
  
  test('should register uncaught exception handler', () => {
    // Import client module
    require('../client');
    
    // Verify that uncaught exception handler was registered
    expect(process.on).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
    
    // Verify handler was captured
    expect(processHandlers).toHaveProperty('uncaughtException');
  });
  
  test('should handle uncaught exceptions by writing crash log', () => {
    // Use fake timers
    jest.useFakeTimers();
    
    // Create a test error
    const testError = new Error('Test uncaught exception');
    testError.stack = 'Error: Test uncaught exception\n    at test:1:1';
    
    // Import client module
    require('../client');
    
    // Make sure we have captured the handler
    expect(processHandlers).toHaveProperty('uncaughtException');
    
    // Trigger the uncaught exception handler
    processHandlers.uncaughtException(testError);
    
    // Check that crash log was written
    expect(writeFileSpy).toHaveBeenCalled();
    
    // Get the crash log content
    const crashLogContent = JSON.parse(writeFileSpy.mock.calls[0][1]);
    
    // Verify crash log structure
    expect(crashLogContent).toHaveProperty('timestamp');
    expect(crashLogContent).toHaveProperty('error');
    expect(crashLogContent.error).toHaveProperty('name', 'Error');
    expect(crashLogContent.error).toHaveProperty('message', 'Test uncaught exception');
    expect(crashLogContent.error).toHaveProperty('stack');
    
    // Advance timer to check for process.exit call
    jest.advanceTimersByTime(1100);
    
    // Verify process.exit was called
    expect(process.exit).toHaveBeenCalledWith(0);
  });
  
  test('should register unhandled rejection handler', () => {
    // Import client module
    require('../client');
    
    // Verify that unhandled rejection handler was registered
    expect(process.on).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
    
    // Verify handler was captured
    expect(processHandlers).toHaveProperty('unhandledRejection');
  });
  
  test('should handle unhandled rejections by writing rejection log', () => {
    // Create a test rejection reason
    const testReason = new Error('Test unhandled rejection');
    testReason.stack = 'Error: Test unhandled rejection\n    at Promise:1:1';
    
    // Import client module
    require('../client');
    
    // Make sure we have captured the handler
    expect(processHandlers).toHaveProperty('unhandledRejection');
    
    // Trigger the unhandled rejection handler with a mock promise
    processHandlers.unhandledRejection(testReason, Promise.resolve());
    
    // Check that rejection log was written
    expect(writeFileSpy).toHaveBeenCalled();
    
    // Get the rejection log content
    const rejectionLogContent = JSON.parse(writeFileSpy.mock.calls[0][1]);
    
    // Verify rejection log structure
    expect(rejectionLogContent).toHaveProperty('timestamp');
    expect(rejectionLogContent).toHaveProperty('reason');
    expect(rejectionLogContent).toHaveProperty('stack');
  });
  
  test('should handle errors during crash log writing', () => {
    // Use fake timers
    jest.useFakeTimers();
    
    // Force writeFileSync to throw an error
    fs.writeFileSync.mockImplementation(() => {
      throw new Error('Disk full');
    });
    
    // Spy on console.error
    const errorSpy = jest.spyOn(console, 'error');
    
    // Import client module
    require('../client');
    
    // Make sure we have captured the handler
    expect(processHandlers).toHaveProperty('uncaughtException');
    
    // Trigger the uncaught exception handler
    processHandlers.uncaughtException(new Error('Test error'));
    
    // Verify that the error during writing was logged
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to write crash log:',
      expect.any(Error)
    );
    
    // Advance timer to check for process.exit call
    jest.advanceTimersByTime(1100);
    
    // Process should still exit
    expect(process.exit).toHaveBeenCalledWith(0);
  });
  
  test('should clean up resources during shutdown', () => {
    // Use fake timers
    jest.useFakeTimers();
    
    // Mock clearInterval and clearTimeout
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    
    // Import client module - this will set up some intervals/timeouts
    require('../client');
    
    // Verify handler registration
    expect(processHandlers).toHaveProperty('SIGTERM');
    
    // Trigger shutdown
    processHandlers.SIGTERM();
    
    // Advance timer to check for process.exit call
    jest.advanceTimersByTime(1100);
    
    // Verify process.exit was called
    expect(process.exit).toHaveBeenCalledWith(0);
  });
});
