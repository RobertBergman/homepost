# Home Monitoring System Technical Specifications

## System Overview

The Home Monitoring System is a distributed application that uses Raspberry Pi devices with microphones to capture audio from different locations in a home, processes the audio using AI for transcription and analysis, and provides a web-based interface for monitoring and interaction.

## Client Specifications (Raspberry Pi)

### Hardware Requirements

| Component | Minimum Specification | Recommended Specification |
|-----------|----------------------|--------------------------|
| Raspberry Pi | Raspberry Pi 3 Model B | Raspberry Pi 4 Model B (4GB RAM) |
| Microphone | Any USB microphone | Blue Snowball or similar high-quality USB microphone |
| Speaker | Any USB or 3.5mm speaker | USB-powered speakers with good clarity |
| Power Supply | 5V 2.5A | 5V 3A official power supply |
| Storage | 8GB SD card | 32GB Class 10 SD card |
| Network | Wi-Fi or Ethernet | Ethernet (more reliable) |

### Software Requirements

| Software | Version | Purpose |
|----------|---------|---------|
| Raspberry Pi OS | Bullseye or newer (32/64-bit) | Operating System |
| Node.js | v16.x or newer | Runtime environment |
| npm | v8.x or newer | Package management |
| mic package | v2.1.2 or newer | Audio capture |
| ws package | v8.14.2 or newer | WebSocket communication |
| espeak | Latest | Text-to-speech for responses |

### Performance Specifications

- **Audio Capture**: 16-bit, 16kHz sample rate, mono channel
- **Network Bandwidth**: ~25-30 KB/s per device when streaming audio
- **Latency**: Typically <500ms from speech to server receipt
- **CPU Usage**: ~10-15% on Raspberry Pi 4
- **Memory Usage**: ~50-100MB

### Client Features

- **Audio Capture**: Real-time audio capture from microphone
- **Audio Streaming**: WebSocket-based transmission to central server
- **Text-to-Speech**: Ability to play spoken responses
- **Auto-reconnect**: Automatically reconnects if server connection is lost
- **Configuration Management**: Configurable device ID, server address, and options
- **Service Management**: Runs as a systemd service for automatic startup

## Server Specifications (Ubuntu Linux)

### Hardware Requirements

| Component | Minimum Specification | Recommended Specification |
|-----------|----------------------|--------------------------|
| CPU | 2 cores, 2.0GHz | 4+ cores, 3.0GHz+ |
| RAM | 4GB | 8GB+ |
| Storage | 50GB HDD | 100GB+ SSD |
| Network | 100Mbps Ethernet | 1Gbps Ethernet |

### Software Requirements

| Software | Version | Purpose |
|----------|---------|---------|
| Ubuntu | 20.04 LTS or newer | Operating System |
| Node.js | v16.x or newer | Runtime environment |
| npm | v8.x or newer | Package management |
| Express | v4.18.2 or newer | Web server framework |
| WebSocket (ws) | v8.14.2 or newer | Real-time communication |
| LangChain | v0.1.0 or newer | AI processing workflows |
| SQLite | v5.1.1 or newer | Database storage |
| React | v18.2.0 or newer | Web interface |

### Database Schema

#### Devices Table
```sql
CREATE TABLE devices (
  id TEXT PRIMARY KEY,
  name TEXT,
  location TEXT,
  capabilities TEXT,
  last_seen TIMESTAMP
);
```

#### Transcriptions Table
```sql
CREATE TABLE transcriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT,
  timestamp TIMESTAMP,
  text TEXT,
  confidence REAL,
  FOREIGN KEY (device_id) REFERENCES devices(id)
);
```

#### Alerts Table
```sql
CREATE TABLE alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT,
  timestamp TIMESTAMP,
  type TEXT,
  message TEXT,
  status TEXT,
  FOREIGN KEY (device_id) REFERENCES devices(id)
);
```

### Server Features

- **Device Management**: Handles multiple connected Raspberry Pi clients
- **Audio Processing**: Transcribes audio using OpenAI Realtime API
- **Alert Detection**: Uses LangChain workflows to identify alert phrases
- **Data Storage**: Logs transcriptions and alerts to SQLite database
- **Web Server**: Serves React-based frontend and REST API
- **WebSocket Support**: Real-time communication with clients and web interface
- **Security**: Local network operation with optional API authentication
- **Data Retention**: Configurable cleanup of old audio data

## Communication Protocol

### WebSocket Messages

#### Client to Server

| Message Type | Fields | Description |
|--------------|--------|-------------|
| `device_info` | `deviceId`, `capabilities` | Device registration with server |
| `audio_data` | `deviceId`, `timestamp`, `data` (base64) | Audio chunk from client |

#### Server to Client

| Message Type | Fields | Description |
|--------------|--------|-------------|
| `server_response` | `message` | General server acknowledgment |
| `speak` | `text` | Text to be spoken by client |
| `command` | `command`, `params` | Command for client to execute |

#### Server to Web Client

| Message Type | Fields | Description |
|--------------|--------|-------------|
| `device_list` | `devices` | List of connected devices |
| `device_connected` | `deviceId`, `capabilities` | New device connected |
| `device_disconnected` | `deviceId` | Device disconnected |
| `transcription` | `deviceId`, `timestamp`, `text` | New transcription |
| `alert` | `deviceId`, `timestamp`, `message`, `severity` | New alert detected |

#### Web Client to Server

| Message Type | Fields | Description |
|--------------|--------|-------------|
| `web_client` | - | Register as web client |
| `command` | `deviceId`, `command`, `params` | Send command to specific device |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/devices` | GET | List all devices |
| `/api/transcriptions` | GET | Get transcriptions with optional filtering |
| `/api/alerts` | GET | Get alerts with optional filtering |
| `/api/settings` | GET | Get server settings |
| `/api/settings` | POST | Update server settings |

## Web Interface Specifications

### Technical Stack

- **Framework**: React 18
- **UI Library**: Bootstrap 5 / React-Bootstrap
- **State Management**: React Context API
- **Routing**: React Router v6
- **Real-time Communication**: WebSockets

### Interface Components

- **Dashboard**: Overview of all devices and high-priority alerts
- **Device Details**: Detailed view of a specific device with transcription history
- **Alerts**: Management of all system alerts
- **Settings**: System configuration options

### Responsive Design

- **Breakpoints**: Mobile (<768px), Tablet (768px-992px), Desktop (>992px)
- **Layout**: Sidebar navigation with main content area
- **Mobile Support**: Collapsible navigation for small screens

## Security Specifications

- **Network Isolation**: Operation limited to local network
- **Data Storage**: All data stored locally
- **Cloud Services**: Only OpenAI API used for transcription
- **Data Retention**: Audio files automatically deleted after configurable time period (default: 24 hours)
- **Authentication**: Optional JWT-based authentication for web interface

## Performance and Scaling

- **Device Support**: Tested with up to 10 simultaneous Raspberry Pi clients
- **Transcription Latency**: Typically <2 seconds from speech to transcription display
- **Database Performance**: Optimized for rapid retrieval of recent transcriptions
- **Alert Response Time**: <3 seconds from keyword detection to alert creation
- **Browser Support**: Modern browsers (Chrome, Firefox, Safari, Edge)

## Customization Options

- **Alert Phrases**: Configurable list of phrases that trigger alerts
- **Alert Severity Levels**: Configurable mapping of phrases to severity levels
- **Audio Retention**: Configurable time period for audio data retention
- **Device Names**: Custom naming and location assignment for devices
- **Server Port**: Configurable port for web server (default: 3000)

## Deployment Recommendations

- **Network**: Closed home network with router firewall enabled
- **Backup**: Regular database backups (weekly recommended)
- **Updates**: Keep Node.js and npm packages updated for security
- **Monitoring**: Use systemd service monitoring to ensure uptime
- **Power**: UPS recommended for server to prevent data corruption during power outages