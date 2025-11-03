import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { chatRouter } from './routes/chat.js';
import operationsRouter from './routes/operations.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..', '..');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3101;

// Middleware
// CORS configuration to allow Chrome extension and DA origins
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    // Allow chrome-extension:// origins
    if (origin.startsWith('chrome-extension://')) {
      return callback(null, true);
    }
    
    // Allow localhost origins
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    
    // Allow configured DA origins
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'https://da.live'];
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Reject other origins
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`\n📥 [${timestamp}] ${req.method} ${req.path}`);
  if (req.method === 'POST' && req.path.includes('/chat')) {
    console.log('Request context:', JSON.stringify(req.body?.context, null, 2));
  }
  next();
});

// Serve test page and static files
app.use('/chrome-extension', express.static(join(projectRoot, 'chrome-extension')));
app.get('/test-prosemirror.html', (req, res) => {
  res.sendFile(join(projectRoot, 'test-prosemirror.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// API routes
app.use('/api/chat', chatRouter);
app.use('/api/operations', operationsRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('\n❌ Unhandled error:');
  console.error('Message:', err.message);
  console.error('Stack:', err.stack);
  console.error('Path:', req.path);
  console.error('Method:', req.method);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
});

// Start server with error handling and socket reuse
const httpServer = createServer(app);

// Enable SO_REUSEADDR to allow immediate port reuse after restart
httpServer.on('listening', () => {
  const addr = httpServer.address();
  const bind = typeof addr === 'string' ? `pipe ${addr}` : `port ${addr.port}`;
  console.log(`🚀 DA Agent Backend running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Claude Model: ${process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022'}`);
});

// Set SO_REUSEADDR before binding
const server = httpServer.listen({
  port: PORT,
  host: '0.0.0.0',
  exclusive: false, // Allow port sharing during restart
});

// Track connections for clean shutdown
const connections = new Set();

server.on('connection', (connection) => {
  connections.add(connection);
  connection.on('close', () => {
    connections.delete(connection);
  });
});

// Set timeouts to prevent hanging connections
server.keepAliveTimeout = 65000; // 65 seconds
server.headersTimeout = 66000; // 66 seconds

// Handle port already in use error
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is already in use!`);
    console.error('Run this to kill the process and restart:');
    console.error(`   lsof -ti:${PORT} | xargs kill -9 && npm run dev\n`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});

// Graceful shutdown
let isShuttingDown = false;

function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  console.log(`\n👋 ${signal} received, closing server...`);
  
  // Destroy all connections immediately
  for (const connection of connections) {
    connection.destroy();
  }
  connections.clear();
  
  // Force close after 500ms to ensure quick restarts
  const forceClose = setTimeout(() => {
    console.log('Force closing...');
    process.exit(0);
  }, 500);
  
  server.close(() => {
    clearTimeout(forceClose);
    console.log('✅ Server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

