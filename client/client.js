const WebSocket = require('ws');
const mic = require('mic');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Default configuration - modify these settings
const defaultConfig = {
  serverUrl: 'ws://192.168.1.100:3000', // Replace with your server IP
  deviceId: 'living-room',              // Unique ID for this Raspberry Pi
  deviceName: 'Living Room',            // Human-readable name
  location: 'Living Room',              // Location information
  micConfig: {
    rate: '16000',
    channels: '1',
    device: 'default',
    fileType: 'wav'
  },
  reconnectInterval: 5000,       // Time in ms to wait before reconnecting
  maxReconnectInterval: 60000,   // Maximum reconnect interval (1 minute)
  reconnectBackoffFactor: 1.5,   // Backoff factor for reconnection
  speakerEnabled: true,          // Enable text-to-speech responses  
  logLevel: 'info',              // Log level: debug, info, warn, error
  audioChunkSize: 4096,          // Bytes to buffer before sending
  audioSendInterval: 500,        // Milliseconds between audio sends
  heartbeatInterval: 30000       // Heartbeat interval in milliseconds
};

// Current configuration
const config = Object.assign({}, defaultConfig);

// Environment-specific overrides
if (process.env.HOMEPOST_SERVER_URL) {
  config.serverUrl = process.env.HOMEPOST_SERVER_URL;
}

if (process.env.HOMEPOST_DEVICE_ID) {
  config.deviceId = process.env.HOMEPOST_DEVICE_ID;
}

// Save config to file so it's easy to modify
const configPath = path.join(__dirname, 'config.json');

// Create a logging function
const log = {
  debug: (...args) => {
    if (config.logLevel === 'debug') {
      console.log('[DEBUG]', ...args);
    }
  },
  info: (...args) => console.log('[INFO]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args),
  error: (...args) => console.error('[ERROR]', ...args)
};

try {
  // Create config file if it doesn't exist
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    log.info('Created default config.json');
  } else {
    try {
      // Load and validate saved config
      const savedConfig = require(configPath);
      
      // Ensure required fields exist by merging with defaults
      Object.keys(defaultConfig).forEach(key => {
        if (savedConfig[key] !== undefined) {
          // For objects, merge instead of replace
          if (typeof defaultConfig[key] === 'object' && !Array.isArray(defaultConfig[key])) {
            config[key] = Object.assign({}, defaultConfig[key], savedConfig[key]);
          } else {
            config[key] = savedConfig[key];
          }
        }
      });
      
      log.info('Loaded configuration from config.json');
    } catch (parseError) {
      log.error('Error parsing config file:', parseError);
      log.info('Using default configuration');
      
      // Backup corrupted config and create a new one
      const backupPath = `${configPath}.backup.${Date.now()}`;
      fs.copyFileSync(configPath, backupPath);
      log.info(`Backed up corrupted config to ${backupPath}`);
      fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    }
  }
} catch (error) {
  log.error('Error handling config file:', error);
}

// Status tracking
let isConnected = false;
let micInstance = null;
let micInputStream = null;
let currentReconnectInterval = config.reconnectInterval;
let reconnectAttempts = 0;
let reconnectTimeout = null;
let heartbeatInterval = null;
let lastPongTime = 0;
let audioBuffer = Buffer.alloc(0);
let audioSendInterval = null;

// Connect to the WebSocket server with exponential backoff
function connectToServer() {
  // Clear any existing reconnect timeouts
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  
  // Clear any heartbeat interval
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  
  log.info(`Connecting to server at ${config.serverUrl}... (Attempt ${reconnectAttempts + 1})`);
  
  try {
    const ws = new WebSocket(config.serverUrl, {
      handshakeTimeout: 10000, // 10 seconds for handshake
      perMessageDeflate: true  // Enable compression
    });
    
    // Track ping/pong for client-side connection monitoring
    lastPongTime = Date.now();
    ws.on('pong', () => {
      log.debug('Received pong from server');
      lastPongTime = Date.now();
    });
    
    ws.on('open', () => {
      log.info('Connected to server!');
      isConnected = true;
      reconnectAttempts = 0;
      currentReconnectInterval = config.reconnectInterval;
      
      // Send device information with enhanced details
      ws.send(JSON.stringify({
        type: 'device_info',
        deviceId: config.deviceId,
        name: config.deviceName,
        location: config.location,
        capabilities: {
          audio: true,
          video: false, // Set to true if webcam is available
          speaker: config.speakerEnabled
        },
        clientVersion: '1.0.0',
        systemInfo: {
          platform: process.platform,
          arch: process.arch,
          nodeVersion: process.version
        }
      }));
      
      // Start capturing audio after connection is established
      startAudioCapture(ws);
      
      // Start heartbeat to detect connection issues
      heartbeatInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          log.debug('Sending ping to server');
          
          // Send ping or a custom heartbeat message
          try {
            ws.ping();
            
            // Check if we haven't received a pong in a while
            const now = Date.now();
            if (now - lastPongTime > config.heartbeatInterval * 2) {
              log.warn('No pong received in a long time, reconnecting...');
              ws.terminate(); // Force close and reconnect
            }
          } catch (error) {
            log.error('Error sending ping:', error);
            ws.terminate(); // Force close on error
          }
        }
      }, config.heartbeatInterval);
    });
    
    ws.on('message', (message) => {
      try {
        // Check if the message is too long or malformed
        if (message.length > 1000000) { // 1MB limit
          log.warn(`Received very large message (${message.length} bytes), ignoring`);
          return;
        }
        
        const data = JSON.parse(message.toString());
        
        if (!data || typeof data !== 'object' || !data.type) {
          log.warn('Received invalid message format');
          return;
        }
        
        switch (data.type) {
          case 'server_response':
            log.info(`Server response: ${data.message}`);
            break;
            
          case 'speak':
            if (config.speakerEnabled && data.text) {
              speakResponse(data.text);
            }
            break;
            
          case 'command':
            if (!data.command) {
              log.warn('Received command message with missing command field');
              return;
            }
            handleCommand(data.command, data.params || {});
            break;
            
          case 'error':
            log.error(`Server error: ${data.message} (Code: ${data.code || 'unknown'})`);
            break;
            
          default:
            log.warn(`Unknown message type: ${data.type}`);
        }
      } catch (error) {
        log.error('Error processing message:', error);
      }
    });
    
    ws.on('close', (code, reason) => {
      const reasonStr = reason ? reason.toString() : 'Unknown reason';
      log.info(`Connection to server closed: Code ${code}, Reason: ${reasonStr}`);
      isConnected = false;
      stopAudioCapture();
      
      // Clean up heartbeat interval
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
      
      // Implement exponential backoff for reconnection
      reconnectAttempts++;
      currentReconnectInterval = Math.min(
        currentReconnectInterval * config.reconnectBackoffFactor,
        config.maxReconnectInterval
      );
      
      log.info(`Reconnecting in ${Math.round(currentReconnectInterval / 1000)} seconds...`);
      reconnectTimeout = setTimeout(connectToServer, currentReconnectInterval);
    });
    
    ws.on('error', (error) => {
      log.error('WebSocket error:', error);
      // The close event will be triggered after this
    });
    
    ws.on('unexpected-response', (request, response) => {
      log.error(`Unexpected response: ${response.statusCode} ${response.statusMessage}`);
      // The close event will be triggered after this
    });
    
    return ws;
  } catch (error) {
    log.error('Error creating WebSocket:', error);
    
    // Try to reconnect after interval
    reconnectAttempts++;
    currentReconnectInterval = Math.min(
      currentReconnectInterval * config.reconnectBackoffFactor,
      config.maxReconnectInterval
    );
    
    log.info(`Reconnecting in ${Math.round(currentReconnectInterval / 1000)} seconds...`);
    reconnectTimeout = setTimeout(connectToServer, currentReconnectInterval);
    
    return null;
  }
}

// Start capturing audio from the microphone with buffering
function startAudioCapture(ws) {
  if (micInstance) {
    stopAudioCapture();
  }
  
  log.info('Starting audio capture...');
  
  try {
    // Reset audio buffer
    audioBuffer = Buffer.alloc(0);
    
    // Initialize microphone
    micInstance = mic(config.micConfig);
    micInputStream = micInstance.getAudioStream();
    
    // Handle audio data with improved buffering and error handling
    micInputStream.on('data', (data) => {
      if (!isConnected || !ws || ws.readyState !== WebSocket.OPEN) {
        return;
      }
      
      // Add new data to buffer
      audioBuffer = Buffer.concat([audioBuffer, data]);
      
      // If buffer exceeds chunk size, send immediately
      if (audioBuffer.length >= config.audioChunkSize) {
        sendAudioBuffer(ws);
      }
    });
    
    // Set up interval to periodically send audio data even if not reaching chunk size
    if (audioSendInterval) {
      clearInterval(audioSendInterval);
    }
    
    audioSendInterval = setInterval(() => {
      if (isConnected && ws && ws.readyState === WebSocket.OPEN && audioBuffer.length > 0) {
        sendAudioBuffer(ws);
      }
    }, config.audioSendInterval);
    
    micInputStream.on('error', (err) => {
      log.error('Error in microphone input stream:', err);
      
      // Try to restart audio capture if there's an error
      setTimeout(() => {
        if (isConnected) {
          log.info('Attempting to restart audio capture after error');
          stopAudioCapture();
          startAudioCapture(ws);
        }
      }, 5000);
    });
    
    micInputStream.on('processExitComplete', () => {
      log.debug('Mic process exit complete');
    });
    
    // Start the microphone
    micInstance.start();
    log.info('Audio capture started');
  } catch (error) {
    log.error('Failed to start audio capture:', error);
    
    // Cleanup and try again later
    stopAudioCapture();
    setTimeout(() => {
      if (isConnected && ws) {
        startAudioCapture(ws);
      }
    }, 10000);
  }
}

// Send buffered audio data to the server
function sendAudioBuffer(ws) {
  if (audioBuffer.length === 0) return;
  
  try {
    // Send audio data
    const message = JSON.stringify({
      type: 'audio_data',
      deviceId: config.deviceId,
      timestamp: Date.now(),
      // Convert Buffer to Base64 string for JSON transmission
      data: audioBuffer.toString('base64')
    });
    
    // Check if we're still connected before sending
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
      log.debug(`Sent ${audioBuffer.length} bytes of audio data`);
    }
    
    // Clear the buffer
    audioBuffer = Buffer.alloc(0);
  } catch (error) {
    log.error('Error sending audio data:', error);
    // Clear buffer anyway to avoid memory buildup in error cases
    audioBuffer = Buffer.alloc(0);
  }
}

// Stop capturing audio
function stopAudioCapture() {
  // Clear the send interval
  if (audioSendInterval) {
    clearInterval(audioSendInterval);
    audioSendInterval = null;
  }
  
  // Reset audio buffer
  audioBuffer = Buffer.alloc(0);
  
  if (micInstance) {
    log.info('Stopping audio capture...');
    
    try {
      micInstance.stop();
    } catch (error) {
      log.error('Error stopping microphone:', error);
    }
    
    micInstance = null;
    micInputStream = null;
  }
}

// Handle commands from the server with improved validation
function handleCommand(command, params) {
  log.info(`Received command: ${command}`, params);
  
  // Validate command and params
  if (!command || typeof command !== 'string') {
    log.warn('Invalid command received');
    return;
  }
  
  try {
    switch (command) {
      case 'restart':
        log.info('Restarting client...');
        // Graceful shutdown
        stopAudioCapture();
        setTimeout(() => {
          process.exit(0); // Process will be restarted by systemd or another service manager
        }, 1000);
        break;
        
      case 'update_config':
        if (params && typeof params === 'object') {
          // Validate critical params that shouldn't be changed remotely
          const updatedConfig = Object.assign({}, config);
          
          // Only update allowed fields, ignore sensitive ones
          const allowedFields = [
            'deviceName', 'location', 'reconnectInterval', 
            'heartbeatInterval', 'speakerEnabled', 'logLevel',
            'audioChunkSize', 'audioSendInterval'
          ];
          
          let configChanged = false;
          
          for (const field of allowedFields) {
            if (params[field] !== undefined) {
              updatedConfig[field] = params[field];
              configChanged = true;
            }
          }
          
          // Special handling for nested objects
          if (params.micConfig && typeof params.micConfig === 'object') {
            updatedConfig.micConfig = Object.assign({}, config.micConfig, params.micConfig);
            configChanged = true;
          }
          
          if (configChanged) {
            // Apply changes
            Object.assign(config, updatedConfig);
            
            // Save to file
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            log.info('Updated configuration');
            
            // Restart audio capture with new settings if needed
            if (params.micConfig) {
              restartAudioCapture();
            }
          } else {
            log.info('No valid configuration changes received');
          }
        } else {
          log.warn('Invalid parameters for update_config command');
        }
        break;
        
      case 'ping':
        // Simple ping command to test connectivity
        log.info('Ping received, sending pong response');
        break;
        
      case 'status':
        // Report status back to server if needed
        log.info('Status command received');
        // Could implement sending back status information here
        break;
        
      default:
        log.warn(`Unknown command: ${command}`);
    }
  } catch (error) {
    log.error(`Error handling command ${command}:`, error);
  }
}

// Restart the audio capture (after config changes)
function restartAudioCapture() {
  log.info('Restarting audio capture with new settings');
  stopAudioCapture();
  
  // Wait a moment before restarting
  setTimeout(() => {
    if (isConnected) {
      const ws = getActiveConnection();
      if (ws) {
        startAudioCapture(ws);
      }
    }
  }, 1000);
}

// Get active WebSocket connection (helper function)
function getActiveConnection() {
  // This is a placeholder - in a more complex implementation, 
  // you would track the active connection 
  // For now we'll rely on the connection from connectToServer()
  return null; // The current implementation will restart on reconnect
}

// Use text-to-speech to speak responses with better error handling
function speakResponse(text) {
  if (!config.speakerEnabled || !text) {
    return;
  }
  
  log.info(`Speaking: ${text}`);
  
  // Sanitize text to prevent command injection
  const sanitizedText = text.replace(/[;&|<>$]/g, '');
  
  try {
    // Use espeak for text-to-speech
    // Install with: sudo apt-get install espeak
    const espeak = spawn('espeak', [sanitizedText]);
    
    espeak.on('error', (err) => {
      log.error('Error with text-to-speech:', err);
      log.info('Make sure espeak is installed with: sudo apt-get install espeak');
    });
    
    // Capture output for debugging
    espeak.stdout.on('data', (data) => {
      log.debug(`espeak stdout: ${data}`);
    });
    
    espeak.stderr.on('data', (data) => {
      log.debug(`espeak stderr: ${data}`);
    });
    
    espeak.on('close', (code) => {
      if (code !== 0) {
        log.warn(`espeak process exited with code ${code}`);
      }
    });
  } catch (error) {
    log.error('Failed to spawn espeak process:', error);
  }
}

// Handle process termination gracefully
function handleShutdown(signal) {
  log.info(`Received ${signal}, shutting down gracefully...`);
  
  // Stop audio capture
  stopAudioCapture();
  
  // Clear all intervals and timeouts
  if (audioSendInterval) clearInterval(audioSendInterval);
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  if (reconnectTimeout) clearTimeout(reconnectTimeout);
  
  // Exit after a brief delay to allow cleanup
  setTimeout(() => {
    log.info('Exiting now');
    process.exit(0);
  }, 1000);
}

// Register shutdown handlers
process.on('SIGINT', () => handleShutdown('SIGINT'));  
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGHUP', () => handleShutdown('SIGHUP'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log.error('Uncaught exception:', error);
  
  // Write crash log to disk
  const crashLog = {
    timestamp: new Date().toISOString(),
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    config: Object.assign({}, config, {
      // Remove sensitive data if any
    })
  };
  
  try {
    fs.writeFileSync(
      path.join(__dirname, `crash-${Date.now()}.json`),
      JSON.stringify(crashLog, null, 2)
    );
  } catch (writeError) {
    log.error('Failed to write crash log:', writeError);
  }
  
  // Attempt graceful shutdown
  handleShutdown('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  log.error('Unhandled promise rejection:', reason);
  
  // Log the rejection but don't exit - let the process continue
  try {
    fs.writeFileSync(
      path.join(__dirname, `rejection-${Date.now()}.json`),
      JSON.stringify({
        timestamp: new Date().toISOString(),
        reason: reason ? reason.toString() : 'Unknown reason',
        stack: reason && reason.stack ? reason.stack : 'No stack trace'
      }, null, 2)
    );
  } catch (writeError) {
    log.error('Failed to write rejection log:', writeError);
  }
});

// Start the client
const activeConnection = connectToServer();

log.info('==================================');
log.info(`HomePost client starting up (Device ID: ${config.deviceId})`);
log.info(`Server URL: ${config.serverUrl}`);
log.info(`Location: ${config.location}`);
log.info('Press Ctrl+C to exit');
log.info('==================================');