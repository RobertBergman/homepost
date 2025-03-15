const fs = require('fs');
const path = require('path');

// Import setup file
require('./setup');

describe('Client WebSocket Connection', () => {
  let originalExit;
  let WebSocket;
  
  beforeEach(() => {
    // Reset modules before each test to get a fresh instance
    jest.resetModules();
    
    // Get the mocked WebSocket constructor
    WebSocket = require('ws');
    
    // Mock process.exit so tests don't exit
    originalExit = process.exit;
    process.exit = jest.fn();
    
    // Mock fs.existsSync for config.json
    fs.existsSync = jest.fn().mockReturnValue(false);
    fs.writeFileSync = jest.fn();
    
    // Clear all mocks
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    // Restore process.exit
    process.exit = originalExit;
    
    // Reset any mocked timers
    jest.useRealTimers();
  });
  
  test('should connect to the server with default configuration', () => {
    // Import client module
    require('../client');
    
    // Verify that client attempts to connect to the default server URL
    expect(WebSocket).toHaveBeenCalledWith(
      'ws://192.168.1.100:3000',
      expect.objectContaining({
        handshakeTimeout: 10000,
        perMessageDeflate: true
      })
    );
  });
  
  test('should use environment variables when provided', () => {
    // Set environment variables
    process.env.HOMEPOST_SERVER_URL = 'ws://test-server:4000';
    process.env.HOMEPOST_DEVICE_ID = 'test-device';
    
    // Import client module
    require('../client');
    
    // Verify that client uses environment variables
    expect(WebSocket).toHaveBeenCalledWith(
      'ws://test-server:4000',
      expect.any(Object)
    );
  });
  
  test('should send device_info message upon connection', () => {
    // Create a mock instance that will be returned by the WebSocket constructor
    const mockWsSend = jest.fn();
    WebSocket.mockImplementation(() => {
      return {
        on: jest.fn((event, callback) => {
          if (event === 'open') {
            // Call the open callback right away for testing
            callback();
          }
        }),
        send: mockWsSend,
        readyState: 1 // OPEN
      };
    });
    
    // Import client module
    require('../client');
    
    // Check that send was called with device_info message
    expect(mockWsSend).toHaveBeenCalled();
    
    // Parse the sent message
    const sentMessage = JSON.parse(mockWsSend.mock.calls[0][0]);
    
    // Verify message structure
    expect(sentMessage).toEqual(expect.objectContaining({
      type: 'device_info',
      deviceId: expect.any(String),
      capabilities: expect.objectContaining({
        audio: expect.any(Boolean)
      })
    }));
  });
  
  test('should implement reconnection with backoff', () => {
    // Use fake timers
    jest.useFakeTimers();
    
    // Spy on setTimeout
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    
    // Setup WebSocket with close event
    WebSocket.mockImplementation(() => {
      const mockWs = {
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            // Store the close handler for later use
            mockWs.closeHandler = callback;
          }
        }),
        send: jest.fn(),
        readyState: 1 // OPEN
      };
      return mockWs;
    });
    
    // Import client module
    const mockWs = require('../client');
    
    // Get the instance returned by the WebSocket constructor
    const ws = WebSocket.mock.results[0].value;
    
    // Trigger the close event
    ws.closeHandler(1006, 'Connection closed abnormally');
    
    // Verify setTimeout was called (for reconnection)
    expect(setTimeoutSpy).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Number)
    );
  });
  
  test('should handle server pong messages', () => {
    // Create a mock WebSocket instance
    const mockWs = {
      on: jest.fn((event, callback) => {
        if (event === 'pong') {
          // Store the pong handler for later use
          mockWs.pongHandler = callback;
        }
      }),
      send: jest.fn(),
      readyState: 1 // OPEN
    };
    
    WebSocket.mockImplementation(() => mockWs);
    
    // Import client module
    require('../client');
    
    // Verify that pong event handler was registered
    expect(mockWs.on).toHaveBeenCalledWith('pong', expect.any(Function));
  });
  
  test('should send heartbeats at regular intervals', () => {
    // Use fake timers
    jest.useFakeTimers();
    
    // Create a ping spy
    const mockPing = jest.fn();
    
    // Setup WebSocket with open event
    WebSocket.mockImplementation(() => {
      const mockWs = {
        on: jest.fn((event, callback) => {
          if (event === 'open') {
            // Call the open callback right away for testing
            callback();
          }
        }),
        ping: mockPing,
        send: jest.fn(),
        readyState: 1 // OPEN
      };
      return mockWs;
    });
    
    // Import client module
    require('../client');
    
    // Fast-forward past heartbeat interval (30 seconds)
    jest.advanceTimersByTime(30000);
    
    // Verify that ping is sent
    expect(mockPing).toHaveBeenCalled();
  });
});
