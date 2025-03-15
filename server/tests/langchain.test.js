const { setupLangChain, setupDatabase } = require('../app');

// Mock the database functions and broadcast
jest.mock('../app', () => {
  const originalModule = jest.requireActual('../app');
  
  return {
    ...originalModule,
    db: () => ({
      run: jest.fn().mockResolvedValue({}),
      get: jest.fn().mockResolvedValue({}),
      all: jest.fn().mockResolvedValue([])
    }),
    broadcastToWebClients: jest.fn()
  };
});

describe('LangChain Workflow', () => {
  let workflow;
  
  beforeAll(async () => {
    // Initialize and get the workflow
    workflow = await setupLangChain();
  });
  
  it('should create a reusable workflow instance', async () => {
    expect(workflow).toBeDefined();
    
    // The second call should return the same instance
    const secondInstance = await setupLangChain();
    expect(secondInstance).toBe(workflow);
  });
  
  it('should process text without alerts', async () => {
    const result = await workflow.invoke({
      text: 'This is a normal sentence without alert words',
      deviceId: 'test-device'
    });
    
    expect(result).toHaveProperty('text');
    expect(result).toHaveProperty('deviceId', 'test-device');
    expect(result).toHaveProperty('alerts');
    expect(result.alerts).toHaveLength(0);
  });
  
  it('should detect alert phrases in text', async () => {
    const result = await workflow.invoke({
      text: 'I need help with this problem',
      deviceId: 'test-device'
    });
    
    expect(result).toHaveProperty('alerts');
    expect(result.alerts.length).toBeGreaterThan(0);
    expect(result.alerts[0]).toHaveProperty('phrase', 'help');
    expect(result.alerts[0]).toHaveProperty('severity', 'medium');
  });
  
  it('should detect emergency alerts with high severity', async () => {
    const result = await workflow.invoke({
      text: 'There is an emergency in the kitchen',
      deviceId: 'test-device'
    });
    
    expect(result).toHaveProperty('alerts');
    expect(result.alerts.length).toBeGreaterThan(0);
    expect(result.alerts[0]).toHaveProperty('phrase', 'emergency');
    expect(result.alerts[0]).toHaveProperty('severity', 'high');
  });
  
  it('should not flag partial word matches', async () => {
    const result = await workflow.invoke({
      text: 'I am helpful and enjoy emergency services documentaries',
      deviceId: 'test-device'
    });
    
    // The workflow should now use whole-word matching only
    expect(result.alerts).toHaveLength(0);
  });
  
  it('should detect multiple alerts in the same text', async () => {
    const result = await workflow.invoke({
      text: 'Help! There is a fire in the kitchen!',
      deviceId: 'test-device'
    });
    
    expect(result).toHaveProperty('alerts');
    expect(result.alerts.length).toBe(2);
    
    // Check for both alerts, order may vary
    const phrases = result.alerts.map(alert => alert.phrase);
    expect(phrases).toContain('help');
    expect(phrases).toContain('fire');
    
    // Check that fire is high severity
    const fireAlert = result.alerts.find(alert => alert.phrase === 'fire');
    expect(fireAlert).toHaveProperty('severity', 'high');
  });
});