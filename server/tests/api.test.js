const request = require('supertest');
const { app, setupDatabase } = require('../app');

// Mock db setup before tests
beforeAll(async () => {
  // Setup in-memory database for testing
  await setupDatabase();
  
  // Add some test data
  const db = require('../app').db();
  
  // Add a test device
  await db.run(
    'INSERT INTO devices (id, name, location, capabilities, last_seen) VALUES (?, ?, ?, ?, ?)',
    ['test-device-1', 'Test Device', 'Living Room', JSON.stringify({ audio: true, speaker: true }), new Date().toISOString()]
  );
  
  // Add some test transcriptions
  await db.run(
    'INSERT INTO transcriptions (device_id, timestamp, text, confidence) VALUES (?, ?, ?, ?)',
    ['test-device-1', new Date().toISOString(), 'This is a test transcription', 1.0]
  );
  
  // Add some test alerts
  await db.run(
    'INSERT INTO alerts (device_id, timestamp, type, message, status) VALUES (?, ?, ?, ?, ?)',
    ['test-device-1', new Date().toISOString(), 'keyword_detected', 'Detected "help" (medium severity)', 'new']
  );
});

describe('API Endpoints', () => {
  describe('GET /api/devices', () => {
    it('should return a list of devices', async () => {
      const res = await request(app).get('/api/devices');
      
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('devices');
      expect(res.body).toHaveProperty('pagination');
      expect(Array.isArray(res.body.devices)).toBe(true);
      expect(res.body.devices.length).toBeGreaterThan(0);
      expect(res.body.devices[0]).toHaveProperty('id', 'test-device-1');
    });
    
    it('should filter devices by online status', async () => {
      const res = await request(app).get('/api/devices?online=true');
      
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('devices');
      expect(Array.isArray(res.body.devices)).toBe(true);
      // The test device should be considered online since we just created it
      expect(res.body.devices.length).toBeGreaterThan(0);
    });
  });
  
  describe('GET /api/transcriptions', () => {
    it('should return a list of transcriptions', async () => {
      const res = await request(app).get('/api/transcriptions');
      
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('transcriptions');
      expect(res.body).toHaveProperty('pagination');
      expect(Array.isArray(res.body.transcriptions)).toBe(true);
      expect(res.body.transcriptions.length).toBeGreaterThan(0);
      expect(res.body.transcriptions[0]).toHaveProperty('device_id', 'test-device-1');
      expect(res.body.transcriptions[0]).toHaveProperty('text', 'This is a test transcription');
    });
    
    it('should filter transcriptions by device id', async () => {
      const res = await request(app).get('/api/transcriptions?deviceId=test-device-1');
      
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('transcriptions');
      expect(Array.isArray(res.body.transcriptions)).toBe(true);
      expect(res.body.transcriptions.length).toBeGreaterThan(0);
      
      // All transcriptions should be from the specified device
      res.body.transcriptions.forEach(transcription => {
        expect(transcription).toHaveProperty('device_id', 'test-device-1');
      });
    });
    
    it('should filter transcriptions by search query', async () => {
      const res = await request(app).get('/api/transcriptions?search=test');
      
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('transcriptions');
      expect(Array.isArray(res.body.transcriptions)).toBe(true);
      expect(res.body.transcriptions.length).toBeGreaterThan(0);
      
      // All transcriptions should contain the search term
      res.body.transcriptions.forEach(transcription => {
        expect(transcription.text.toLowerCase()).toContain('test');
      });
    });
  });
  
  describe('GET /api/alerts', () => {
    it('should return a list of alerts', async () => {
      const res = await request(app).get('/api/alerts');
      
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('alerts');
      expect(res.body).toHaveProperty('pagination');
      expect(Array.isArray(res.body.alerts)).toBe(true);
      expect(res.body.alerts.length).toBeGreaterThan(0);
      expect(res.body.alerts[0]).toHaveProperty('device_id', 'test-device-1');
      expect(res.body.alerts[0]).toHaveProperty('type', 'keyword_detected');
      expect(res.body.alerts[0]).toHaveProperty('status', 'new');
    });
    
    it('should filter alerts by status', async () => {
      const res = await request(app).get('/api/alerts?status=new');
      
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('alerts');
      expect(Array.isArray(res.body.alerts)).toBe(true);
      expect(res.body.alerts.length).toBeGreaterThan(0);
      
      // All alerts should have the specified status
      res.body.alerts.forEach(alert => {
        expect(alert).toHaveProperty('status', 'new');
      });
    });
  });
  
  describe('POST /api/alerts/:id/status', () => {
    it('should update an alert status', async () => {
      // First get an alert id
      const alertsRes = await request(app).get('/api/alerts');
      const alertId = alertsRes.body.alerts[0].id;
      
      // Update the status
      const res = await request(app)
        .post(`/api/alerts/${alertId}/status`)
        .send({ status: 'acknowledged' });
      
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('alert');
      expect(res.body.alert).toHaveProperty('id', alertId);
      expect(res.body.alert).toHaveProperty('status', 'acknowledged');
      
      // Verify the status was updated in the database
      const verifyRes = await request(app).get(`/api/alerts?status=acknowledged`);
      expect(verifyRes.body.alerts.some(alert => alert.id === alertId)).toBe(true);
    });
    
    it('should return an error for invalid status values', async () => {
      // First get an alert id
      const alertsRes = await request(app).get('/api/alerts');
      const alertId = alertsRes.body.alerts[0].id;
      
      // Try to update with an invalid status
      const res = await request(app)
        .post(`/api/alerts/${alertId}/status`)
        .send({ status: 'invalid-status' });
      
      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toContain('Invalid status value');
    });
    
    it('should return a 404 for non-existent alerts', async () => {
      const res = await request(app)
        .post('/api/alerts/999999/status')
        .send({ status: 'acknowledged' });
      
      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toContain('Alert not found');
    });
  });
});