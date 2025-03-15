// Test file for utility functions

// Simple alert detection utility extracted from the main code for testing
function detectAlerts(text, alertPhrases) {
  const alerts = [];
  const lowerText = text.toLowerCase();
  
  // Check for whole word matches
  for (const phrase of alertPhrases) {
    const lowerPhrase = phrase.toLowerCase().trim();
    // Check for whole word match using word boundaries
    // We need to escape special regex characters in the phrase
    const escapedPhrase = lowerPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedPhrase}\\b`, 'i');
    
    if (regex.test(lowerText)) {
      alerts.push({
        phrase,
        severity: phrase === 'emergency' || phrase === 'fire' ? 'high' : 'medium'
      });
    }
  }
  
  return alerts;
}

describe('Alert Detection', () => {
  const alertPhrases = ['help', 'emergency', 'fire'];
  
  test('should detect alert phrases in text', () => {
    const text = 'I need help with this problem';
    const alerts = detectAlerts(text, alertPhrases);
    
    expect(alerts.length).toBe(1);
    expect(alerts[0].phrase).toBe('help');
    expect(alerts[0].severity).toBe('medium');
  });
  
  test('should detect multiple alerts in text', () => {
    const text = 'Help! There is a fire in the room!';
    const alerts = detectAlerts(text, alertPhrases);
    
    expect(alerts.length).toBe(2);
    
    // Find the alerts for each phrase
    const helpAlert = alerts.find(a => a.phrase === 'help');
    const fireAlert = alerts.find(a => a.phrase === 'fire');
    
    expect(helpAlert).toBeDefined();
    expect(fireAlert).toBeDefined();
    expect(helpAlert.severity).toBe('medium');
    expect(fireAlert.severity).toBe('high');
  });
  
  test('should assign high severity to emergency and fire', () => {
    const emergencyText = 'This is an emergency situation';
    const fireText = 'There is a fire in the building';
    
    const emergencyAlerts = detectAlerts(emergencyText, alertPhrases);
    const fireAlerts = detectAlerts(fireText, alertPhrases);
    
    expect(emergencyAlerts[0].severity).toBe('high');
    expect(fireAlerts[0].severity).toBe('high');
  });
  
  test('should not detect partial word matches', () => {
    // Make sure to use words that contain but don't exactly match the alert phrases
    const text = 'This is helpful and we should not emergencies';
    const alerts = detectAlerts(text, alertPhrases);
    
    expect(alerts.length).toBe(0);
  });
  
  test('should be case insensitive', () => {
    const texts = [
      'HELP me please',
      'I need Help',
      'help! FIRE! Emergency!'
    ];
    
    texts.forEach(text => {
      const alerts = detectAlerts(text, alertPhrases);
      expect(alerts.length).toBeGreaterThan(0);
    });
  });
});