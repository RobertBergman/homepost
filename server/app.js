const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const { createRealtimeAudioTranscriptionRequest } = require('@langchain/openai');
const { LangGraph } = require('langchain/graph');
const dotenv = require('dotenv');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const aiAssistantRoutes = require('./routes/ai-assistant');

// Load environment variables
dotenv.config();

// Check for required environment variables
if (!process.env.OPENAI_API_KEY) {
  console.error('ERROR: OPENAI_API_KEY environment variable is not set!');
  console.error('Please create a .env file with your OpenAI API key.');
  process.exit(1);
}

// Configuration with validation
const config = {
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
  dbPath: process.env.DB_PATH || path.join(__dirname, 'data/homepost.db'),
  logLevel: ['debug', 'info', 'warn', 'error'].includes(process.env.LOG_LEVEL) 
    ? process.env.LOG_LEVEL 
    : 'info',
  dataDir: process.env.DATA_DIR || path.join(__dirname, 'data'),
  retainAudioHours: Math.max(1, parseInt(process.env.RETAIN_AUDIO_HOURS || '24', 10)),
  alertPhrases: (process.env.ALERT_PHRASES || 'help,emergency,fire').split(','),
  cleanupIntervalMinutes: parseInt(process.env.CLEANUP_INTERVAL_MINUTES || '60', 10)
};

// Validate configuration
if (isNaN(config.port) || config.port < 1 || config.port > 65535) {
  console.error(`ERROR: Invalid PORT value: ${process.env.PORT}`);
  process.exit(1);
}

if (isNaN(config.retainAudioHours) || config.retainAudioHours < 1) {
  console.error(`ERROR: Invalid RETAIN_AUDIO_HOURS value: ${process.env.RETAIN_AUDIO_HOURS}`);
  process.exit(1);
}

// Ensure data directory exists
fs.mkdirSync(config.dataDir, { recursive: true });

// Setup Express app
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, noServer: true });

// Map to store connected clients
const connectedClients = new Map();

// Set up SQLite database with proper indexes
let db;
async function setupDatabase() {
  try {
    // Ensure directory exists if not using memory DB
    if (config.dbPath !== ':memory:') {
      const dbDir = path.dirname(config.dbPath);
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Open database with pragmas for better performance
    db = await open({
      filename: config.dbPath,
      driver: sqlite3.Database
    });

    // Enable foreign keys and other optimizations
    await db.exec(`
      PRAGMA foreign_keys = ON;
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
    `);

    // Create tables if they don't exist
    await db.exec(`
      CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY,
        name TEXT,
        location TEXT,
        capabilities TEXT,
        last_seen TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS transcriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT,
        timestamp TIMESTAMP,
        text TEXT,
        confidence REAL,
        FOREIGN KEY (device_id) REFERENCES devices(id)
      );

      CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT,
        timestamp TIMESTAMP,
        type TEXT,
        message TEXT,
        status TEXT,
        FOREIGN KEY (device_id) REFERENCES devices(id)
      );
      
      -- Create indexes for frequently queried columns
      CREATE INDEX IF NOT EXISTS idx_transcriptions_device_id ON transcriptions(device_id);
      CREATE INDEX IF NOT EXISTS idx_transcriptions_timestamp ON transcriptions(timestamp);
      CREATE INDEX IF NOT EXISTS idx_alerts_device_id ON alerts(device_id);
      CREATE INDEX IF NOT EXISTS idx_alerts_timestamp ON alerts(timestamp);
      CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
    `);

    console.log('Database setup complete');
    return true;
  } catch (error) {
    console.error('Database setup error:', error);
    
    // More flexible error handling - retry for transient errors
    if (error.code === 'SQLITE_BUSY') {
      console.log('Database is busy, retrying in 5 seconds...');
      setTimeout(setupDatabase, 5000);
      return false;
    } else {
      throw error;
    }
  }
}

// Import responses API service
const responsesApi = require('./services/responses-api');

// Global variable for workflow to avoid recreating on every audio chunk
let langChainWorkflow;

// Initialize LangChain processing workflow
async function setupLangChain() {
  if (langChainWorkflow) {
    return langChainWorkflow;
  }
  
  console.log('Initializing LangChain workflow...');
  
  // Create a simple graph for processing transcribed text
  langChainWorkflow = new LangGraph({
    nodes: [
      {
        id: 'transcribe',
        action: async ({ text, deviceId }) => {
          if (config.logLevel === 'debug') {
            console.log(`Processing transcription from device ${deviceId}`);
          }
          return { text, deviceId };
        }
      },
      {
        id: 'analyze',
        action: async ({ text, deviceId }) => {
          let alerts = [];
          
          try {
            // Use the new Responses API for advanced analysis
            const analysis = await responsesApi.analyzeText(text, deviceId);
            
            if (analysis && analysis.alerts && Array.isArray(analysis.alerts)) {
              alerts = analysis.alerts;
              
              // Log analysis information
              if (config.logLevel === 'debug') {
                console.log(`Advanced analysis result for device ${deviceId}:`, 
                  JSON.stringify(analysis, null, 2));
              }
            } else {
              // Fallback to the original keyword detection if AI analysis fails
              const lowerText = text.toLowerCase();
              
              for (const phrase of config.alertPhrases) {
                const lowerPhrase = phrase.toLowerCase().trim();
                // Check for whole word match using word boundaries
                const regex = new RegExp(`\\b${lowerPhrase}\\b`, 'i');
                if (regex.test(lowerText)) {
                  alerts.push({
                    phrase,
                    severity: phrase === 'emergency' || phrase === 'fire' ? 'high' : 'medium'
                  });
                }
              }
            }
          } catch (error) {
            console.error('Error in advanced analysis, falling back to simple detection:', error);
            
            // Simple keyword-based fallback
            const lowerText = text.toLowerCase();
            for (const phrase of config.alertPhrases) {
              const lowerPhrase = phrase.toLowerCase().trim();
              const regex = new RegExp(`\\b${lowerPhrase}\\b`, 'i');
              if (regex.test(lowerText)) {
                alerts.push({
                  phrase,
                  severity: phrase === 'emergency' || phrase === 'fire' ? 'high' : 'medium'
                });
              }
            }
          }
          
          return { text, deviceId, alerts };
        }
      },
      {
        id: 'store',
        action: async ({ text, deviceId, alerts }) => {
          // Store transcription in database
          try {
            if (text.trim()) {  // Only store non-empty transcriptions
              await db.run(
                'INSERT INTO transcriptions (device_id, timestamp, text, confidence) VALUES (?, ?, ?, ?)',
                [deviceId, new Date().toISOString(), text, 1.0]
              );
            }
            
            // Create alerts if any were detected
            for (const alert of alerts) {
              await db.run(
                'INSERT INTO alerts (device_id, timestamp, type, message, status) VALUES (?, ?, ?, ?, ?)',
                [deviceId, new Date().toISOString(), 'keyword_detected', 
                 `Detected "${alert.phrase}" (${alert.severity} severity)`, 'new']
              );
              
              // Send alert to all connected web clients
              broadcastToWebClients({
                type: 'alert',
                deviceId,
                timestamp: new Date().toISOString(),
                message: `Detected "${alert.phrase}" in device ${deviceId}`,
                severity: alert.severity
              });
              
              // If high severity, also send an audio response to the device
              if (alert.severity === 'high') {
                const client = connectedClients.get(deviceId);
                if (client && client.capabilities && client.capabilities.speaker) {
                  try {
                    client.ws.send(JSON.stringify({
                      type: 'speak',
                      text: `Alert detected: ${alert.phrase}. Do you need assistance?`
                    }));
                  } catch (err) {
                    console.error(`Error sending alert to device ${deviceId}:`, err);
                  }
                }
              }
            }
          } catch (error) {
            console.error('Error storing transcription:', error);
            // Implement retry logic for transient database errors
            if (error.code === 'SQLITE_BUSY' || error.code === 'SQLITE_LOCKED') {
              console.log('Database is busy, retrying in 1 second...');
              setTimeout(async () => {
                try {
                  await this.action({ text, deviceId, alerts });
                } catch (retryError) {
                  console.error('Retry failed:', retryError);
                }
              }, 1000);
            }
          }
          
          return { text, deviceId, alerts };
        }
      }
    ],
    edges: [
      { source: 'transcribe', target: 'analyze' },
      { source: 'analyze', target: 'store' }
    ]
  });
  
  return langChainWorkflow;
}

// Handle WebSocket connections
wss.on('connection', async (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`New connection established from ${clientIp}`);
  
  // Assign a temporary ID until we get device info - ensure uniqueness
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 10);
  let deviceId = `unknown-${timestamp}-${randomId}`;
  
  // Track connection status
  ws.isAlive = true;
  
  // Setup ping to detect disconnected clients
  ws.on('pong', () => {
    ws.isAlive = true;
  });
  
  ws.on('message', async (message) => {
    let data;
    // Validate and parse the message
    try {
      // Safely check if it's valid JSON before parsing
      const messageStr = message.toString();
      if (!messageStr.trim() || messageStr.length > 1000000) { // Limit message size
        throw new Error(`Invalid message: ${messageStr.length > 100 ? 
          messageStr.substring(0, 100) + '...' : messageStr}`);
      }
      data = JSON.parse(messageStr);
      
      // Validate required fields
      if (!data || typeof data !== 'object' || !data.type) {
        throw new Error('Invalid message format: missing type');
      }
    } catch (error) {
      console.error('Error parsing message:', error.message);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format',
        code: 'INVALID_FORMAT'
      }));
      return;
    }
    
    // Handle different message types with improved error handling
    try {
      switch (data.type) {
        case 'device_info':
          // Validate required fields
          if (!data.deviceId) {
            throw new Error('Missing required field: deviceId');
          }
          
          // Ensure deviceId doesn't conflict with "unknown-" prefix used for temp IDs
          if (data.deviceId.startsWith('unknown-')) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Device ID cannot start with "unknown-"',
              code: 'INVALID_DEVICE_ID'
            }));
            return;
          }
          
          // Store device information
          deviceId = data.deviceId;
          console.log(`Device registered: ${deviceId}`);
          
          // Store client information
          connectedClients.set(deviceId, {
            ws,
            capabilities: data.capabilities || {},
            connectedAt: new Date(),
            ipAddress: clientIp
          });
          
          // Update device in database
          try {
            const existingDevice = await db.get('SELECT * FROM devices WHERE id = ?', [deviceId]);
            if (existingDevice) {
              await db.run(
                'UPDATE devices SET capabilities = ?, last_seen = ? WHERE id = ?',
                [JSON.stringify(data.capabilities || {}), new Date().toISOString(), deviceId]
              );
            } else {
              await db.run(
                'INSERT INTO devices (id, name, location, capabilities, last_seen) VALUES (?, ?, ?, ?, ?)',
                [deviceId, data.name || deviceId, data.location || 'Unknown', 
                 JSON.stringify(data.capabilities || {}), new Date().toISOString()]
              );
            }
          } catch (error) {
            console.error('Error updating device in database:', error);
            // Non-fatal error, continue with connection
          }
          
          // Send acknowledgment
          ws.send(JSON.stringify({
            type: 'server_response',
            message: 'Device registered successfully'
          }));
          
          // Broadcast new device to web clients
          broadcastToWebClients({
            type: 'device_connected',
            deviceId,
            name: data.name || deviceId,
            location: data.location || 'Unknown',
            capabilities: data.capabilities || {}
          });
          
          break;
          
        case 'audio_data':
          // Process audio data
          if (!connectedClients.has(deviceId)) {
            console.warn(`Received audio from unknown device: ${deviceId}`);
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Device not registered',
              code: 'DEVICE_NOT_REGISTERED'
            }));
            break;
          }
          
          // Validate required data
          if (!data.data || typeof data.data !== 'string') {
            throw new Error('Missing or invalid audio data');
          }
          
          // Update last seen timestamp
          try {
            await db.run(
              'UPDATE devices SET last_seen = ? WHERE id = ?',
              [new Date().toISOString(), deviceId]
            );
          } catch (error) {
            console.error('Error updating device last_seen:', error);
            // Non-fatal error, continue processing
          }
          
          // Process the audio data with OpenAI Realtime API
          try {
            // Convert base64 back to Buffer
            const audioBuffer = Buffer.from(data.data, 'base64');
            
            // Validate audio buffer size
            if (audioBuffer.length < 10 || audioBuffer.length > 10000000) { // 10MB max
              throw new Error(`Invalid audio buffer size: ${audioBuffer.length} bytes`);
            }
            
            // Optional: Save audio chunk to file for debugging/later analysis
            const audioDir = path.join(config.dataDir, 'audio', deviceId);
            fs.mkdirSync(audioDir, { recursive: true });
            const audioFilename = path.join(audioDir, `chunk-${Date.now()}.wav`);
            
            // Use asynchronous file operations to avoid blocking
            fs.promises.writeFile(audioFilename, audioBuffer)
              .catch(err => console.error('Error saving audio file:', err));
            
            // Get the reusable workflow
            const workflow = await setupLangChain();
            
            // Process with OpenAI Realtime API
            const realtimeRequest = createRealtimeAudioTranscriptionRequest({
              apiKey: process.env.OPENAI_API_KEY,
              model: 'whisper-1',
              onMessage: async (message) => {
                if (message.type === 'text') {
                  if (config.logLevel === 'debug' || config.logLevel === 'info') {
                    console.log(`Transcription from ${deviceId}: ${message.text}`);
                  }
                  
                  // Send transcription to web clients
                  broadcastToWebClients({
                    type: 'transcription',
                    deviceId,
                    timestamp: new Date().toISOString(),
                    text: message.text
                  });
                  
                  // Process transcription through LangChain workflow (now reused)
                  if (message.text.trim()) {
                    await workflow.invoke({
                      text: message.text,
                      deviceId
                    });
                  }
                }
              }
            });
            
            // Send the audio chunk
            realtimeRequest.sendAudio(audioBuffer);
            realtimeRequest.closeStream();
          } catch (error) {
            console.error('Error processing audio:', error);
            // Don't send error to client for audio processing issues
            // as it would interrupt the stream
          }
          
          break;
          
        case 'web_client':
          // Handle web client messages - basic authentication
          const authToken = data.token || '';
          
          // You would add proper authentication here
          // For now, just using any token value (should be replaced with real auth)
          if (process.env.WEB_AUTH_REQUIRED === 'true' && !authToken) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Authentication required',
              code: 'AUTH_REQUIRED'
            }));
            ws.close();
            return;
          }
          
          console.log('Web client connected');
          
          // Mark this connection as a web client
          ws.isWebClient = true;
          
          // Send list of connected devices
          const devices = Array.from(connectedClients.keys()).map(id => {
            const client = connectedClients.get(id);
            return {
              id,
              capabilities: client.capabilities || {},
              connectedAt: client.connectedAt,
              ipAddress: client.ipAddress
            };
          });
          
          ws.send(JSON.stringify({
            type: 'device_list',
            devices
          }));
          
          // Also send recent alerts
          try {
            const recentAlerts = await db.all(
              'SELECT * FROM alerts ORDER BY timestamp DESC LIMIT 10'
            );
            ws.send(JSON.stringify({
              type: 'recent_alerts',
              alerts: recentAlerts
            }));
          } catch (error) {
            console.error('Error fetching recent alerts:', error);
          }
          
          break;
          
        case 'command':
          // Handle commands from web clients to devices
          if (!ws.isWebClient) {
            console.warn('Received command from non-web client');
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Not authorized to send commands',
              code: 'NOT_AUTHORIZED'
            }));
            break;
          }
          
          // Validate required fields
          if (!data.deviceId || !data.command) {
            throw new Error('Missing required fields: deviceId or command');
          }
          
          const targetDevice = data.deviceId;
          if (connectedClients.has(targetDevice)) {
            try {
              // Forward command to the target device
              connectedClients.get(targetDevice).ws.send(JSON.stringify({
                type: 'command',
                command: data.command,
                params: data.params || {}
              }));
              
              ws.send(JSON.stringify({
                type: 'command_sent',
                deviceId: targetDevice,
                status: 'success'
              }));
              
              // Log command in database for audit trail
              await db.run(
                'INSERT INTO alerts (device_id, timestamp, type, message, status) VALUES (?, ?, ?, ?, ?)',
                [targetDevice, new Date().toISOString(), 'command', 
                 `Command: ${data.command}`, 'sent']
              );
            } catch (error) {
              console.error(`Error sending command to device ${targetDevice}:`, error);
              ws.send(JSON.stringify({
                type: 'command_sent',
                deviceId: targetDevice,
                status: 'error',
                message: 'Error sending command to device'
              }));
            }
          } else {
            ws.send(JSON.stringify({
              type: 'command_sent',
              deviceId: targetDevice,
              status: 'error',
              message: 'Device not connected'
            }));
          }
          
          break;
          
        default:
          console.log(`Unknown message type: ${data.type}`);
          ws.send(JSON.stringify({
            type: 'error',
            message: `Unknown message type: ${data.type}`,
            code: 'UNKNOWN_TYPE'
          }));
      }
    } catch (error) {
      console.error('Error processing message:', error);
      try {
        ws.send(JSON.stringify({
          type: 'error',
          message: `Error processing message: ${error.message}`,
          code: 'PROCESSING_ERROR'
        }));
      } catch (sendError) {
        console.error('Error sending error response:', sendError);
      }
    }
  });
  
  ws.on('error', (error) => {
    console.error(`WebSocket error for client ${deviceId}:`, error);
    // The error will trigger the close event
  });
  
  ws.on('close', async () => {
    console.log(`Connection closed: ${deviceId}`);
    
    // Remove from connected clients if it's a device
    if (connectedClients.has(deviceId)) {
      connectedClients.delete(deviceId);
      
      // Update device status in database
      try {
        await db.run(
          'UPDATE devices SET last_seen = ? WHERE id = ?',
          [new Date().toISOString(), deviceId]
        );
      } catch (error) {
        console.error('Error updating device status on disconnect:', error);
      }
      
      // Broadcast disconnect to web clients
      broadcastToWebClients({
        type: 'device_disconnected',
        deviceId,
        timestamp: new Date().toISOString()
      });
    }
  });
});

// Implement heartbeat to detect disconnected clients
const HEARTBEAT_INTERVAL = 30000; // 30 seconds

// Check for disconnected clients
function heartbeat() {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      // This client didn't respond to the previous ping
      console.log('Terminating inactive connection');
      return ws.terminate();
    }
    
    // Mark as inactive until we get a pong response
    ws.isAlive = false;
    // Send ping
    try {
      ws.ping();
    } catch (error) {
      console.error('Error sending ping:', error);
      ws.terminate();
    }
  });
}

// Start the heartbeat interval
let heartbeatInterval = null;

// Broadcast message to all connected web clients with throttling
let lastBroadcastTime = {};
const THROTTLE_INTERVAL = 500; // Minimum time between broadcasts of the same type in ms

function broadcastToWebClients(message) {
  const now = Date.now();
  
  // Throttle broadcasts of the same type to avoid overwhelming clients
  if (message.type) {
    const lastTime = lastBroadcastTime[message.type] || 0;
    if (now - lastTime < THROTTLE_INTERVAL) {
      if (config.logLevel === 'debug') {
        console.log(`Throttled broadcast of type ${message.type}`);
      }
      return;
    }
    lastBroadcastTime[message.type] = now;
  }
  
  // Broadcast to all web clients
  let count = 0;
  wss.clients.forEach((client) => {
    if (client.isWebClient && client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify(message));
        count++;
      } catch (error) {
        console.error('Error broadcasting to client:', error);
      }
    }
  });
  
  if (config.logLevel === 'debug') {
    console.log(`Broadcast ${message.type} to ${count} web clients`);
  }
}

// API endpoints with improved error handling and filtering
app.use(express.json()); // Add JSON body parsing middleware

// Add basic API middleware
function apiMiddleware(req, res, next) {
  // Add CORS headers if needed
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Basic API authentication could be added here
  /*
  if (process.env.API_KEY_REQUIRED === 'true') {
    const apiKey = req.header('Authorization');
    if (!apiKey || apiKey !== `Bearer ${process.env.API_KEY}`) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Valid API key required'
      });
    }
  }
  */
  
  next();
}

// Apply middleware to all API routes
app.use('/api', apiMiddleware);

// Get all devices
app.get('/api/devices', async (req, res) => {
  try {
    const { lastSeen, online, limit = 100, offset = 0 } = req.query;
    let query = 'SELECT * FROM devices';
    const params = [];
    const conditions = [];
    
    // Filter by last seen time
    if (lastSeen) {
      // Get devices seen in the last X minutes
      const minutes = parseInt(lastSeen, 10);
      if (!isNaN(minutes) && minutes > 0) {
        const cutoffTime = new Date();
        cutoffTime.setMinutes(cutoffTime.getMinutes() - minutes);
        conditions.push('last_seen > ?');
        params.push(cutoffTime.toISOString());
      }
    }
    
    // Filter by online status
    if (online === 'true') {
      // Devices seen in the last 2 minutes are considered online
      const cutoffTime = new Date();
      cutoffTime.setMinutes(cutoffTime.getMinutes() - 2);
      conditions.push('last_seen > ?');
      params.push(cutoffTime.toISOString());
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    // Apply pagination with reasonable limits
    const safeLimit = Math.min(parseInt(limit, 10) || 100, 500);
    const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);
    
    query += ' ORDER BY last_seen DESC LIMIT ? OFFSET ?';
    params.push(safeLimit, safeOffset);
    
    const devices = await db.all(query, params);
    
    // Get count of total devices for pagination
    const countResult = await db.get(
      `SELECT COUNT(*) as total FROM devices${conditions.length ? ' WHERE ' + conditions.join(' AND ') : ''}`,
      params.slice(0, -2) // Remove limit and offset
    );
    
    res.json({
      devices,
      pagination: {
        total: countResult.total,
        limit: safeLimit,
        offset: safeOffset
      }
    });
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ 
      error: 'Failed to fetch devices',
      message: error.message
    });
  }
});

// Get transcriptions with enhanced filtering
app.get('/api/transcriptions', async (req, res) => {
  try {
    const { 
      deviceId, 
      startDate, 
      endDate, 
      search,
      limit = 100, 
      offset = 0 
    } = req.query;
    
    let query = 'SELECT * FROM transcriptions';
    const params = [];
    const conditions = [];
    
    // Filter by device ID
    if (deviceId) {
      conditions.push('device_id = ?');
      params.push(deviceId);
    }
    
    // Filter by date range
    if (startDate) {
      try {
        // Validate date format
        const date = new Date(startDate);
        if (!isNaN(date.getTime())) {
          conditions.push('timestamp >= ?');
          params.push(date.toISOString());
        }
      } catch (e) {
        return res.status(400).json({ 
          error: 'Invalid startDate format. Use ISO format: YYYY-MM-DD',
          message: e.message
        });
      }
    }
    
    if (endDate) {
      try {
        // Validate date format
        const date = new Date(endDate);
        if (!isNaN(date.getTime())) {
          conditions.push('timestamp <= ?');
          params.push(date.toISOString());
        }
      } catch (e) {
        return res.status(400).json({ 
          error: 'Invalid endDate format. Use ISO format: YYYY-MM-DD',
          message: e.message
        });
      }
    }
    
    // Filter by search text
    if (search) {
      conditions.push('text LIKE ?');
      params.push(`%${search}%`);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    // Apply pagination with reasonable limits
    const safeLimit = Math.min(parseInt(limit, 10) || 100, 500);
    const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);
    
    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(safeLimit, safeOffset);
    
    const transcriptions = await db.all(query, params);
    
    // Get count of total transcriptions for pagination
    const countResult = await db.get(
      `SELECT COUNT(*) as total FROM transcriptions${conditions.length ? ' WHERE ' + conditions.join(' AND ') : ''}`,
      params.slice(0, -2) // Remove limit and offset
    );
    
    res.json({
      transcriptions,
      pagination: {
        total: countResult.total,
        limit: safeLimit,
        offset: safeOffset
      }
    });
  } catch (error) {
    console.error('Error fetching transcriptions:', error);
    res.status(500).json({ 
      error: 'Failed to fetch transcriptions',
      message: error.message
    });
  }
});

// Get alerts with enhanced filtering
app.get('/api/alerts', async (req, res) => {
  try {
    const { 
      deviceId, 
      status, 
      type,
      startDate,
      endDate,
      severity,
      limit = 100, 
      offset = 0 
    } = req.query;
    
    let query = 'SELECT * FROM alerts';
    const params = [];
    const conditions = [];
    
    if (deviceId) {
      conditions.push('device_id = ?');
      params.push(deviceId);
    }
    
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    
    if (type) {
      conditions.push('type = ?');
      params.push(type);
    }
    
    if (severity) {
      conditions.push('message LIKE ?');
      params.push(`%${severity} severity%`);
    }
    
    // Filter by date range
    if (startDate) {
      try {
        const date = new Date(startDate);
        if (!isNaN(date.getTime())) {
          conditions.push('timestamp >= ?');
          params.push(date.toISOString());
        }
      } catch (e) {
        return res.status(400).json({ 
          error: 'Invalid startDate format. Use ISO format: YYYY-MM-DD',
          message: e.message
        });
      }
    }
    
    if (endDate) {
      try {
        const date = new Date(endDate);
        if (!isNaN(date.getTime())) {
          conditions.push('timestamp <= ?');
          params.push(date.toISOString());
        }
      } catch (e) {
        return res.status(400).json({ 
          error: 'Invalid endDate format. Use ISO format: YYYY-MM-DD',
          message: e.message
        });
      }
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    // Apply pagination with reasonable limits
    const safeLimit = Math.min(parseInt(limit, 10) || 100, 500);
    const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);
    
    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(safeLimit, safeOffset);
    
    const alerts = await db.all(query, params);
    
    // Get count of total alerts for pagination
    const countResult = await db.get(
      `SELECT COUNT(*) as total FROM alerts${conditions.length ? ' WHERE ' + conditions.join(' AND ') : ''}`,
      params.slice(0, -2) // Remove limit and offset
    );
    
    res.json({
      alerts,
      pagination: {
        total: countResult.total,
        limit: safeLimit,
        offset: safeOffset
      }
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ 
      error: 'Failed to fetch alerts',
      message: error.message  
    });
  }
});

// Update alert status
app.post('/api/alerts/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status || !['new', 'acknowledged', 'resolved'].includes(status)) {
      return res.status(400).json({ 
        error: 'Invalid status value',
        message: 'Status must be one of: new, acknowledged, resolved'
      });
    }
    
    // Update alert status
    const result = await db.run(
      'UPDATE alerts SET status = ? WHERE id = ?',
      [status, id]
    );
    
    if (result.changes === 0) {
      return res.status(404).json({ 
        error: 'Alert not found',
        message: `No alert found with ID ${id}`
      });
    }
    
    // Get the updated alert
    const alert = await db.get('SELECT * FROM alerts WHERE id = ?', [id]);
    
    // Notify web clients about the status change
    broadcastToWebClients({
      type: 'alert_updated',
      alert
    });
    
    res.json({ 
      success: true,
      alert
    });
  } catch (error) {
    console.error('Error updating alert status:', error);
    res.status(500).json({ 
      error: 'Failed to update alert status',
      message: error.message
    });
  }
});

// Serve static files from the 'gui/build' directory
app.use(express.static(path.join(__dirname, 'gui/build')));

// Register AI Assistant routes
app.use('/api/assistant', aiAssistantRoutes);

// Catch-all route to return the React app for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'gui/build', 'index.html'));
});

// Export our app for testing
module.exports = {
  app,
  server,
  wss,
  setupDatabase,
  setupLangChain,
  broadcastToWebClients,
  heartbeat,
  config,
  db: () => db, // Function to access db instance
  startHeartbeat: () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
    heartbeatInterval = setInterval(heartbeat, HEARTBEAT_INTERVAL);
    return heartbeatInterval;
  },
  stopHeartbeat: () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  }
};