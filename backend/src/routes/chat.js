import { Router } from 'express';
import { ClaudeService } from '../services/claude.js';
import { MCPService } from '../services/mcp.js';

const router = Router();
// Lazy initialization to ensure dotenv is loaded first
let claudeService = null;
let mcpService = null;

function getServices() {
  if (!claudeService) {
    claudeService = new ClaudeService();
  }
  if (!mcpService) {
    mcpService = new MCPService();
  }
  return { claudeService, mcpService };
}

router.post('/', async (req, res) => {
  try {
    const { message, context, editorContent } = req.body;

    if (!message) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }
    
    // Log incoming request details
    console.log(`\n📨 Chat request received`);
    console.log(`   Context: ${context?.org}/${context?.repo}/${context?.path || ''}`);
    console.log(`   View type: ${context?.viewType || 'unknown'}`);
    console.log(`   Editor content provided: ${editorContent ? 'YES (' + editorContent.length + ' chars)' : 'NO'}`);

    // Set up SSE (Server-Sent Events) for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Helper function to send SSE events
    const sendEvent = (type, data) => {
      res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
    };

    try {
      // Get service instances (lazy initialization)
      const { claudeService, mcpService } = getServices();

      // Initialize MCP service with context and editor content
      if (context?.org && context?.repo) {
        await mcpService.initialize(context, editorContent);
      }

      // Get tools from MCP service
      const tools = mcpService.getTools();
      
      // Log tool availability for debugging
      console.log(`📦 Available tools: ${tools.map(t => t.name).join(', ')}`);

      // Stream response from Claude
      await claudeService.streamChat(
        message,
        context,
        editorContent, // Pass editor content to Claude
        tools,
        {
          onToken: (token) => {
            sendEvent('token', { content: token });
          },
          onStatus: (status) => {
            sendEvent('status', { message: status });
          },
          onToolCall: async (toolName, toolInput) => {
            sendEvent('status', { message: `Using tool: ${toolName}` });
            return await mcpService.executeTool(toolName, toolInput);
          },
        }
      );
      
      // Check if any content modification was made
      const shouldRefresh = mcpService.hasModifiedContent();
      const editorUpdate = mcpService.getEditorUpdate();

      // Send completion event with optional editor update
      sendEvent('complete', { shouldRefresh, editorUpdate });

    } catch (error) {
      console.error('\n❌ Error processing chat:');
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
      if (context) {
        console.error('Context:', JSON.stringify(context, null, 2));
      }
      sendEvent('error', { message: error.message || 'An error occurred' });
    }

    res.end();

  } catch (error) {
    console.error('\n❌ Error in chat endpoint:');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    console.error('Request body:', JSON.stringify(req.body, null, 2));
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Failed to process chat request',
        message: error.message,
      });
    }
  }
});

export { router as chatRouter };

