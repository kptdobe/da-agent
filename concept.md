# DA Agent

## Concept

The DA Agent is a chat bot given to content authors, editing content on DA (create / update / delete pages, edit content of the page...). The content author can open the chat bot in the contex of DA (site browser or file editor) and prompt some actions. The bot is smart enough to understand the context:
- in the site explorer (urls like https://da.live/#/owner/repo/directory_path), the DA Agent can help create / update / delete / move / rename documents
- in the editor (urls like https://da.live/edit#/owner/repo/file_path), the DA Agent can help editing any part of the content

DA Agent project is composed of 2 parts: 

### Part 1: Chrome Extension (Frontend)

The Chrome extension serves as the user interface for the DA Agent, providing a seamless chat experience directly within the DA website.

**Key Features:**
- **Side Panel Integration**: Utilizes `chrome.sidePanel` API to display a persistent chat interface alongside the DA website
- **Context Awareness**: Automatically detects the user's current location within DA:
  - Site Explorer context: Recognizes URLs like `https://da.live/#/owner/repo/directory_path`
  - Editor context: Recognizes URLs like `https://da.live/edit#/owner/repo/file_path`
- **Context Injection**: Extracts and sends relevant context to the backend, including:
  - Current organization, repository, and file path
  - Active document metadata
  - User's current view (explorer vs. editor)
- **Real-time Chat Interface**: Modern, responsive chat UI with:
  - Message history
  - Streaming responses from the AI
  - Visual indicators for ongoing operations
  - Error handling and user feedback
- **Content Refresh**: Automatically reloads the relevant page or content area after the agent completes an action
- **Security**: Restricted to work only on `http://localhost:3000/` (development) and `https://da.live` (production)

**Technical Architecture:**
- Manifest V3 Chrome extension
- Background service worker for managing communication with backend
- Content scripts for context extraction and page manipulation
- Side panel with modern web components (React/Vue/Vanilla JS)
- WebSocket or Server-Sent Events for real-time streaming responses

### Part 2: Backend Server (AI Agent)

The backend server acts as the intelligent brain of the DA Agent, orchestrating LLM capabilities with specialized content management tools.

**Key Features:**
- **LLM Integration**: Leverages Claude (Anthropic) for natural language understanding and task execution:
  - Context-aware prompt engineering
  - Multi-turn conversation handling
  - Intent recognition and task planning
- **MCP Server Integration**: Integrates the [mcp-da-live-admin](https://github.com/kptdobe/mcp-da-live-admin/) MCP server for specialized DA operations:
  - `da_admin_list_sources`: List documents in a folder
  - `da_admin_get_source`: Retrieve content (HTML or JSON)
  - `da_admin_create_source`: Create new documents
  - `da_admin_delete_source`: Delete existing documents
  - Content editing capabilities for both HTML and JSON (spreadsheet) formats
- **Context Processing**: Receives context from the Chrome extension and enriches prompts with:
  - Current working directory and file structure
  - Existing document content
  - User's intent and requested actions
- **Task Orchestration**: Breaks down complex requests into atomic operations:
  - Multi-step workflows (e.g., "create 5 pages from this template")
  - Validation and error recovery
  - Rollback capabilities for failed operations
- **API Endpoints**:
  - `/chat`: Main conversational endpoint (streaming)
  - `/context`: Endpoint to update or query current context
  - `/health`: Health check and status monitoring
- **Security & Authentication**:
  - API key management for Claude/Anthropic
  - Request validation and rate limiting
  - CORS configuration for DA domain origins

**Technical Architecture:**
- Node.js/TypeScript backend (or Python with FastAPI)
- Integration with Anthropic Claude API
- MCP (Model Context Protocol) client integration
- RESTful API with streaming support (SSE or WebSocket)
- Environment-based configuration for API keys and endpoints
- Structured logging and error handling

**Integration Flow:**
1. User sends a message in the Chrome extension side panel
2. Extension extracts current context (org, repo, path, view type)
3. Request sent to backend with message + context
4. Backend constructs enriched prompt for Claude with MCP tools
5. Claude analyzes intent and determines required actions
6. Backend executes MCP tool calls (list, get, create, delete, edit)
7. Results streamed back to Chrome extension in real-time
8. Extension displays updates and triggers page refresh on completion

## Technical

- leverage `chrome.sidePanel` to display the chat in the browser
- the side panel should be visible only on http://localhost:3000/ and https://da.live sites