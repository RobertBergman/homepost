# System Patterns

_System architecture, key technical decisions, design patterns, component relationships, and critical implementation paths._

## Architecture Overview
HomePost is a client-server system with:
- A **Node.js backend** providing REST APIs and WebSocket communication
- A **React frontend** served via a GUI submodule
- **Client application** for device-side audio capture and communication
- Integration with **OpenAI APIs** for AI assistant features and TTS
- Use of **LangChain** and **LangGraph** for AI workflow orchestration
- **SQLite database** for device, transcription, and alert storage
- Audio processing components for TTS and voice interaction
- Cross-platform support scripts, including Windows-specific patches

## Key Technical Decisions
- Use of Node.js for backend scalability and ecosystem support
- React for a responsive, component-based frontend
- WebSockets for real-time device communication with ping/pong health checks
- OpenAI API integration for AI capabilities (transcription, analysis)
- LangChain and LangGraph to manage complex AI workflows in a state-based architecture
- SQLite with optimized pragmas and indexes for data persistence
- Modular design with clear separation of client and server
- Exponential backoff for connection resilience
- Extensive automated testing with Jest and mocks

## Design Patterns Used
- **Modular architecture** separating concerns (API, WebSocket, AI, UI)
- **Observer pattern** via WebSockets for real-time updates
- **State Graph pattern** for AI workflow orchestration with LangGraph
- **Adapter pattern** for integrating with external APIs (OpenAI, ResponsesAPI)
- **Context Provider pattern** in React for WebSocket state management
- **Service abstraction** for device and AI interactions
- **Middleware pattern** in backend request handling and API authentication
- **Factory pattern** for creating audio transcription requests

## Component Relationships
- Frontend communicates with backend via REST and WebSockets
- Backend orchestrates AI calls and device commands
- Client devices capture audio and maintain WebSocket connections
- Backend server processes audio via OpenAI, runs analysis, and stores results
- LangChain/LangGraph manage AI workflow logic with a multi-node pipeline
- SQLite database stores device info, transcriptions, and alerts

## Data Flow
1. Client devices capture audio and send via WebSockets
2. Backend transcribes audio using OpenAI API
3. LangGraph workflow processes transcription through multiple nodes
4. Alert detection uses ResponsesAPI with keyword fallback
5. Results stored in database and broadcast to web clients
6. Web frontend displays devices, transcriptions, and alerts
7. Commands can be sent back to devices (e.g., TTS responses)

## Critical Implementation Paths
- Real-time WebSocket communication loop with heartbeat monitoring
- Audio capture, buffering, and transmission
- AI request/response handling with OpenAI
- LangGraph workflow for transcription analysis
- Alert detection and notification
- Database operations with retry logic
- Device command dispatch and status monitoring

## Security Considerations
- WebSocket validation and sanitization
- Message size limits to prevent abuse
- Environment variable protection for API keys
- Input validation with type checking
- Database parameter binding to prevent injection
- Basic auth framework for web clients (needs enhancement)
- File path validation and directory creation security

## Performance Considerations
- SQLite optimizations (WAL journal, pragmas, indexes)
- Audio buffering with configurable chunk sizes
- Efficient WebSocket message handling
- Retry mechanisms with exponential backoff
- Reuse of workflow instances
- Database connection pooling
- Non-blocking async operations
