# Home Monitoring System with Raspberry Pi and AI Processing

A comprehensive home monitoring system that uses Raspberry Pi devices with microphones to capture audio from around your home. The audio is streamed to a central server where it's processed in real-time using the OpenAI Realtime API for transcription and LangChain for further analysis.

## Features

- **Real-Time Audio Monitoring:** Capture and process audio from multiple Raspberry Pi devices.
- **AI-Powered Transcription:** Convert speech to text using OpenAI's Realtime API.
- **Intelligent Alerts:** Automatically detect keywords like "help" or "emergency" and trigger alerts.
- **Text-to-Speech Responses:** Send spoken responses back to the Raspberry Pi devices.
- **Web Dashboard:** Monitor all devices, view transcriptions, and manage settings from a web interface.

## System Architecture

The system consists of two main components:

### Raspberry Pi Client

- Runs on each Raspberry Pi device placed throughout your home
- Captures audio using a USB or built-in microphone
- Streams audio data to the central server
- Can play audio responses through connected speakers

### Central Server

- Runs on a Linux machine (like Ubuntu) within your home network
- Receives audio streams from all connected Raspberry Pi clients
- Processes audio using OpenAI Realtime API for transcription
- Uses LangChain and LangGraph for keyword detection and alert generation
- Hosts a web server with a React-based user interface
- Stores transcriptions and alerts in a SQLite database

## Setup and Installation

### Raspberry Pi Setup

1. Install Raspberry Pi OS on your device
2. Clone this repository and navigate to the client directory
3. Install dependencies:
   ```
   npm install
   ```
4. Run the installation script:
   ```
   ./install.sh
   ```
5. Configure your client by editing `config.json` to point to your server's IP address

### Server Setup

1. Install on a Linux machine (Ubuntu recommended)
2. Clone this repository and navigate to the server directory
3. Run the installation script:
   ```
   ./install.sh
   ```
4. Configure your server by editing the `.env` file with your OpenAI API key
5. Start the server:
   ```
   sudo systemctl start homepost-server
   ```

## Usage

### Web Interface

Access the web dashboard by navigating to `http://<your-server-ip>:3000` in your web browser. From there, you can:

- View all connected devices
- See real-time transcriptions from each device
- Configure alert keywords and system settings
- Send spoken messages to specific devices
- View and manage alerts

### Alerts

The system will automatically detect keywords or phrases (configurable in settings) and create alerts of different severity levels. High-severity alerts like "emergency" or "fire" will:

1. Create a high-priority alert in the web dashboard
2. Send a spoken response to the device asking if assistance is needed

## Security and Privacy

- All processing happens locally on your network - no data is sent to the cloud except for the OpenAI API
- Audio data is automatically deleted after a configurable period (default: 24 hours)
- For additional security, consider setting up user authentication in the web interface

## License

This project is licensed under the MIT License - see the LICENSE file for details.