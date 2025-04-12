# Technical Context

_Technologies used, development setup, technical constraints, dependencies, and tool usage patterns._

## Languages and Frameworks
- **Backend:** Node.js (JavaScript)
- **Frontend:** React (JavaScript)
- **AI Integration:** OpenAI API, LangChain, LangGraph
- **Database:** SQLite with the `sqlite` and `sqlite3` packages
- **Testing:** Jest with mocks

## Development Environment
- OS: Cross-platform (Windows, Linux)
- Node.js runtime
- Package management via npm
- IDE: VSCode recommended
- Windows-specific scripts and patches included
- dotenv for environment variable management

## Dependencies
- **Backend:**
  - express (API server)
  - http (server creation)
  - ws (WebSocket server)
  - path, fs (file system operations)
  - @langchain/openai (OpenAI integration)
  - @langchain/langgraph (AI workflow orchestration)
  - sqlite3, sqlite (database)
  - dotenv (environment variables)
  - winston (logging)
  - child_process (for spawning processes)
- **Frontend:**
  - react, react-dom
  - react-bootstrap (UI components)
  - WebSocket client
  - Context API for state management
- **Client:**
  - ws (WebSocket client)
  - mic (audio capture)
  - fs, os, path (file system and OS operations)
  - child_process (for audio playback)
  - exponential backoff reconnection
- **Dev Dependencies:**
  - jest (testing framework)
  - babel (transpilation)
  - supertest (API testing)
  - mock-fs (file system mocking)
  - jest-mock-extended (enhanced mocking)

## Build and Deployment
- Backend started via Node.js (`node server.js`)
- Frontend built with React
- Client devices run `client.js`
- Scripts for Windows compatibility (`fix-sox-windows.js`, `windows-patch.js`)
- Tests run with Jest
- Client has systemd service installation option
- Deployment target: local servers, cross-platform

## Technical Constraints
- Must support Windows environments (special patches for mic module and SoX)
- Dependent on OpenAI API availability and proper API key
- Real-time communication requirements via WebSockets
- Audio processing capabilities with format compatibility
- SQLite database constraints
- Cross-platform compatibility challenges

## Tooling and Automation
- Jest for unit and integration testing
- Babel for transpilation
- npm scripts for build, test, run
- Windows install scripts (`install.ps1`, `install.sh`)
- Audio capture via mic module
- SoX for Windows audio handling
- OpenAI Whisper API for transcription
- Logging levels (debug, info, warn, error)

## Testing Strategy
- Unit tests for utility functions
- Integration tests for API endpoints
- WebSocket interaction testing
- OpenAI API interaction mocking
- Database operations testing
- Audio processing mocking
- File system operation mocking
- Mock implementations for external dependencies
- Setup/teardown patterns for test isolation

## Environment Configuration
- OPENAI_API_KEY for AI services
- PORT for server (default: 3000)
- DB_PATH for database location
- LOG_LEVEL for logging detail (debug, info, warn, error)
- DATA_DIR for file storage
- RETAIN_AUDIO_HOURS for cleanup
- ALERT_PHRASES for keyword detection
- WEB_AUTH_REQUIRED for web client authentication

## Software Architecture Patterns
- Express middleware pattern
- WebSocket event listeners
- State-based AI workflow with LangGraph
- React component hierarchy
- Context-based state management
- Exponential backoff for resilience
- Buffer-based audio processing
- Event-driven communication
