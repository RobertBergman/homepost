# System Patterns

_System architecture, key technical decisions, design patterns, component relationships, and critical implementation paths._

## Architecture Overview
HomePost is a client-server system with:
- A **Node.js backend** providing REST APIs and WebSocket communication
- A **React frontend** served via a GUI submodule
- Integration with **OpenAI APIs** for AI assistant features
- Use of **LangChain** and **LangGraph** for AI workflow orchestration
- Audio processing components for TTS and voice interaction
- Cross-platform support scripts, including Windows-specific patches

## Key Technical Decisions
- Use of Node.js for backend scalability and ecosystem support
- React for a responsive, component-based frontend
- WebSockets for real-time device communication
- OpenAI API integration for AI capabilities
- LangChain and LangGraph to manage complex AI workflows
- Modular design with clear separation of client and server
- Extensive automated testing with Jest and mocks

## Design Patterns Used
- **Modular architecture** separating concerns (API, WebSocket, AI, UI)
- **Observer pattern** via WebSockets for real-time updates
- **Adapter pattern** for integrating with external APIs (OpenAI)
- **Service abstraction** for device and AI interactions
- **Middleware pattern** in backend request handling

## Component Relationships
- Frontend communicates with backend via REST and WebSockets
- Backend orchestrates AI calls and device commands
- Audio components interface with both frontend and backend
- LangChain/LangGraph manage AI workflow logic
- Device management modules interact with hardware or emulators

## Data Flow
1. User interacts via UI or voice
2. Frontend sends commands via REST/WebSocket
3. Backend processes commands, invokes AI or device services
4. AI responses or device statuses sent back via WebSocket
5. Frontend updates UI and/or plays audio feedback

## Critical Implementation Paths
- Real-time WebSocket communication loop
- AI request/response handling with OpenAI
- Audio processing pipeline (input, TTS output)
- Device command dispatch and status monitoring

## Security Considerations
- Secure API endpoints and WebSocket connections
- Proper handling of API keys and secrets
- Input validation and sanitization
- User authentication and authorization (future scope)

## Performance Considerations
- Minimize AI response latency
- Efficient WebSocket message handling
- Scalable backend architecture
- Optimized frontend rendering

## Initial Notes
This architecture is inferred from current project structure and should be refined with explicit design documentation.
