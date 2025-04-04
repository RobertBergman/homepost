# Technical Context

_Technologies used, development setup, technical constraints, dependencies, and tool usage patterns._

## Languages and Frameworks
- **Backend:** Node.js (JavaScript)
- **Frontend:** React (JavaScript)
- **AI Integration:** OpenAI API, LangChain, LangGraph
- **Testing:** Jest

## Development Environment
- OS: Cross-platform (Windows, Linux)
- Node.js runtime
- Package management via npm
- IDEs: VSCode recommended
- Windows-specific scripts and patches included

## Dependencies
- **Backend:**
  - express (likely, for API server)
  - ws or socket.io (for WebSockets)
  - openai (OpenAI API client)
  - langchain, langgraph
  - dotenv (environment variables)
  - winston or similar (logging)
- **Frontend:**
  - react, react-dom
  - WebSocket client
  - UI libraries (TBD)
- **Dev Dependencies:**
  - jest
  - babel (transpilation)
  - testing libraries and mocks

## Build and Deployment
- Backend started via Node.js (`node server.js` or `node app.js`)
- Frontend built with React build tools
- Scripts for Windows compatibility
- Tests run with Jest
- Deployment target: local servers, cross-platform

## Technical Constraints
- Must support Windows environments
- Dependent on OpenAI API availability
- Real-time communication requirements
- Audio processing capabilities

## Tooling and Automation
- Jest for unit and integration testing
- Babel for transpilation
- npm scripts for build, test, deploy
- Windows install scripts (`install.ps1`, `install.sh`)
- Logging and debugging tools

## Testing Strategy
- Unit tests for backend and frontend logic
- Mocking of external APIs (OpenAI, devices)
- Integration tests for WebSocket and API flows
- Audio processing tests
- Cross-platform testing emphasis

## Initial Notes
This technical context is inferred from project files and should be refined with explicit dependency lists and setup instructions.
