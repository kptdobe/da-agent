# DA Agent

An AI-powered chat assistant for Document Authoring (DA) that helps content authors create, edit, and manage documents directly from their browser.

## Overview

DA Agent consists of two main components:

1. **Chrome Extension**: A side panel interface that provides context-aware AI assistance while browsing DA
2. **Backend Server**: An intelligent backend powered by Claude (Anthropic) with specialized DA operations

## Features

- 🤖 **AI-Powered Assistance**: Natural language interface for all DA operations
- 🎯 **Context-Aware**: Automatically detects your current location (explorer or editor)
- 📝 **Content Management**: Create, read, update, and delete documents
- 🔄 **Real-time Updates**: Streaming responses with automatic page refresh
- 🎨 **Modern UI**: Beautiful, responsive chat interface
- 🔒 **Secure**: Restricted to DA domains only

## Architecture

### Chrome Extension (Frontend)
- Manifest V3 Chrome extension
- Side panel UI with real-time chat
- Context extraction from DA pages
- Background service worker for state management
- Content scripts for page interaction

### Backend Server
- Node.js/TypeScript with Express
- Anthropic Claude API integration
- MCP (Model Context Protocol) for DA operations
- Server-Sent Events (SSE) for streaming
- Direct integration with DA admin API

## Setup

### Prerequisites

- Node.js >= 18.0.0
- Chrome/Chromium browser
- Anthropic API key ([Get one here](https://console.anthropic.com/))

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file from the example:
   ```bash
   cp env.example .env
   ```

4. Edit `.env` and add your Anthropic API key:
   ```
   ANTHROPIC_API_KEY=your_actual_api_key_here
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

   The server will start on `http://localhost:3101`

### Chrome Extension Setup

1. Open Chrome and navigate to `chrome://extensions/`

2. Enable "Developer mode" (toggle in the top right)

3. Click "Load unpacked"

4. Select the `chrome-extension` directory from this project

5. The DA Agent extension should now appear in your extensions list

6. Visit `http://localhost:3000` or `https://da.live`

7. Click the DA Agent extension icon to open the side panel

## Usage

### Basic Operations

Once the extension is loaded and the backend is running:

1. **Navigate to DA**: Open `https://da.live` or your local DA instance
2. **Open the Side Panel**: Click the DA Agent extension icon
3. **Start Chatting**: Ask the agent to perform tasks

### Example Prompts

**In Explorer View** (`https://da.live/#/org/repo/path`):
- "Create a new page called 'about-us'"
- "List all documents in this folder"
- "Delete the file 'old-page.html'"
- "Create 5 blog posts about AI"

**In Editor View** (`https://da.live/edit#/org/repo/path/file`):
- "Add a hero section with a title and description"
- "Change the heading to 'Welcome to Our Site'"
- "Add a contact form at the bottom"
- "Convert this to a two-column layout"

### Document Formats

**HTML Documents**:
```html
<body>
  <header></header>
  <main>
    <!-- Your content here -->
  </main>
  <footer></footer>
</body>
```

**JSON Documents** (Spreadsheets):
```json
{
  "sheet1": {
    "total": 2,
    "data": [
      {
        "column1": "value1",
        "column2": "value2"
      }
    ]
  },
  ":names": ["sheet1"],
  ":type": "multi-sheet"
}
```

## Development

### Backend Development

```bash
cd backend

# Run in development mode with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint

# Format code
npm run format
```

### Extension Development

After making changes to the extension:

1. Go to `chrome://extensions/`
2. Click the refresh icon on the DA Agent extension
3. Reload the DA page to see changes

### Project Structure

```
da-agent/
├── chrome-extension/
│   ├── manifest.json          # Extension configuration
│   ├── background.js          # Service worker
│   ├── content.js            # Content script
│   ├── sidepanel.html        # Side panel UI
│   ├── sidepanel.css         # Styles
│   ├── sidepanel.js          # Side panel logic
│   └── icons/                # Extension icons
│
├── backend/
│   ├── src/
│   │   ├── index.ts          # Server entry point
│   │   ├── routes/
│   │   │   └── chat.ts       # Chat endpoint
│   │   └── services/
│   │       ├── claude.ts     # Claude API service
│   │       └── mcp.ts        # MCP/DA operations
│   ├── package.json
│   ├── tsconfig.json
│   └── env.example
│
└── concept.md                # Project concept document
```

## Configuration

### Backend Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key | Required |
| `DA_ADMIN_TOKEN` | Authentication token for DA Admin API | Required |
| `PORT` | Server port | 3101 |
| `NODE_ENV` | Environment | development |
| `ALLOWED_ORIGINS` | CORS origins (comma-separated) | http://localhost:3000,https://da.live |
| `CLAUDE_MODEL` | Claude model to use | claude-3-5-sonnet-20241022 |
| `MAX_TOKENS` | Max tokens per response | 4096 |

### Extension Configuration

The extension is configured via `manifest.json`. Key settings:

- **Permissions**: `sidePanel`, `activeTab`, `storage`
- **Host Permissions**: `http://localhost:3000/*`, `https://da.live/*`
- **Backend URL**: Defined in `sidepanel.js` as `BACKEND_URL`

## API Endpoints

### Backend API

#### `POST /api/chat`
Stream chat responses with Claude.

**Request Body**:
```json
{
  "message": "Create a new page",
  "context": {
    "org": "myorg",
    "repo": "myrepo",
    "path": "blog",
    "viewType": "explorer"
  }
}
```

**Response**: Server-Sent Events (SSE) stream
```
data: {"type":"token","content":"I'll"}
data: {"type":"token","content":" create"}
data: {"type":"status","message":"Using tool: da_admin_create_source"}
data: {"type":"complete","shouldRefresh":true}
```

#### `GET /health`
Health check endpoint.

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "environment": "development"
}
```

## Available Tools

The agent has access to these DA operations:

- **`da_admin_list_sources`**: List documents in a folder
- **`da_admin_get_source`**: Retrieve document content (HTML or JSON)
- **`da_admin_create_source`**: Create new documents
- **`da_admin_delete_source`**: Delete documents

## Troubleshooting

### Extension Issues

**Side panel not appearing**:
- Ensure you're on `http://localhost:3000/*` or `https://da.live/*`
- Check that the extension is enabled in `chrome://extensions/`
- Try reloading the extension

**Context not detected**:
- Check browser console for errors
- Ensure URL matches the expected patterns
- Try refreshing the page

### Backend Issues

**Server won't start**:
- Verify Node.js version (>= 18.0.0)
- Check that port 3101 is available
- Ensure all dependencies are installed

**API errors**:
- Verify `ANTHROPIC_API_KEY` is set correctly
- Check API key has sufficient credits
- Review server logs for details

**CORS errors**:
- Verify `ALLOWED_ORIGINS` includes your DA domain
- Check that the backend is running
- Ensure the extension is using the correct `BACKEND_URL`

## Security Considerations

- API keys are stored server-side only (never in the extension)
- Extension only works on whitelisted DA domains
- All DA operations go through authenticated admin API
- CORS is configured to restrict access to DA domains

## Limitations

Current limitations of the initial implementation:

- Simple tool execution (no complex multi-step reasoning loops yet)
- Basic streaming (could be enhanced with proper tool result handling)
- No conversation history persistence
- No user authentication (relies on DA session)
- Manual page refresh after operations

## Future Enhancements

Planned improvements:

- [ ] Conversation history and persistence
- [ ] More sophisticated multi-turn tool use
- [ ] Inline content editing without refresh
- [ ] Batch operations and templates
- [ ] User preferences and customization
- [ ] Integration with DA's authentication system
- [ ] Support for more content types
- [ ] Voice input support
- [ ] Collaborative features

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- Check the troubleshooting section
- Review the concept document
- Open an issue on GitHub

## Acknowledgments

- Built with [Claude](https://www.anthropic.com/claude) by Anthropic
- Uses [Model Context Protocol (MCP)](https://github.com/modelcontextprotocol)
- Integrates with [DA (Document Authoring)](https://da.live)

