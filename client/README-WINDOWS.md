# HomePost Client for Windows

This guide will help you install and configure the HomePost monitoring client on Windows 11 systems.

## Prerequisites

- Windows 10 or 11 (64-bit recommended)
- [Node.js](https://nodejs.org/) (Latest LTS version recommended)
- Administrator privileges (for service installation)

## Installation

1. Download or clone this repository to your Windows machine
2. Navigate to the `client` directory
3. Right-click on `install.ps1` and select "Run with PowerShell"
   - For best results, run as Administrator by selecting "Run as Administrator"
   - If you get a security warning, you may need to run: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` first

The installer will:
- Check for Node.js and npm
- Install required dependencies
- Apply Windows-specific patches for text-to-speech
- Create a default configuration file
- Install the client as a Windows service or scheduled task

## Configuration

After installation, edit the `config.json` file to set:

- `serverUrl`: The WebSocket URL of your HomePost server
- `deviceId`: A unique identifier for this device (auto-generated but can be customized)
- `deviceName`: A human-readable name for this device
- `location`: The physical location of this device

Example configuration:
```json
{
  "serverUrl": "ws://192.168.1.100:3000",
  "deviceId": "win-office-pc",
  "deviceName": "Office PC",
  "location": "Home Office",
  "isWindows": true,
  "micConfig": {
    "rate": "16000",
    "channels": "1",
    "device": "default",
    "fileType": "wav"
  },
  "reconnectInterval": 5000,
  "speakerEnabled": true,
  "openai": {
    "apiKey": "sk-your-openai-api-key",
    "voice": "alloy"
  }
}
```

### OpenAI Text-to-Speech

The client supports high-quality voice responses using OpenAI's TTS API:

- The installer will prompt you to configure OpenAI TTS during installation
- You can choose from several voices: alloy, echo, fable, onyx, nova, shimmer
- If OpenAI TTS fails or no API key is provided, the system automatically falls back to Windows built-in TTS
- You can update the OpenAI configuration later by editing `config.json`

To obtain an OpenAI API key:
1. Create or log in to your account at https://platform.openai.com/
2. Navigate to the API keys section
3. Create a new secret key
4. Keep in mind that using the OpenAI TTS API will incur usage charges based on OpenAI's pricing

## Client Management

If installed as a Windows service (required Administrator):
- **Check status:** `nssm status HomePostClient`
- **Start service:** `nssm start HomePostClient`
- **Stop service:** `nssm stop HomePostClient`
- **Restart service:** `nssm restart HomePostClient`
- **View logs:** Check `service-output.log` and `service-error.log` in the client directory

If installed as a scheduled task:
- **Start manually:** Run `start-homepost-client.bat`
- The client will start automatically at user logon

## Troubleshooting

### Microphone not working

1. Ensure your microphone is connected and working in Windows settings
2. Verify microphone permissions for the application
3. Try changing the `device` value in `micConfig` from "default" to another device name

### "spawn sox ENOENT" Error

If you encounter the error `Error: spawn sox ENOENT` when trying to start the client:

1. Use the dedicated fix script by running `start-fixed-windows.bat` instead of the regular startup method
   - This script automatically downloads SoX (required for audio capture)
   - It then patches the microphone module to use the correct path to sox.exe

The fix script addresses a common issue where the microphone module can't find the SoX executable, even though it's installed in the client/sox directory.

### Text-to-speech not working

1. If using OpenAI TTS:
   - Verify your API key is correct in config.json
   - Check internet connectivity
   - Confirm you have credit available on your OpenAI account
   
2. If using the built-in Windows TTS fallback:
   - Ensure Windows text-to-speech features are enabled
   - Check that audio output is properly connected and volume is up
   
3. For both:
   - Make sure `speakerEnabled` is set to `true` in your config.json
   - Try restarting the client service

### Connection problems

1. Verify the server URL in config.json is correct
2. Check if the server is running and accessible
3. Ensure there are no firewall rules blocking the connection
4. Check the service logs for detailed error messages

## Uninstallation

### If installed as a service:
```
nssm stop HomePostClient
nssm remove HomePostClient confirm
```

### If installed as a scheduled task:
```
schtasks /delete /tn HomePostClient /f
```

Then simply delete the client directory.
