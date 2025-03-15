// OpenAI Responses API service
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Try to import AI SDK, but handle potential errors for older Node versions
let openai;
let provider;

try {
  // Dynamic import to allow fallback if this fails
  const aiSdk = require('@ai-sdk/openai');
  openai = aiSdk.openai;
  provider = openai.responses('gpt-4o');
  console.log('Successfully loaded OpenAI Responses API');
} catch (error) {
  console.warn('Could not load @ai-sdk/openai, using fallback implementation:', error.message);
  provider = null;
}

// Map to store conversation IDs for persistent sessions
const conversationMap = new Map();

/**
 * Process audio through OpenAI Whisper API and return transcription
 * @param {Buffer} audioBuffer - Audio data buffer
 * @param {string} deviceId - Device identifier
 * @returns {Promise<string>} - Transcription text
 */
async function processAudio(audioBuffer, deviceId) {
  // For now, calling the original transcription service
  // In a future enhancement, we could use multimodal capabilities
  // This function will be implemented later when we move from Whisper to Responses API for transcription
  return null;
}

/**
 * Analyze text for potential alerts or insights
 * @param {string} text - Text to analyze
 * @param {string} deviceId - Device identifier
 * @returns {Promise<Object>} - Analysis results with alerts
 */
async function analyzeText(text, deviceId) {
  // Generate a unique conversation ID for this device if not exists
  if (!conversationMap.has(deviceId)) {
    conversationMap.set(deviceId, uuidv4());
  }
  
  const persistentId = conversationMap.get(deviceId);
  
  // If provider is available, use the AI SDK
  if (provider) {
    try {
      const response = await provider.request({
        persistentId,
        messages: [
          {
            role: 'system',
            content: `You are a home monitoring assistant. Your job is to analyze transcribed speech 
            from audio captured in a home environment and detect potential emergencies, security concerns, 
            or requests for help. Always respond with a JSON object containing:
            1. "alerts": An array of alerts detected (empty if none) with each containing "phrase", "severity" (high, medium, low)
            2. "summary": A brief interpretation of what's happening
            3. "actionRequired": Boolean indicating if immediate action might be needed`
          },
          { role: 'user', content: text }
        ],
        structure: {
          type: 'object',
          properties: {
            alerts: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  phrase: { type: 'string' },
                  severity: { type: 'string', enum: ['high', 'medium', 'low'] }
                }
              }
            },
            summary: { type: 'string' },
            actionRequired: { type: 'boolean' }
          }
        },
        providerOptions: {
          temperature: 0.1 // Low temperature for more predictable responses
        }
      });
      
      return response.content;
    } catch (error) {
      console.error('Error analyzing text with Responses API:', error);
      // Fall through to the fallback implementation
    }
  }
  
  // Fallback implementation when provider is not available
  console.log('Using fallback implementation for text analysis');
  
  // Basic regex-based detection
  const alerts = [];
  const lowerText = text.toLowerCase();
  
  // Check for common emergency phrases
  const emergencyPhrases = ['help', 'emergency', 'fire', 'police', 'ambulance'];
  for (const phrase of emergencyPhrases) {
    if (lowerText.includes(phrase)) {
      alerts.push({
        phrase: phrase,
        severity: (phrase === 'emergency' || phrase === 'fire') ? 'high' : 'medium'
      });
    }
  }
  
  return {
    alerts: alerts,
    summary: "Basic text analysis using fallback implementation",
    actionRequired: alerts.length > 0
  };
}

/**
 * Generate a response to a query for a web client
 * @param {string} query - User query
 * @param {string} clientId - Web client identifier
 * @returns {Promise<string>} - AI response
 */
async function respondToQuery(query, clientId = 'web-client') {
  // Generate a unique conversation ID for this client if not exists
  if (!conversationMap.has(clientId)) {
    conversationMap.set(clientId, uuidv4());
  }
  
  const persistentId = conversationMap.get(clientId);
  
  // If provider is available, use the AI SDK
  if (provider) {
    try {
      const response = await provider.request({
        persistentId,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant for a home monitoring system. You can provide information about the system, explain alerts, and suggest actions based on events detected in the home.'
          },
          { role: 'user', content: query }
        ],
        providerOptions: {
          temperature: 0.7
        }
      });
      
      return response.content;
      
    } catch (error) {
      console.error('Error generating response with Responses API:', error);
      // Fall through to the fallback implementation
    }
  }
  
  // Fallback implementation when provider is not available
  console.log('Using fallback implementation for query response');
  
  // Simple response based on keywords in the query
  const lowerQuery = query.toLowerCase();
  
  if (lowerQuery.includes('help') || lowerQuery.includes('how to')) {
    return "The home monitoring system listens for unusual sounds or spoken alerts in your home. It can detect emergency keywords and notify you via the web interface. For more specific help, please consult the documentation.";
  } 
  else if (lowerQuery.includes('alert') || lowerQuery.includes('alarm')) {
    return "Alerts are generated when the system detects emergency keywords like 'help', 'fire', or 'emergency' in audio it captures. You can view all alerts in the Alerts section of the dashboard.";
  }
  else if (lowerQuery.includes('camera') || lowerQuery.includes('image') || lowerQuery.includes('video')) {
    return "Image analysis capabilities are limited in this version. When a compatible camera is connected, you can view the footage through the dashboard.";
  }
  
  return "I'm a simple assistant for the home monitoring system. In this basic mode, I can only provide general information about the system's features.";
}

/**
 * Analyze an image from a connected camera
 * @param {string} imagePath - Path to the image file
 * @param {string} deviceId - Device identifier
 * @returns {Promise<Object>} - Analysis results
 */
async function analyzeImage(imagePath, deviceId) {
  // If provider is available, use the AI SDK
  if (provider) {
    try {
      // Read and encode the image as base64
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');
      
      const response = await provider.request({
        messages: [
          { 
            role: 'system',
            content: 'You are a security camera assistant that analyzes images for potential security concerns or unusual activity. Describe what you see in detail and note any people, unusual objects, or concerning situations.'
          },
          { 
            role: 'user', 
            content: [
              { type: 'text', text: 'What do you see in this security camera image? Is there anything concerning?' },
              { type: 'image', image: base64Image }
            ]
          }
        ],
        providerOptions: {
          temperature: 0.1
        }
      });
      
      return {
        description: response.content,
        timestamp: new Date().toISOString(),
        deviceId
      };
      
    } catch (error) {
      console.error('Error analyzing image with Responses API:', error);
      // Fall through to the fallback implementation
    }
  }
  
  // Fallback implementation
  console.log('Using fallback implementation for image analysis');
  
  return {
    description: "Image analysis is not available in basic mode. This feature requires the advanced AI model which is not currently loaded.",
    timestamp: new Date().toISOString(),
    deviceId,
    basicMode: true
  };
}

module.exports = {
  processAudio,
  analyzeText,
  respondToQuery,
  analyzeImage
};