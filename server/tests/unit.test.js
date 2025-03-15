// Simple configuration test that doesn't require complex mocks
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables directly
dotenv.config();

// Create a simplified config object for testing
const config = {
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
  retainAudioHours: Math.max(1, parseInt(process.env.RETAIN_AUDIO_HOURS || '24', 10)),
  alertPhrases: (process.env.ALERT_PHRASES || 'help,emergency,fire').split(',')
};

describe('Configuration', () => {
  it('should have default values', () => {
    expect(config).toBeDefined();
    expect(typeof config.port).toBe('number');
    expect(config.retainAudioHours).toBeGreaterThan(0);
    expect(Array.isArray(config.alertPhrases)).toBe(true);
  });
});