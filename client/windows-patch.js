/**
 * Windows-specific patches for HomePost client
 * This script modifies the client.js file to work better on Windows
 */

const fs = require('fs');
const path = require('path');

console.log('Applying Windows-specific patches to client.js...');

// Path to client.js
const clientJsPath = path.join(__dirname, 'client.js');

// Check if client.js exists
if (!fs.existsSync(clientJsPath)) {
  console.error('Error: client.js not found!');
  process.exit(1);
}

// Read client.js content
let clientJs = fs.readFileSync(clientJsPath, 'utf8');

// Detect if the file has already been patched
if (clientJs.includes('// [WINDOWS-PATCH]')) {
  console.log('client.js already patched for Windows. No changes needed.');
  process.exit(0);
}

// Add Windows detection and SoX path setup
clientJs = clientJs.replace(
  'const isConnected = false;',
  `const isConnected = false;
const isWindows = process.platform === 'win32'; // [WINDOWS-PATCH]

// Setup SoX paths for Windows
if (isWindows) {
  // Add local sox directory to PATH if it exists
  const soxDir = path.join(__dirname, 'sox');
  if (fs.existsSync(soxDir)) {
    process.env.PATH = \`\${soxDir};\${process.env.PATH}\`;
    log.info('Added local SoX directory to PATH');
    
    // Also update mic configuration to use local sox.exe
    if (config.micConfig) {
      config.micConfig.endian = 'little';  // Ensure correct endianness for Windows
      
      // Extend mic config with the explicit path to sox.exe
      config.micConfig.soxPath = path.join(soxDir, 'sox.exe');
      log.info(\`Using SoX from: \${config.micConfig.soxPath}\`);
    }
  } else {
    log.warn('Local SoX directory not found. Audio capture may not work properly.');
    log.info('Please run install.ps1 to install SoX.');
  }
}`
);

// Patch the speakResponse function to use OpenAI TTS
clientJs = clientJs.replace(
  `// Use text-to-speech to speak responses with better error handling
function speakResponse(text) {
  if (!config.speakerEnabled || !text) {
    return;
  }
  
  log.info(\`Speaking: \${text}\`);
  
  // Sanitize text to prevent command injection
  const sanitizedText = text.replace(/[;&|<>$]/g, '');
  
  try {
    // Use espeak for text-to-speech
    // Install with: sudo apt-get install espeak
    const espeak = spawn('espeak', [sanitizedText]);
    
    espeak.on('error', (err) => {
      log.error('Error with text-to-speech:', err);
      log.info('Make sure espeak is installed with: sudo apt-get install espeak');
    });
    
    // Capture output for debugging
    espeak.stdout.on('data', (data) => {
      log.debug(\`espeak stdout: \${data}\`);
    });
    
    espeak.stderr.on('data', (data) => {
      log.debug(\`espeak stderr: \${data}\`);
    });
    
    espeak.on('close', (code) => {
      if (code !== 0) {
        log.warn(\`espeak process exited with code \${code}\`);
      }
    });
  } catch (error) {
    log.error('Failed to spawn espeak process:', error);
  }
}`,

  `// Use text-to-speech to speak responses with better error handling
// Now using OpenAI's TTS API
async function speakResponse(text) {
  if (!config.speakerEnabled || !text) {
    return;
  }
  
  log.info(\`Speaking: \${text}\`);
  
  try {
    // Check if OpenAI API key is configured
    if (!config.openai || !config.openai.apiKey) {
      log.error('OpenAI API key not configured. Please add it to config.json');
      fallbackSpeech(text);
      return;
    }

    // Use the OpenAI TTS helper
    const ttsHelperPath = path.join(__dirname, 'openai-tts.js');
    
    // Create a temporary file for the speech MP3
    const tempFile = path.join(os.tmpdir(), \`speech-\${Date.now()}.mp3\`);
    
    // Run the OpenAI TTS helper as a separate process
    const ttsProcess = spawn('node', [
      ttsHelperPath, 
      '--text', text,
      '--output', tempFile,
      '--apiKey', config.openai.apiKey,
      '--voice', config.openai.voice || 'alloy'
    ]);
    
    // Wait for the TTS process to complete
    ttsProcess.on('close', (code) => {
      if (code !== 0) {
        log.error(\`OpenAI TTS process exited with code \${code}\`);
        fallbackSpeech(text);
        return;
      }
      
      // Play the audio file
      let player;
      if (process.platform === 'win32') {
        player = spawn('powershell', [
          '-c', 
          \`(New-Object Media.SoundPlayer "\${tempFile}").PlaySync()\`
        ]);
      } else if (process.platform === 'darwin') {
        player = spawn('afplay', [tempFile]);
      } else {
        player = spawn('aplay', [tempFile]);
      }
      
      player.on('error', (err) => {
        log.error('Error playing audio:', err);
      });
      
      player.on('close', () => {
        // Clean up temp file
        try {
          fs.unlinkSync(tempFile);
        } catch (err) {
          log.debug('Error removing temp file:', err);
        }
      });
    });
    
    ttsProcess.on('error', (err) => {
      log.error('Error starting OpenAI TTS process:', err);
      fallbackSpeech(text);
    });
    
    // Handle stderr for debugging
    ttsProcess.stderr.on('data', (data) => {
      log.debug(\`OpenAI TTS stderr: \${data}\`);
    });
    
  } catch (error) {
    log.error('Failed to use OpenAI TTS:', error);
    fallbackSpeech(text);
  }
}

// Fallback speech function if OpenAI TTS fails
function fallbackSpeech(text) {
  const sanitizedText = text.replace(/[;&|<>$]/g, '');
  
  try {
    if (process.platform === 'win32') {
      // Use Windows PowerShell for text-to-speech as fallback
      const powershell = spawn('powershell', [
        '-c',
        \`Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).Speak('\${sanitizedText.replace(/'/g, "''")}')\`
      ]);
      
      powershell.on('error', (err) => {
        log.error('Error with fallback Windows text-to-speech:', err);
      });
    } else {
      // Use espeak for text-to-speech on Linux as fallback
      const espeak = spawn('espeak', [sanitizedText]);
      
      espeak.on('error', (err) => {
        log.error('Error with fallback text-to-speech:', err);
      });
    }
  } catch (error) {
    log.error('Failed to use fallback speech:', error);
  }
}`
);

// Add required modules if not already included
let modulesToAdd = [];

if (!clientJs.includes('const path = require(\'path\');')) {
  modulesToAdd.push('const path = require(\'path\');');
}

if (!clientJs.includes('const os = require(\'os\');')) {
  modulesToAdd.push('const os = require(\'os\');');
}

if (modulesToAdd.length > 0) {
  clientJs = clientJs.replace(
    'const fs = require(\'fs\');',
    'const fs = require(\'fs\');\n' + modulesToAdd.join('\n')
  );
}

// Write the modified content back to client.js
fs.writeFileSync(clientJsPath, clientJs);

console.log('Successfully patched client.js for Windows!');
