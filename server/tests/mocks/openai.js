// Mock for OpenAI Realtime API
function createRealtimeAudioTranscriptionRequest(config) {
  return {
    sendAudio: (audioBuffer) => {
      // Simulate transcription by calling the onMessage callback
      if (config.onMessage && typeof config.onMessage === 'function') {
        // Call onMessage with a mock transcription result
        setTimeout(() => {
          config.onMessage({
            type: 'text',
            text: 'This is a mock transcription response'
          });
        }, 50);
      }
    },
    closeStream: () => {
      // Mock implementation - does nothing
    }
  };
}

module.exports = {
  createRealtimeAudioTranscriptionRequest
};