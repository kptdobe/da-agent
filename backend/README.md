# DA Agent - Backend Server

This directory contains the backend server component of DA Agent.

## Tech Stack

- **Runtime**: Node.js 18+
- **Language**: JavaScript (ES Modules)
- **Framework**: Express
- **AI**: Anthropic Claude API
- **Protocol**: Model Context Protocol (MCP)

## Structure

```
src/
├── index.js             # Server entry point
├── routes/
│   └── chat.js          # Chat API endpoint
└── services/
    ├── claude.js        # Claude API integration
    └── mcp.js           # MCP/DA operations
```

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env` file:
   ```bash
   cp env.example .env
   ```

3. Add your Anthropic API key to `.env`:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```

4. Start development server:
   ```bash
   npm run dev
   ```

## Scripts

- `npm run dev` - Start development server (auto-kills old processes, auto-reloads on changes)
- `npm run dev:direct` - Start with node --watch directly (no auto-cleanup)
- `npm start` - Start production server
- `npm run kill-port` - Kill any process using port 3101
- `npm run lint` - Lint code
- `npm run format` - Format code with Prettier

## Environment Variables

Create a `.env` file with these variables:

```env
# Required
ANTHROPIC_API_KEY=your_api_key
DA_ADMIN_TOKEN=your_da_admin_token

# Optional (with defaults)
PORT=3101
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000,https://da.live
CLAUDE_MODEL=claude-3-5-sonnet-20241022
MAX_TOKENS=4096
```

## API Endpoints

### `POST /api/chat`

Stream chat responses with Claude.

**Request**:
```json
{
  "message": "Create a new page called about-us",
  "context": {
    "org": "myorg",
    "repo": "myrepo",
    "path": "blog",
    "viewType": "explorer"
  }
}
```

**Response**: Server-Sent Events (SSE)
```
data: {"type":"token","content":"I'll "}
data: {"type":"token","content":"create "}
data: {"type":"status","message":"Using tool: da_admin_create_source"}
data: {"type":"token","content":"that "}
data: {"type":"complete","shouldRefresh":true}
```

**Event Types**:
- `token` - Streaming text token
- `status` - Status update message
- `complete` - Operation complete (includes `shouldRefresh` flag)
- `error` - Error occurred

### `GET /health`

Health check endpoint.

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "environment": "development"
}
```

## Services

### ClaudeService (`services/claude.ts`)

Handles communication with Anthropic's Claude API.

**Features**:
- Context-aware system prompts
- Streaming responses
- Tool use support
- Error handling

**Methods**:
- `streamChat()` - Stream chat with Claude
- `chat()` - Non-streaming chat for tool use
- `buildSystemPrompt()` - Build context-aware prompt

### MCPService (`services/mcp.ts`)

Manages DA operations via MCP-compatible tools.

**Available Tools**:
- `da_admin_list_sources` - List documents in folder
- `da_admin_get_source` - Get document content
- `da_admin_create_source` - Create new document
- `da_admin_delete_source` - Delete document

**Features**:
- Direct DA admin API integration
- Tool execution and result formatting
- Content modification tracking
- Error handling

**Methods**:
- `initialize()` - Set context for session
- `getTools()` - Get Claude-compatible tool definitions
- `executeTool()` - Execute a tool call
- `hasModifiedContent()` - Check if content was modified

## DA Admin API

The backend communicates with DA's admin API:

**Base URL**: `https://admin.da.live`

**Endpoints**:
- `GET /list/{org}/{repo}/{path}` - List sources
- `GET /source/{org}/{repo}/{path}.{ext}` - Get source
- `PUT /source/{org}/{repo}/{path}.{ext}` - Create/update source
- `DELETE /source/{org}/{repo}/{path}.{ext}` - Delete source

## Development

### Adding New Tools

1. Define tool schema in `MCPService.initializeTools()`:
```javascript
{
  name: 'tool_name',
  description: 'What the tool does',
  input_schema: {
    type: 'object',
    properties: { /* ... */ },
    required: ['param1'],
  },
}
```

2. Add execution logic in `MCPService.executeTool()`:
```javascript
case 'tool_name':
  return await this.toolImplementation(input);
```

3. Implement the tool method:
```javascript
async toolImplementation(input) {
  // Implementation
}
```

### Debugging

Enable detailed logging:
```javascript
// In claude.js or mcp.js
console.log('Debug info:', data);
```

Check logs:
```bash
npm run dev
# Logs will appear in terminal
```

## Error Handling

All errors are caught and returned as:
```json
{
  "error": "Error type",
  "message": "Error description"
}
```

In development mode, full error details are included.

## Security

- API key stored in environment variables only
- CORS restricted to DA domains
- Request validation on all endpoints
- No sensitive data in logs (production)

## Performance

- Streaming responses for better UX
- Connection pooling for API calls
- Minimal middleware overhead
- Efficient tool execution

## Testing

```bash
# Test health endpoint
curl http://localhost:3101/health

# Test chat endpoint
curl -X POST http://localhost:3101/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"List documents","context":{"org":"test","repo":"test","path":""}}'
```

## Troubleshooting

**Server won't start**:
- Check Node.js version: `node --version` (must be >= 18)
- Verify port 3101 is available
- Ensure all dependencies installed: `npm install`

**Anthropic API errors**:
- Verify API key is correct
- Check API key has credits
- Review API rate limits

**CORS errors**:
- Add your domain to `ALLOWED_ORIGINS`
- Restart server after `.env` changes

**Tool execution fails**:
- Check network connectivity to admin.da.live
- Verify org/repo/path are correct
- Review error message for details

