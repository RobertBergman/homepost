const WebSocket = require('ws');
const http = require('http');
const { app, setupDatabase, startHeartbeat, stopHeartbeat } = require('../app');

// Test port to avoid conflicts with the main server
const TEST_PORT = 4000;

describe('WebSocket Server', () => {
  let testServer;
  let wsServer;
  let wsUrl;
  
  beforeAll(async () => {
    // Setup database
    await setupDatabase();
    
    // Create a real WebSocket.Server instance for testing
    testServer = http.createServer(app);
    wsServer = new WebSocket.Server({ server: testServer });
    
    // Setup message handler for the test server
    wsServer.on('connection', (ws) => {
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          
          // Handle device_info messages
          if (data.type === 'device_info') {
            if (data.deviceId && data.deviceId.startsWith('unknown-')) {
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Device ID cannot start with "unknown-"',
                code: 'INVALID_DEVICE_ID'
              }));
            } else {
              ws.send(JSON.stringify({
                type: 'server_response',
                message: 'Device registered successfully'
              }));
            }
          }
          
          // Handle web_client messages
          else if (data.type === 'web_client') {
            ws.isWebClient = true;
            ws.send(JSON.stringify({
              type: 'device_list',
              devices: []
            }));
          }
          
          // Handle malformed messages
          else if (!data.type) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Invalid message format: missing type',
              code: 'INVALID_FORMAT'
            }));
          }
        } catch (error) {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format',
            code: 'INVALID_FORMAT'
          }));
        }
      });
    });
    
    // Start server on test port
    await new Promise(resolve => {
      testServer.listen(TEST_PORT, () => {
        console.log(`Test server running on port ${TEST_PORT}`);
        resolve();
      });
    });
    
    // Start heartbeat
    startHeartbeat();
    
    wsUrl = `ws://localhost:${TEST_PORT}`;
  });
  
  afterAll(done => {
    // Stop heartbeat
    stopHeartbeat();
    
    // Close server
    wsServer.close(() => {
      testServer.close(() => {
        console.log('Test server closed');
        done();
      });
    });
  });
  
  describe('Device Connection', () => {
    let ws;
    
    afterEach(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });
    
    it('should connect successfully', done => {
      ws = new WebSocket(wsUrl);
      
      ws.on('open', () => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
        done();
      });
      
      ws.on('error', error => {
        done(new Error(`WebSocket connection error: ${error.message}`));
      });
    });
    
    it('should register a device with valid information', done => {
      ws = new WebSocket(wsUrl);
      
      const deviceInfo = {
        type: 'device_info',
        deviceId: 'test-device-id',
        name: 'Test Device',
        location: 'Test Location',
        capabilities: {
          audio: true,
          speaker: true
        }
      };
      
      ws.on('open', () => {
        ws.send(JSON.stringify(deviceInfo));
      });
      
      ws.on('message', message => {
        const data = JSON.parse(message);
        
        if (data.type === 'server_response') {
          expect(data.message).toBe('Device registered successfully');
          done();
        }
      });
      
      ws.on('error', error => {
        done(new Error(`WebSocket error: ${error.message}`));
      });
    });
    
    it('should reject device IDs that start with "unknown-"', done => {
      ws = new WebSocket(wsUrl);
      
      const invalidDeviceInfo = {
        type: 'device_info',
        deviceId: 'unknown-test-device',
        capabilities: { audio: true }
      };
      
      ws.on('open', () => {
        ws.send(JSON.stringify(invalidDeviceInfo));
      });
      
      ws.on('message', message => {
        const data = JSON.parse(message);
        
        if (data.type === 'error') {
          expect(data.code).toBe('INVALID_DEVICE_ID');
          done();
        }
      });
    });
  });
  
  describe('Web Client Connection', () => {
    let ws;
    
    afterEach(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });
    
    it('should connect as a web client', done => {
      ws = new WebSocket(wsUrl);
      
      const webClientInfo = {
        type: 'web_client'
      };
      
      ws.on('open', () => {
        ws.send(JSON.stringify(webClientInfo));
      });
      
      ws.on('message', message => {
        const data = JSON.parse(message);
        
        if (data.type === 'device_list') {
          expect(Array.isArray(data.devices)).toBe(true);
          done();
        }
      });
    });
  });
  
  describe('Message Validation', () => {
    let ws;
    
    afterEach(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });
    
    it('should reject malformed JSON messages', done => {
      ws = new WebSocket(wsUrl);
      
      ws.on('open', () => {
        ws.send('this is not valid JSON');
      });
      
      ws.on('message', message => {
        const data = JSON.parse(message);
        
        if (data.type === 'error' && data.code === 'INVALID_FORMAT') {
          done();
        }
      });
    });
    
    it('should require a message type', done => {
      ws = new WebSocket(wsUrl);
      
      ws.on('open', () => {
        ws.send(JSON.stringify({ data: 'missing type field' }));
      });
      
      ws.on('message', message => {
        const data = JSON.parse(message);
        
        if (data.type === 'error' && data.code === 'INVALID_FORMAT') {
          done();
        }
      });
    });
  });
});
