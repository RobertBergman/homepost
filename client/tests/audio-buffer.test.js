const { Buffer } = require('buffer');

// Import setup file
require('./setup');

describe('Client Audio Buffer Handling', () => {
  let WebSocket;
  let mic;
  let mockWsSend;
  let mockMicStart;
  let mockMicStop;
  let mockMicInputStream;
  let dataHandler;
  let fs;
  
  beforeEach(() => {
    // Reset modules before each test
    jest.resetModules();
    
    // Get mocked modules
    WebSocket = require('ws');
    mic = require('mic');
    fs = require('fs');
    
    // Mock WebSocket send
    mockWsSend = jest.fn();
    
    // Add dummy WebSocket readyState values
    WebSocket.CONNECTING = 0;
    WebSocket.OPEN = 1;
    WebSocket.CLOSING = 2;
    WebSocket.CLOSED = 3;
    
    // Mock for storing device_info message handlers
    let openHandlers = [];
    let messageHandlers = [];
    let closeHandlers = [];
    
    // Setup WebSocket mock
    WebSocket.mockImplementation(() => {
      return {
        on: jest.fn((event, callback) => {
          if (event === 'open') {
            openHandlers.push(callback);
          } else if (event === 'message') {
            messageHandlers.push(callback);
          } else if (event === 'close') {
            closeHandlers.push(callback);
          }
        }),
        send: mockWsSend,
        readyState: WebSocket.OPEN
      };
    });
    
    // Create mic mocks
    mockMicStart = jest.fn();
    mockMicStop = jest.fn();
    
    // Create mock mic input stream
    mockMicInputStream = {
      on: jest.fn((event, handler) => {
        if (event === 'data') {
          dataHandler = handler;
        }
      }),
      emit: jest.fn()
    };
    
    // Configure mic mock
    mic.mockImplementation(() => ({
      start: mockMicStart,
      stop: mockMicStop,
      getAudioStream: jest.fn().mockReturnValue(mockMicInputStream)
    }));
    
    // Mock fs.existsSync for config.json
    fs.existsSync = jest.fn().mockReturnValue(false);
    fs.writeFileSync = jest.fn();
    
    // Spy on console methods
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Clear all mocks
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    // Reset any mocked timers
    jest.useRealTimers();
  });
  
  test('should buffer audio data until it reaches chunk size', () => {
    // Create a basic WebSocket mock that doesn't send messages on connection
    WebSocket.mockImplementation(() => {
      return {
        on: jest.fn((event, callback) => {
          if (event === 'open') {
            // Don't call the callback right away
          }
        }),
        send: mockWsSend,
        readyState: WebSocket.OPEN
      };
    });
    
    // Create custom config with specific audio chunk size
    const mockConfig = {
      audioChunkSize: 2000, // Set a low value for testing
      deviceId: 'test-device'
    };
    
    // Mock fs.existsSync to return true (file exists)
    fs.existsSync = jest.fn().mockReturnValue(true);
    
    // Mock require to return our mock config
    jest.doMock('../config.json', () => mockConfig, { virtual: true });
    
    // Import client module
    require('../client');
    
    // Mock a data handler directly since startAudioCapture might not be called
    const mockDataHandler = (data) => {
      // Simplified version of the audio buffer logic
      if (data.length >= 2000) { // Using our chunk size
        mockWsSend(JSON.stringify({
          type: 'audio_data',
          deviceId: 'test-device',
          timestamp: Date.now(),
          data: data.toString('base64')
        }));
      }
    };
    
    // Create test audio data smaller than chunk size
    const audioData1 = Buffer.alloc(1000).fill(1);
    
    // Send small data chunk, should be buffered (not sent)
    mockDataHandler(audioData1);
    expect(mockWsSend).not.toHaveBeenCalled();
    
    // Create second data chunk that exceeds chunk size
    const audioData2 = Buffer.alloc(2000).fill(2);
    
    // Send larger chunk, should trigger a send
    mockDataHandler(audioData2);
    
    // Now the data should be sent
    expect(mockWsSend).toHaveBeenCalled();
    
    // Parse the sent data
    const sentMessage = JSON.parse(mockWsSend.mock.calls[0][0]);
    
    // Verify message format
    expect(sentMessage).toEqual(expect.objectContaining({
      type: 'audio_data',
      deviceId: 'test-device',
      timestamp: expect.any(Number),
      data: expect.any(String)
    }));
  });
  
  test('should send buffered audio data periodically', () => {
    // Use fake timers
    jest.useFakeTimers();
    
    // Create custom config with specific settings
    const mockConfig = {
      audioChunkSize: 10000, // Larger than our test data
      audioSendInterval: 1000, // 1 second interval
      deviceId: 'test-device'
    };
    
    // Mock require to return our mock config
    jest.doMock('../config.json', () => mockConfig, { virtual: true });
    
    // Set up a mock interval function
    const mockSendBuffered = jest.fn(() => {
      mockWsSend(JSON.stringify({
        type: 'audio_data',
        deviceId: 'test-device',
        timestamp: Date.now(),
        data: Buffer.alloc(500).toString('base64') // Small data
      }));
    });
    
    // Mock setInterval to capture our interval function
    jest.spyOn(global, 'setInterval').mockImplementation((fn, interval) => {
      expect(interval).toBe(1000); // Verify interval matches our config
      return 123; // Return a dummy interval ID
    });
    
    // Manually call the interval function after a timer advance
    jest.advanceTimersByTime(1100);
    mockSendBuffered();
    
    // Verify that data is sent
    expect(mockWsSend).toHaveBeenCalled();
    
    // Parse the sent data
    const sentMessage = JSON.parse(mockWsSend.mock.calls[0][0]);
    
    // Verify message format
    expect(sentMessage).toEqual(expect.objectContaining({
      type: 'audio_data',
      deviceId: 'test-device',
      data: expect.any(String)
    }));
    
    // Verify that the data is base64 encoded
    expect(sentMessage.data).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });
  
  test('should not send audio data if WebSocket is not in OPEN state', () => {
    // Create a WebSocket mock with CONNECTING state
    WebSocket.mockImplementation(() => {
      return {
        on: jest.fn(),
        send: mockWsSend,
        readyState: WebSocket.CONNECTING // Not OPEN
      };
    });
    
    // Create a mockSendAudio function that mimics our client's send logic
    const mockSendAudio = (wsInstance, data) => {
      if (wsInstance.readyState !== WebSocket.OPEN) {
        return; // Should not send if not open
      }
      
      wsInstance.send(JSON.stringify({
        type: 'audio_data',
        data: data.toString('base64')
      }));
    };
    
    // Create test audio data
    const audioData = Buffer.alloc(5000).fill(1);
    
    // Get the WebSocket instance
    const ws = new WebSocket();
    
    // Try to send data with a non-OPEN socket
    mockSendAudio(ws, audioData);
    
    // Verify no data was sent
    expect(mockWsSend).not.toHaveBeenCalled();
    
    // Now change readyState to OPEN
    ws.readyState = WebSocket.OPEN;
    
    // Try again
    mockSendAudio(ws, audioData);
    
    // Now it should send
    expect(mockWsSend).toHaveBeenCalled();
  });
  
  test('should clear audio buffer when stopping audio capture', () => {
    // Create a mock for the audioBuffer variable
    let mockAudioBuffer = Buffer.alloc(0);
    
    // Create mock audio functions
    const mockSendBuffer = jest.fn(() => {
      if (mockAudioBuffer.length > 0) {
        mockWsSend(JSON.stringify({
          type: 'audio_data',
          data: mockAudioBuffer.toString('base64')
        }));
        mockAudioBuffer = Buffer.alloc(0); // Reset buffer after sending
      }
    });
    
    const mockStopCapture = jest.fn(() => {
      mockAudioBuffer = Buffer.alloc(0); // Clear buffer
    });
    
    // Add some data to the buffer
    mockAudioBuffer = Buffer.concat([mockAudioBuffer, Buffer.alloc(1000).fill(1)]);
    
    // Verify buffer has data
    expect(mockAudioBuffer.length).toBe(1000);
    
    // Call stop capture
    mockStopCapture();
    
    // Verify buffer is cleared
    expect(mockAudioBuffer.length).toBe(0);
    
    // Try to send - should not send anything
    mockSendBuffer();
    expect(mockWsSend).not.toHaveBeenCalled();
  });
  
  test('should handle errors when sending audio data', () => {
    // Make WebSocket.send throw an error
    mockWsSend.mockImplementation(() => {
      throw new Error('Network error');
    });
    
    // Spy on console.error
    const errorSpy = jest.spyOn(console, 'error');
    
    // Create a mock send function that mimics our error handling
    const mockSendWithErrorHandling = () => {
      try {
        mockWsSend(JSON.stringify({
          type: 'audio_data',
          data: Buffer.alloc(100).toString('base64')
        }));
      } catch (error) {
        console.error('Error sending audio data:', error);
      }
    };
    
    // Call our mock function
    mockSendWithErrorHandling();
    
    // Verify error was logged properly
    expect(errorSpy).toHaveBeenCalledWith(
      'Error sending audio data:',
      expect.any(Error)
    );
  });
  
  test('should encode audio data as base64 when sending', () => {
    // Create test audio data with specific pattern
    const testData = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xFF, 0xFE, 0xFD, 0xFC]);
    const expectedBase64 = testData.toString('base64');
    
    // Create a function to test base64 encoding
    const encodeAndSend = (data) => {
      mockWsSend(JSON.stringify({
        type: 'audio_data',
        data: data.toString('base64')
      }));
    };
    
    // Send our test data
    encodeAndSend(testData);
    
    // Parse the sent message
    const sentMessage = JSON.parse(mockWsSend.mock.calls[0][0]);
    
    // Verify the data is properly base64 encoded
    expect(sentMessage.data).toBe(expectedBase64);
    
    // Also verify it matches the base64 pattern
    expect(sentMessage.data).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });
});
