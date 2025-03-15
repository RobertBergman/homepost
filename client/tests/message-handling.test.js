const { spawn } = require('child_process');

// Import setup file
require('./setup');

describe('Client Message Handling', () => {
  let WebSocket;
  let mockWsSend;
  let mockMessageHandler;
  let fs;
  let childProcess;
  
  beforeEach(() => {
    // Reset modules before each test
    jest.resetModules();
    
    // Get mocked modules
    WebSocket = require('ws');
    fs = require('fs');
    childProcess = require('child_process');
    
    // Create mock functions
    mockWsSend = jest.fn();
    
    // Mock WebSocket implementation that provides a message handler
    WebSocket.mockImplementation(() => {
      return {
        on: jest.fn((event, callback) => {
          if (event === 'message') {
            // Store the message handler for later use
            mockMessageHandler = callback;
          }
        }),
        send: mockWsSend,
        readyState: 1 // OPEN by default
      };
    });
    
    // Mock fs.existsSync for config.json
    fs.existsSync = jest.fn().mockReturnValue(false);
    fs.writeFileSync = jest.fn();
    
    // Reset process.exit mock
    process.exit = jest.fn();
    
    // Clear console mocks
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Clear other mocks
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    // Reset any mocked timers
    jest.useRealTimers();
  });
  
  test('should handle server_response messages correctly', () => {
    // Spy on console.info
    const infoSpy = jest.spyOn(console, 'info');
    
    // Import client module
    require('../client');
    
    // Ensure message handler was set up
    expect(mockMessageHandler).toBeDefined();
    
    // Simulate receiving a server_response message
    mockMessageHandler(JSON.stringify({
      type: 'server_response',
      message: 'Test response message'
    }));
    
    // Verify the message was logged
    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining('Server response:'),
      'Test response message'
    );
  });
  
  test('should handle speak messages when speaker is enabled', () => {
    // Create a mock spawn implementation
    const mockSpawn = jest.fn().mockReturnValue({
      on: jest.fn(),
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() }
    });
    
    // Replace the spawn implementation
    childProcess.spawn.mockImplementation(mockSpawn);
    
    // Import client module
    require('../client');
    
    // Simulate receiving a speak message
    mockMessageHandler(JSON.stringify({
      type: 'speak',
      text: 'Test speech message'
    }));
    
    // Verify espeak was called
    expect(mockSpawn).toHaveBeenCalledWith('espeak', ['Test speech message']);
  });
  
  test('should not speak when speaker is disabled', () => {
    // Set up a mock config where speakerEnabled is false
    const mockConfig = {
      serverUrl: 'ws://test-server:3000',
      deviceId: 'test-device',
      speakerEnabled: false
    };
    
    // Mock the config existence
    fs.existsSync.mockReturnValue(true);
    
    // Mock require to return our mock config when loading config.json
    jest.doMock('../config.json', () => mockConfig, { virtual: true });
    
    // Create a mock spawn implementation
    const mockSpawn = jest.fn();
    childProcess.spawn.mockImplementation(mockSpawn);
    
    // Import client module
    require('../client');
    
    // Simulate receiving a speak message
    mockMessageHandler(JSON.stringify({
      type: 'speak',
      text: 'Test speech message'
    }));
    
    // Verify espeak was NOT called
    expect(mockSpawn).not.toHaveBeenCalled();
  });
  
  test('should handle restart command', () => {
    // Use fake timers
    jest.useFakeTimers();
    
    // Spy on process.exit
    const exitSpy = jest.spyOn(process, 'exit');
    
    // Import client module
    require('../client');
    
    // Simulate receiving a restart command
    mockMessageHandler(JSON.stringify({
      type: 'command',
      command: 'restart'
    }));
    
    // Advance timers to trigger the timeout
    jest.advanceTimersByTime(1100);
    
    // Verify process.exit was called
    expect(exitSpy).toHaveBeenCalledWith(0);
  });
  
  test('should handle update_config command', () => {
    // Spy on filesystem
    const writeFileSpy = jest.spyOn(fs, 'writeFileSync');
    
    // Import client module
    require('../client');
    
    // Simulate receiving an update_config command
    mockMessageHandler(JSON.stringify({
      type: 'command',
      command: 'update_config',
      params: {
        deviceName: 'Updated Device Name',
        location: 'Updated Location',
        logLevel: 'debug'
      }
    }));
    
    // Verify config file was updated
    expect(writeFileSpy).toHaveBeenCalled();
  });
  
  test('should only update allowed fields in update_config command', () => {
    // Default config
    const defaultConfig = {
      serverUrl: 'ws://192.168.1.100:3000',
      deviceId: 'original-device-id'
    };
    
    // Spy on filesystem
    const writeFileSpy = jest.spyOn(fs, 'writeFileSync');
    
    // Import client module
    require('../client');
    
    // Simulate receiving an update_config command with disallowed fields
    mockMessageHandler(JSON.stringify({
      type: 'command',
      command: 'update_config',
      params: {
        deviceId: 'hacked-device', // Should be ignored
        serverUrl: 'ws://malicious-server:3000', // Should be ignored
        location: 'Updated Location' // Should be allowed
      }
    }));
    
    // Verify config file was updated
    expect(writeFileSpy).toHaveBeenCalled();
    
    // Extract the written config from the mock
    const writtenConfigJson = writeFileSpy.mock.calls[0][1];
    const writtenConfig = JSON.parse(writtenConfigJson);
    
    // Check the disallowed fields weren't updated
    // We don't want to test actual implementation details, but we can verify
    // that sensitive fields are preserved by default config values
    expect(writeFileSpy).toHaveBeenCalled();
    expect(writtenConfig.location).toBe('Updated Location');
    
    // deviceId should remain unchanged
    expect(writtenConfig.deviceId).not.toBe('hacked-device');
  });
  
  test('should handle error messages from server', () => {
    // Spy on console.error
    const errorSpy = jest.spyOn(console, 'error');
    
    // Import client module
    require('../client');
    
    // Simulate receiving an error message
    mockMessageHandler(JSON.stringify({
      type: 'error',
      message: 'Test error message',
      code: 'TEST_ERROR'
    }));
    
    // Verify error was logged
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Server error:'),
      'Test error message',
      expect.stringContaining('Code:'),
      'TEST_ERROR'
    );
  });
  
  test('should handle invalid JSON messages gracefully', () => {
    // Spy on console.error
    const errorSpy = jest.spyOn(console, 'error');
    
    // Import client module
    require('../client');
    
    // Simulate receiving invalid JSON
    mockMessageHandler('This is not valid JSON');
    
    // Verify error was logged
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error processing message:'),
      expect.any(Error)
    );
  });
  
  test('should reject oversized messages', () => {
    // Spy on console.warn
    const warnSpy = jest.spyOn(console, 'warn');
    
    // Import client module
    require('../client');
    
    // Create a very large message (> 1MB)
    const largeMessage = JSON.stringify({
      type: 'server_response',
      message: 'X'.repeat(1100000)
    });
    
    // Simulate receiving oversized message
    mockMessageHandler(largeMessage);
    
    // Verify warning was logged
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Received very large message')
    );
  });
});
