const { Buffer } = require('buffer');

// Import setup file
require('./setup');

describe('Client Audio Processing', () => {
  let WebSocket;
  let mic;
  let mockMicStart;
  let mockMicStop;
  let mockInputStream;
  let mockWsSend;
  let fs;
  
  beforeEach(() => {
    // Reset modules before each test
    jest.resetModules();
    
    // Get mocked modules
    WebSocket = require('ws');
    mic = require('mic');
    fs = require('fs');
    
    // Create mock functions
    mockMicStart = jest.fn();
    mockMicStop = jest.fn();
    mockWsSend = jest.fn();
    
    // Create mock event emitter for mic input stream
    mockInputStream = {
      on: jest.fn(),
      emit: jest.fn()
    };
    
    // Configure mic mock
    mic.mockImplementation(() => ({
      start: mockMicStart,
      stop: mockMicStop,
      getAudioStream: () => mockInputStream
    }));
    
    // Mock WebSocket implementation that triggers audio capture
    WebSocket.mockImplementation(() => {
      return {
        on: jest.fn((event, callback) => {
          if (event === 'open') {
            // Store open handler for later use
            WebSocket.openHandler = callback;
          } else if (event === 'close') {
            // Store close handler for later use
            WebSocket.closeHandler = callback;
          }
        }),
        send: mockWsSend,
        readyState: 1 // OPEN by default
      };
    });
    
    // Mock fs.existsSync for config.json
    fs.existsSync = jest.fn().mockReturnValue(false);
    fs.writeFileSync = jest.fn();
    
    // Mock process.exit
    process.exit = jest.fn();
    
    // Clear other mocks
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    // Reset any mocked timers
    jest.useRealTimers();
  });
  
  test('should start audio capture after WebSocket connection is established', () => {
    // Import client module
    require('../client');
    
    // Simulate connection open event
    WebSocket.openHandler();
    
    // Verify mic instance was started
    expect(mockMicStart).toHaveBeenCalled();
  });
  
  test('should buffer audio data before sending', () => {
    // Use fake timers
    jest.useFakeTimers();
    
    // Mock audio data events
    let dataHandler;
    mockInputStream.on.mockImplementation((event, handler) => {
      if (event === 'data') {
        dataHandler = handler;
      }
    });
    
    // Import client module
    require('../client');
    
    // Simulate connection open event to start audio capture
    WebSocket.openHandler();
    
    // Get the data handler registered with the mic input stream
    expect(mockInputStream.on).toHaveBeenCalledWith('data', expect.any(Function));
    
    // Ensure dataHandler was captured
    expect(dataHandler).toBeDefined();
    
    // Simulate receiving audio data that's smaller than the chunk size
    // Default audioChunkSize is 4096 in the client configuration
    const smallAudioData = Buffer.from(new Uint8Array(1000));
    dataHandler(smallAudioData);
    
    // Verify that no data was sent yet (should be buffered)
    expect(mockWsSend).not.toHaveBeenCalled();
    
    // Simulate receiving more audio data to exceed the chunk size
    const largeAudioData = Buffer.from(new Uint8Array(4000));
    dataHandler(largeAudioData);
    
    // Now verify that data was sent
    expect(mockWsSend).toHaveBeenCalled();
    
    // Parse the sent message
    const sentMessage = JSON.parse(mockWsSend.mock.calls[0][0]);
    
    // Verify message structure
    expect(sentMessage).toEqual(expect.objectContaining({
      type: 'audio_data',
      deviceId: expect.any(String),
      timestamp: expect.any(Number),
      data: expect.any(String) // Base64-encoded audio data
    }));
  });
  
  test('should periodically send audio data even if chunk size is not reached', () => {
    // Use fake timers
    jest.useFakeTimers();
    
    // Mock audio data events
    let dataHandler;
    mockInputStream.on.mockImplementation((event, handler) => {
      if (event === 'data') {
        dataHandler = handler;
      }
    });
    
    // Import client module
    require('../client');
    
    // Simulate connection open event to start audio capture
    WebSocket.openHandler();
    
    // Get the data handler registered with the mic input stream
    expect(mockInputStream.on).toHaveBeenCalledWith('data', expect.any(Function));
    
    // Ensure dataHandler was captured
    expect(dataHandler).toBeDefined();
    
    // Simulate receiving small audio data
    const smallAudioData = Buffer.from(new Uint8Array(100));
    dataHandler(smallAudioData);
    
    // Verify that no data was sent yet (should be buffered)
    expect(mockWsSend).not.toHaveBeenCalled();
    
    // Fast-forward past audioSendInterval (default 500ms)
    jest.advanceTimersByTime(600);
    
    // Now verify that data was sent even though it's small
    expect(mockWsSend).toHaveBeenCalled();
    
    // Parse the sent message
    const sentMessage = JSON.parse(mockWsSend.mock.calls[0][0]);
    
    // Verify message structure
    expect(sentMessage).toEqual(expect.objectContaining({
      type: 'audio_data',
      deviceId: expect.any(String),
      timestamp: expect.any(Number),
      data: expect.any(String) // Base64-encoded audio data
    }));
  });
  
  test('should stop audio capture when connection closes', () => {
    // Import client module
    require('../client');
    
    // Simulate connection open event to start audio capture
    WebSocket.openHandler();
    
    // Verify mic instance was started
    expect(mockMicStart).toHaveBeenCalled();
    
    // Simulate connection close event
    WebSocket.closeHandler(1000, 'Normal closure');
    
    // Verify mic instance was stopped
    expect(mockMicStop).toHaveBeenCalled();
  });
  
  test('should handle errors in the microphone stream', () => {
    // Spy on console.error
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Mock audio error events
    let errorHandler;
    mockInputStream.on.mockImplementation((event, handler) => {
      if (event === 'error') {
        errorHandler = handler;
      }
    });
    
    // Import client module
    require('../client');
    
    // Simulate connection open event to start audio capture
    WebSocket.openHandler();
    
    // Get the error handler registered with the mic input stream
    expect(mockInputStream.on).toHaveBeenCalledWith('error', expect.any(Function));
    
    // Ensure errorHandler was captured
    expect(errorHandler).toBeDefined();
    
    // Simulate error in mic stream
    const testError = new Error('Microphone error');
    errorHandler(testError);
    
    // Verify error was logged
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error in microphone input stream:'),
      testError
    );
  });
  
  test('should not send audio data if connection is closed', () => {
    // Mock audio data events
    let dataHandler;
    mockInputStream.on.mockImplementation((event, handler) => {
      if (event === 'data') {
        dataHandler = handler;
      }
    });
    
    // Create WebSocket object with CLOSED state
    WebSocket.mockImplementation(() => {
      return {
        on: jest.fn(),
        send: mockWsSend,
        readyState: 3 // CLOSED
      };
    });
    
    // Import client module
    require('../client');
    
    // Simulate audio data with closed connection
    const audioData = Buffer.from(new Uint8Array(5000));
    dataHandler(audioData);
    
    // Verify no data was sent (since connection is closed)
    expect(mockWsSend).not.toHaveBeenCalled();
  });
});
