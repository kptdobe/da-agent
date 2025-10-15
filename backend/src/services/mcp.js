/**
 * MCP Service for integrating with mcp-da-live-admin server
 */
export class MCPService {
  constructor() {
    this.client = null;
    this.transport = null;
    this.context = null;
    this.contentModified = false;
    this.availableTools = [];
    
    // Get DA Admin auth token from environment
    this.authToken = process.env.DA_ADMIN_TOKEN;
    if (!this.authToken) {
      console.warn('Warning: DA_ADMIN_TOKEN not set. DA Admin API calls may fail.');
    }

    // Initialize with DA-specific tools
    // In a full implementation, this would connect to the actual MCP server
    // For now, we'll use a direct implementation of the DA operations
    this.initializeTools();
  }

  /**
   * Initialize available tools
   */
  initializeTools() {
    this.availableTools = [
      {
        name: 'da_admin_list_sources',
        description: 'List sources (documents) in a folder from a DA organization',
        input_schema: {
          type: 'object',
          properties: {
            org: { type: 'string', description: 'The organization' },
            repo: { type: 'string', description: 'Name of the repository' },
            path: { type: 'string', description: 'Path to the folder' },
          },
          required: ['org', 'repo', 'path'],
        },
      },
      {
        name: 'da_admin_get_source',
        description: 'Get source content from a DA organization (HTML or JSON file)',
        input_schema: {
          type: 'object',
          properties: {
            org: { type: 'string', description: 'The organization' },
            repo: { type: 'string', description: 'Name of the repository' },
            path: { type: 'string', description: 'Path to the source content' },
            ext: { 
              type: 'string', 
              description: 'The source content file extension: html or json',
              enum: ['html', 'json'],
            },
          },
          required: ['org', 'repo', 'path', 'ext'],
        },
      },
      {
        name: 'da_admin_create_source',
        description: 'Create source content in a DA organization (HTML or JSON file)',
        input_schema: {
          type: 'object',
          properties: {
            org: { type: 'string', description: 'The organization' },
            repo: { type: 'string', description: 'Name of the repository' },
            path: { type: 'string', description: 'Path to the source content' },
            ext: { 
              type: 'string', 
              description: 'The source content file extension: html or json',
              enum: ['html', 'json'],
            },
            content: {
              type: 'string',
              description: 'If html: HTML string using template <body><header></header><main><!-- content --></main><footer></footer></body>. If json: JSON string representing a spreadsheet.',
            },
          },
          required: ['org', 'repo', 'path', 'ext', 'content'],
        },
      },
      {
        name: 'da_admin_delete_source',
        description: 'Delete source content from a DA organization',
        input_schema: {
          type: 'object',
          properties: {
            org: { type: 'string', description: 'The organization' },
            repo: { type: 'string', description: 'Name of the repository' },
            path: { type: 'string', description: 'Path to the source content' },
            ext: { 
              type: 'string', 
              description: 'The source content file extension: html or json',
              enum: ['html', 'json'],
            },
          },
          required: ['org', 'repo', 'path', 'ext'],
        },
      },
    ];
  }

  /**
   * Initialize MCP service with context
   * @param {Object} context - Context object with org, repo, path
   */
  async initialize(context) {
    this.context = context;
    this.contentModified = false;

    // TODO: Connect to actual MCP server if running separately
    // For now, we use direct API calls to DA
  }

  /**
   * Get available tools in Claude-compatible format
   * @returns {Array} Available tools
   */
  getTools() {
    return this.availableTools;
  }

  /**
   * Execute a tool call
   * @param {string} toolName - Name of the tool to execute
   * @param {Object} input - Tool input parameters
   * @returns {Promise} Tool execution result
   */
  async executeTool(toolName, input) {
    console.log(`Executing tool: ${toolName}`, input);

    try {
      switch (toolName) {
        case 'da_admin_list_sources':
          return await this.listSources(input);
        
        case 'da_admin_get_source':
          return await this.getSource(input);
        
        case 'da_admin_create_source':
          this.contentModified = true;
          return await this.createSource(input);
        
        case 'da_admin_delete_source':
          this.contentModified = true;
          return await this.deleteSource(input);
        
        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
    } catch (error) {
      console.error(`Tool ${toolName} execution failed:`, error.message);
      throw error;
    }
  }

  /**
   * Check if content was modified during this session
   * @returns {boolean} True if content was modified
   */
  hasModifiedContent() {
    return this.contentModified;
  }

  /**
   * Tool implementations
   */

  async listSources(input) {
    const { org, repo, path } = input;
    const url = `https://admin.da.live/list/${org}/${repo}/${path}`;
    
    try {
      const headers = {};
      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }
      
      const response = await fetch(url, { headers });
      if (!response.ok) {
        console.error(`DA Admin API Error: LIST ${response.status} ${response.statusText}`);
        throw new Error(`Failed to list sources: ${response.statusText} (${response.status})`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Failed to list sources:`, error.message);
      throw error;
    }
  }

  async getSource(input) {
    const { org, repo, ext } = input;
    let { path } = input;
    
    // Normalize path - remove leading slash if present
    if (path && path.startsWith('/')) {
      path = path.substring(1);
    }
    
    const url = `https://admin.da.live/source/${org}/${repo}${path ? '/' + path : ''}.${ext}`;
    
    try {
      const headers = {};
      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }
      
      const response = await fetch(url, { headers });
      if (!response.ok) {
        console.error(`DA Admin API Error: GET ${response.status} ${response.statusText}`);
        throw new Error(`Failed to get source: ${response.statusText} (${response.status})`);
      }
      
      if (ext === 'json') {
        return await response.json();
      } else {
        return await response.text();
      }
    } catch (error) {
      console.error(`Failed to get source:`, error.message);
      throw error;
    }
  }

  async createSource(input) {
    const { org, repo, ext, content } = input;
    let { path } = input;
    
    // Normalize path - remove leading slash if present
    if (path && path.startsWith('/')) {
      path = path.substring(1);
    }
    
    const url = `https://admin.da.live/source/${org}/${repo}${path ? '/' + path : ''}.${ext}`;
    
    try {
      // DA Admin API requires multipart/form-data with a 'data' field
      const formData = new FormData();
      const blob = new Blob([content], { 
        type: ext === 'json' ? 'application/json' : 'text/html' 
      });
      formData.append('data', blob, `${path || 'file'}.${ext}`);
      
      const headers = {};
      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });
      
      const responseBody = await response.text();
      
      if (!response.ok) {
        console.error(`DA Admin API Error: ${response.status} ${response.statusText}`);
        console.error('Response:', responseBody);
        throw new Error(`Failed to create source: ${response.statusText} (${response.status})`);
      }
      
      return { success: true, message: 'Source created successfully', url };
    } catch (error) {
      console.error(`Failed to create source:`, error.message);
      throw error;
    }
  }

  async deleteSource(input) {
    const { org, repo, ext } = input;
    let { path } = input;
    
    // Normalize path - remove leading slash if present
    if (path && path.startsWith('/')) {
      path = path.substring(1);
    }
    
    const url = `https://admin.da.live/source/${org}/${repo}${path ? '/' + path : ''}.${ext}`;
    
    try {
      const headers = {};
      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers,
      });
      
      if (!response.ok) {
        console.error(`DA Admin API Error: DELETE ${response.status} ${response.statusText}`);
        throw new Error(`Failed to delete source: ${response.statusText} (${response.status})`);
      }
      
      return { success: true, message: 'Source deleted successfully' };
    } catch (error) {
      console.error(`Failed to delete source:`, error.message);
      throw error;
    }
  }

  /**
   * Cleanup
   */
  async dispose() {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }
  }
}

