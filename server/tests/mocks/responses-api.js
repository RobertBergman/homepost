// Mock for OpenAI Responses API
const responsesApiMock = {
  processAudio: jest.fn(),
  analyzeText: jest.fn(),
  respondToQuery: jest.fn(),
  analyzeImage: jest.fn()
};

// Default implementations for the mock functions
responsesApiMock.processAudio.mockImplementation((audioBuffer, deviceId) => {
  return Promise.resolve(null);
});

responsesApiMock.analyzeText.mockImplementation((text, deviceId) => {
  return Promise.resolve({
    alerts: [
      {
        phrase: "help",
        severity: "medium"
      }
    ],
    summary: "Mock analysis summary",
    actionRequired: text.toLowerCase().includes('emergency') || text.toLowerCase().includes('help')
  });
});

responsesApiMock.respondToQuery.mockImplementation((query, clientId = 'web-client') => {
  return Promise.resolve("This is a mock response to your query: " + query);
});

responsesApiMock.analyzeImage.mockImplementation((imagePath, deviceId) => {
  return Promise.resolve({
    description: "Mock image analysis: The image shows a normal scene with no concerns",
    timestamp: new Date().toISOString(),
    deviceId
  });
});

module.exports = responsesApiMock;