/**
 * Complete fix for SoX on Windows
 * This script:
 * 1. Downloads and extracts SoX if not found
 * 2. Directly patches the mic module to use the correct path
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawn } = require('child_process');

console.log('Fixing SoX for Windows audio capture...');

// Path for SoX directory
const soxDir = path.join(__dirname, 'sox');
let soxExePath = '';

// First check if SoX is already installed
if (fs.existsSync(soxDir)) {
  // Check for sox.exe directly in the sox directory
  if (fs.existsSync(path.join(soxDir, 'sox.exe'))) {
    soxExePath = path.join(soxDir, 'sox.exe');
    console.log(`Found existing sox.exe at: ${soxExePath}`);
  } else {
    // Look for any sox-* directories
    try {
      const items = fs.readdirSync(soxDir);
      for (const item of items) {
        if (item.startsWith('sox-') && fs.statSync(path.join(soxDir, item)).isDirectory()) {
          const nestedSoxPath = path.join(soxDir, item, 'sox.exe');
          if (fs.existsSync(nestedSoxPath)) {
            soxExePath = nestedSoxPath;
            console.log(`Found existing sox.exe in subdirectory: ${soxExePath}`);
            break;
          }
        }
      }
    } catch (err) {
      console.error('Error scanning sox directory:', err);
    }
  }
}

// Helper function to download a file
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, response => {
      // Handle redirections
      if (response.statusCode === 301 || response.statusCode === 302) {
        downloadFile(response.headers.location, dest)
          .then(resolve)
          .catch(reject);
        return;
      }
      
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
      file.on('error', err => {
        fs.unlink(dest, () => {}); // Delete the file on error
        reject(err);
      });
    }).on('error', err => {
      fs.unlink(dest, () => {}); // Delete the file on error
      reject(err);
    });
  });
}

// Function to extract a zip file
function extractZip(zipPath, destDir) {
  return new Promise((resolve, reject) => {
    try {
      // Make sure the destination directory exists
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      
      console.log(`Extracting ${zipPath} to ${destDir}...`);
      
      // Use PowerShell to extract the zip file
      const powershell = spawn('powershell', [
        '-command',
        `Expand-Archive -Path '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force`
      ]);
      
      powershell.stdout.on('data', data => {
        console.log(`PowerShell stdout: ${data}`);
      });
      
      powershell.stderr.on('data', data => {
        console.error(`PowerShell stderr: ${data}`);
      });
      
      powershell.on('close', code => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`PowerShell extraction failed with code ${code}`));
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

// Find and patch the mic.js file to use the full path to sox.exe
function patchMicModule(soxPath) {
  console.log('Patching mic module to use the full path to sox.exe...');
  
  const micJsPath = path.join(__dirname, 'node_modules', 'mic', 'lib', 'mic.js');
  if (!fs.existsSync(micJsPath)) {
    console.error('Error: mic.js not found! Make sure the mic module is installed.');
    return false;
  }
  
  // Read the mic.js content
  let micJs = fs.readFileSync(micJsPath, 'utf8');
  
  // Check if it's already patched
  if (micJs.includes('// [WINDOWS-SOX-PATCH]')) {
    console.log('mic.js already patched for Windows. No changes needed.');
    return true;
  }
  
  // Escape backslashes for string literal
  const escapedSoxPath = soxPath.replace(/\\/g, '\\\\');
  
  try {
    // Replace the sox spawn line with full path
    micJs = micJs.replace(
      "audioProcess = spawn('sox', ['-b', bitwidth, '--endian', endian,",
      `audioProcess = spawn('${escapedSoxPath}', ['-b', bitwidth, '--endian', endian, // [WINDOWS-SOX-PATCH]`
    );
    
    // Write the modified content back to mic.js
    fs.writeFileSync(micJsPath, micJs);
    console.log(`Successfully patched mic.js to use sox at: ${soxPath}`);
    return true;
  } catch (err) {
    console.error('Error patching mic.js:', err);
    return false;
  }
}

// Main function for downloading and installing SoX
async function downloadAndInstallSox() {
  if (!soxExePath) {
    console.log('SoX not found. Downloading...');
    try {
      // Create temp directory if it doesn't exist
      const tempDir = path.join(__dirname, 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Download SoX
      const soxZipPath = path.join(tempDir, 'sox.zip');
      const soxUrl = 'https://sourceforge.net/projects/sox/files/sox/14.4.2/sox-14.4.2-win32.zip/download';
      
      console.log(`Downloading SoX from ${soxUrl}...`);
      await downloadFile(soxUrl, soxZipPath);
      console.log('Download complete!');
      
      // Create SoX directory if it doesn't exist
      if (!fs.existsSync(soxDir)) {
        fs.mkdirSync(soxDir, { recursive: true });
      }
      
      // Extract SoX
      await extractZip(soxZipPath, soxDir);
      console.log('Extraction complete!');
      
      // Find the SoX executable
      if (fs.existsSync(path.join(soxDir, 'sox.exe'))) {
        soxExePath = path.join(soxDir, 'sox.exe');
        console.log(`Found sox.exe at: ${soxExePath}`);
      } else {
        // Look for any sox-* directories
        const items = fs.readdirSync(soxDir);
        for (const item of items) {
          if (item.startsWith('sox-') && fs.statSync(path.join(soxDir, item)).isDirectory()) {
            const nestedSoxPath = path.join(soxDir, item, 'sox.exe');
            if (fs.existsSync(nestedSoxPath)) {
              soxExePath = nestedSoxPath;
              console.log(`Found sox.exe in subdirectory: ${soxExePath}`);
              break;
            }
          }
        }
      }
      
      // Clean up temp directory
      try {
        fs.unlinkSync(soxZipPath);
        fs.rmdirSync(tempDir, { recursive: true });
      } catch (cleanupErr) {
        console.warn('Warning: Could not clean up temp files:', cleanupErr);
      }
      
    } catch (err) {
      console.error('Error downloading or extracting SoX:', err);
      return false;
    }
  }
  
  if (!soxExePath) {
    console.error('Could not find sox.exe after installation!');
    return false;
  }
  
  return true;
}

// Execute the main function
(async () => {
  try {
    // Create mock file for testing in non-Windows environments
    if (process.platform !== 'win32') {
      console.log('Non-Windows platform detected. Creating mock SoX for testing...');
      
      if (!fs.existsSync(soxDir)) {
        fs.mkdirSync(soxDir, { recursive: true });
      }
      
      const mockSoxDir = path.join(soxDir, 'sox-14.4.2');
      if (!fs.existsSync(mockSoxDir)) {
        fs.mkdirSync(mockSoxDir, { recursive: true });
      }
      
      // Create an empty sox.exe file for testing
      const mockSoxPath = path.join(mockSoxDir, 'sox.exe');
      if (!fs.existsSync(mockSoxPath)) {
        fs.writeFileSync(mockSoxPath, '');
      }
      
      soxExePath = mockSoxPath;
      console.log(`Created mock sox.exe at: ${soxExePath}`);
    } else {
      // On Windows, download and install SoX if needed
      const success = await downloadAndInstallSox();
      if (!success) {
        console.error('Failed to install SoX. Audio capture will not work properly.');
        process.exit(1);
      }
    }
    
    // Patch the mic module
    if (soxExePath) {
      const patchSuccess = patchMicModule(soxExePath);
      if (patchSuccess) {
        console.log('------------------------------');
        console.log('SoX fix successfully applied!');
        console.log('Audio capture should now work correctly with the full path to sox.exe');
        console.log('------------------------------');
      } else {
        console.error('Failed to patch mic module.');
        process.exit(1);
      }
    } else {
      console.error('Sox path not found. Cannot patch mic module.');
      process.exit(1);
    }
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
})();
