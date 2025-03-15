#!/usr/bin/env node

/**
 * OpenAI Text-to-Speech helper for HomePost client
 * This script converts text to speech using OpenAI's TTS API
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');

// Parse command line arguments
const args = process.argv.slice(2);
let text = '';
let outputFile = '';
let apiKey = '';
let voice = 'alloy';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--text' && i + 1 < args.length) {
    text = args[i + 1];
    i++;
  } else if (args[i] === '--output' && i + 1 < args.length) {
    outputFile = args[i + 1];
    i++;
  } else if (args[i] === '--apiKey' && i + 1 < args.length) {
    apiKey = args[i + 1];
    i++;
  } else if (args[i] === '--voice' && i + 1 < args.length) {
    voice = args[i + 1];
    i++;
  }
}

// Validate required parameters
if (!text || !outputFile || !apiKey) {
  console.error('Error: Missing required parameters');
  console.error('Usage: node openai-tts.js --text "Text to speak" --output output.mp3 --apiKey YOUR_API_KEY [--voice alloy]');
  process.exit(1);
}

// Ensure output directory exists
const outputDir = path.dirname(outputFile);
if (!fs.existsSync(outputDir)) {
  try {
    fs.mkdirSync(outputDir, { recursive: true });
  } catch (err) {
    console.error('Error creating output directory:', err);
    process.exit(1);
  }
}

// Function to call OpenAI API
async function generateSpeech() {
  const requestBody = JSON.stringify({
    model: 'tts-1',
    voice: voice,
    input: text
  });

  const options = {
    hostname: 'api.openai.com',
    path: '/v1/audio/speech',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'Content-Length': Buffer.byteLength(requestBody)
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      if (res.statusCode !== 200) {
        let errorData = '';
        res.on('data', (chunk) => {
          errorData += chunk;
        });
        res.on('end', () => {
          reject(new Error(`API request failed with status ${res.statusCode}: ${errorData}`));
        });
        return;
      }

      // Create file write stream
      const fileStream = fs.createWriteStream(outputFile);
      
      // Pipe response to file
      res.pipe(fileStream);
      
      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(requestBody);
    req.end();
  });
}

// Execute the speech generation
(async () => {
  try {
    await generateSpeech();
    console.log(`Speech generated successfully and saved to ${outputFile}`);
  } catch (error) {
    console.error('Error generating speech:', error.message);
    process.exit(1);
  }
})();
