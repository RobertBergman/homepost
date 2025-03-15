const fs = require('fs');
const path = require('path');

// Import setup file
require('./setup');

describe('Client Configuration', () => {
  let originalPath;
  let WebSocket;
  let mic;
  
  beforeEach(() => {
    // Reset modules before each test
    jest.resetModules();
    
    // Get mocked modules
    WebSocket = require('ws');
    mic = require('mic');
    
    // Clear console mocks
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Mock process.exit
    process.exit = jest.fn();
    
    // Store original path.join for restoration
    originalPath = path.join;
    
    // Reset environment variables
    delete process.env.HOMEPOST_SERVER_URL;
    delete process.env.HOMEPOST_DEVICE_ID;
    
    // Clear other mocks
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    // Restore original path.join
    path.join = originalPath;
  });
  
  test('should create default config file if it does not exist', () => {
    // Mock fs.existsSync to return false (file doesn't exist)
    fs.existsSync = jest.fn().mockReturnValue(false);
    const writeFileSpy = jest.spyOn(fs, 'writeFileSync');
    
    // Import client module
    require('../client');
    
    // Verify that writeFileSync was called to create the config file
    expect(writeFileSpy).toHaveBeenCalled();
    
    // Parse the written config from the mock
    const writtenConfigJson = writeFileSpy.mock.calls[0][1];
    const writtenConfig = JSON.parse(writtenConfigJson);
    
    // Verify config has expected fields
    expect(writtenConfig).toHaveProperty('serverUrl');
    expect(writtenConfig).toHaveProperty('deviceId');
  });
  
  test('should load configuration from file when it exists', () => {
    // Create mock config content
    const mockConfig = {
      serverUrl: 'ws://custom-server:3000',
      deviceId: 'custom-device',
      deviceName: 'Custom Device',
      location: 'Custom Location',
      logLevel: 'debug'
    };
    
    // Mock fs.existsSync to return true (file exists)
    fs.existsSync = jest.fn().mockReturnValue(true);
    
    // Mock require to return our mock config when loading config.json
    jest.doMock('../config.json', () => mockConfig, { virtual: true });
    
    // Import client module
    require('../client');
    
    // We can't directly test the loaded config, but we can test its effects
    // For example, verify WebSocket was created with our custom server URL
    expect(WebSocket).toHaveBeenCalledWith(
      'ws://custom-server:3000',
      expect.any(Object)
    );
  });
  
  test('should use environment variables over file configuration', () => {
    // Create mock config content
    const mockConfig = {
      serverUrl: 'ws://file-server:3000',
      deviceId: 'file-device'
    };
    
    // Set environment variables
    process.env.HOMEPOST_SERVER_URL = 'ws://env-server:4000';
    process.env.HOMEPOST_DEVICE_ID = 'env-device';
    
    // Mock fs.existsSync to return true (file exists)
    fs.existsSync = jest.fn().mockReturnValue(true);
    
    // Mock require to return our mock config when loading config.json
    jest.doMock('../config.json', () => mockConfig, { virtual: true });
    
    // Import client module
    require('../client');
    
    // WebSocket should be created with the environment variable URL, not the file URL
    expect(WebSocket).toHaveBeenCalledWith(
      'ws://env-server:4000',
      expect.any(Object)
    );
  });
  
  test('should handle corrupted config file gracefully', () => {
    // Spy on console methods
    const errorSpy = jest.spyOn(console, 'error');
    const infoSpy = jest.spyOn(console, 'info');
    
    // Mock fs.existsSync to return true (file exists)
    fs.existsSync = jest.fn().mockReturnValue(true);
    
    // Mock require to throw error when loading config.json (simulating corrupted file)
    jest.doMock('../config.json', () => {
      throw new SyntaxError('Unexpected token in JSON');
    }, { virtual: true });
    
    // Mock fs.copyFileSync to test backup functionality
    const copyFileSpy = jest.spyOn(fs, 'copyFileSync');
    
    // Import client module
    require('../client');
    
    // Verify that error was logged
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error parsing config file:'),
      expect.any(Error)
    );
    
    // Verify that we're using default configuration
    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining('Using default configuration')
    );
    
    // Verify that corrupted file was backed up
    expect(copyFileSpy).toHaveBeenCalled();
    
    // WebSocket should be created with the default server URL
    expect(WebSocket).toHaveBeenCalledWith(
      'ws://192.168.1.100:3000',
      expect.any(Object)
    );
  });
  
  test('should properly merge nested configuration objects', () => {
    // Mock mic configuration in client
    mic.mockImplementation((config) => {
      return {
        start: jest.fn(),
        stop: jest.fn(),
        getAudioStream: jest.fn().mockReturnValue({
          on: jest.fn()
        })
      };
    });
    
    // Create mock config with partial mic settings
    const mockConfig = {
      serverUrl: 'ws://custom-server:3000',
      deviceId: 'custom-device',
      micConfig: {
        rate: '48000', // Only override this setting
        // Don't include other mic settings to test merging
      }
    };
    
    // Mock fs.existsSync to return true (file exists)
    fs.existsSync = jest.fn().mockReturnValue(true);
    
    // Mock require to return our mock config when loading config.json
    jest.doMock('../config.json', () => mockConfig, { virtual: true });
    
    // Set up WebSocket that calls the open handler to initialize mic
    WebSocket.mockImplementation(() => {
      return {
        on: jest.fn((event, callback) => {
          if (event === 'open') {
            // Immediately call the open handler to trigger mic initialization
            callback();
          }
        }),
        send: jest.fn(),
        readyState: 1 // OPEN by default
      };
    });
    
    // Import client module
    require('../client');
    
    // Verify that mic was initialized
    expect(mic).toHaveBeenCalled();
    
    // Check mic was called with merged configuration
    expect(mic).toHaveBeenCalledWith(
      expect.objectContaining({
        rate: '48000' // Our custom rate from mockConfig
      })
    );
  });
  
  test('should handle missing config directory', () => {
    // Mock fs.existsSync to throw an error (simulating permission issues or missing directory)
    fs.existsSync = jest.fn().mockImplementation(() => {
      throw new Error('ENOENT: no such file or directory');
    });
    
    // Spy on console.error
    const errorSpy = jest.spyOn(console, 'error');
    
    // Import client module
    require('../client');
    
    // Verify that error was logged
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error handling config file:'),
      expect.any(Error)
    );
    
    // WebSocket should still be created with the default server URL
    expect(WebSocket).toHaveBeenCalledWith(
      'ws://192.168.1.100:3000',
      expect.any(Object)
    );
  });
});
