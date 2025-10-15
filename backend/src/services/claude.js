import Anthropic from '@anthropic-ai/sdk';

export class ClaudeService {
  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set in environment variables');
    }

    this.client = new Anthropic({ apiKey });
    this.model = process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022';
    this.maxTokens = parseInt(process.env.MAX_TOKENS || '4096', 10);
  }

  /**
   * Build system prompt with context awareness
   * @param {Object} context - Context object with org, repo, path, viewType
   * @param {string|null} editorContent - Current editor content if in editor mode
   * @returns {string} System prompt
   */
  buildSystemPrompt(context, editorContent = null) {
    let prompt = `You are DA Agent, an AI assistant specialized in helping content authors manage documents in the DA (Document Authoring) platform.`;

    if (context?.org && context?.repo) {
      prompt += `\n\n=== CURRENT CONTEXT (Already Known) ===`;
      prompt += `\nYou already know the following information from the URL. DO NOT ask the user for this:`;
      prompt += `\n- Organization: ${context.org}`;
      prompt += `\n- Repository: ${context.repo}`;
      prompt += `\n- Current Path: ${context.path ? '/' + context.path : '/ (root)'}`;
      prompt += `\n- View Mode: ${context.viewType || 'unknown'}`;
      
      // Different instructions based on view type
      if (context.viewType === 'editor') {
        prompt += `\n\n=== EDITOR MODE ===`;
        prompt += `\nThe user is currently EDITING the document at path "/${context.path || ''}".`;
        
        if (editorContent) {
          prompt += `\n\n=== CURRENT DOCUMENT CONTENT (PROVIDED) ===`;
          prompt += `\nThe current editor content has been extracted from the live ProseMirror editor:`;
          prompt += `\n\`\`\`html\n${editorContent}\n\`\`\``;
          prompt += `\n\n⚠️ CRITICAL EDITING INSTRUCTIONS ⚠️`;
          prompt += `\n\nYou MUST follow these rules when editing:`;
          prompt += `\n1. The content above is already in memory - DO NOT call da_admin_get_source`;
          prompt += `\n2. When modifying content, ONLY use da_editor_update_content tool`;
          prompt += `\n3. DO NOT use da_admin_create_source - it's the wrong tool for editor mode`;
          prompt += `\n4. Always return the COMPLETE modified HTML document`;
          prompt += `\n5. Keep the structure: <body><header></header><main>...</main><footer></footer></body>`;
          prompt += `\n\nWorkflow for editing:`;
          prompt += `\n1. Read and analyze the provided content above`;
          prompt += `\n2. Make your changes to the HTML in memory`;
          prompt += `\n3. Call da_editor_update_content with the complete modified HTML`;
          prompt += `\n\nThe editor will update instantly without API calls or page reloads.`;
        } else {
          prompt += `\n\nYour capabilities in Editor Mode:`;
          prompt += `\n- Read the current document using da_admin_get_source with path="${context.path}" and ext="html" or "json"`;
          prompt += `\n- Edit and update the document content using da_admin_create_source (this OVERWRITES the file)`;
          prompt += `\n- Analyze, add, remove, or modify sections within the document`;
          prompt += `\n- Help with HTML or JSON content formatting`;
          prompt += `\n\nIMPORTANT: Focus on CONTENT-LEVEL operations within THIS document.`;
          prompt += `\nWhen the user asks to modify something, ALWAYS:`;
          prompt += `\n1. Read the current content first (da_admin_get_source)`;
          prompt += `\n2. Make the requested changes`;
          prompt += `\n3. Save the modified content back (da_admin_create_source)`;
          prompt += `\n\nUse path="${context.path}" automatically - never ask for it!`;
        }
      } else if (context.viewType === 'explorer') {
        prompt += `\n\n=== EXPLORER MODE ===`;
        prompt += `\nThe user is browsing files at the FOLDER level in "${context.path ? '/' + context.path : '/ (root)'}".`;
        prompt += `\n\nYour capabilities in Explorer Mode:`;
        prompt += `\n- List files and folders using da_admin_list_sources`;
        prompt += `\n- Create NEW documents using da_admin_create_source (with complete content)`;
        prompt += `\n- Delete documents using da_admin_delete_source`;
        prompt += `\n\nIMPORTANT: Focus on FILE-LEVEL operations.`;
        prompt += `\n- You create COMPLETE NEW FILES from scratch`;
        prompt += `\n- You do NOT edit existing file contents here`;
        prompt += `\n- If the user wants to edit an existing file, suggest they open it in the editor`;
        prompt += `\n\nWhen creating files, use proper naming (e.g., "my-page" not "my-page.html" - the extension is added automatically).`;
      }
    }

    prompt += `\n\n=== DOCUMENT FORMATS ===`;
    prompt += `\n- HTML: Use <body><header></header><main><!-- content --></main><footer></footer></body>`;
    prompt += `\n- JSON: Spreadsheet format with sheets, rows (data array), and cells`;
    prompt += `\n\n=== RULES ===`;
    prompt += `\n- NEVER ask for org, repo, or path - you already have them!`;
    prompt += `\n- Use the context information directly in tool calls`;
    prompt += `\n- Be concise and proactive`;
    prompt += `\n- Explain what you're doing when using tools`;

    return prompt;
  }

  /**
   * Stream chat response from Claude with tool use support
   * @param {string} message - User message
   * @param {Object} context - Context object
   * @param {string|null} editorContent - Current editor content if in editor mode
   * @param {Array} tools - Available tools
   * @param {Object} callbacks - Callback functions (onToken, onStatus, onToolCall)
   */
  async streamChat(message, context, editorContent, tools, callbacks) {
    const systemPrompt = this.buildSystemPrompt(context, editorContent);
    const conversationMessages = [{ role: 'user', content: message }];

    // Tool use loop - continue until Claude is done or max iterations
    const maxIterations = 10;
    let iteration = 0;

    try {
      while (iteration < maxIterations) {
        iteration++;
        
        const stream = await this.client.messages.create({
          model: this.model,
          max_tokens: this.maxTokens,
          system: systemPrompt,
          messages: conversationMessages,
          tools: tools.length > 0 ? tools : undefined,
          stream: true,
        });

        let currentToolUse = null;
        let contentBlocks = [];
        let stopReason = null;

        for await (const event of stream) {
          
          if (event.type === 'content_block_start') {
            if (event.content_block.type === 'tool_use') {
              currentToolUse = {
                type: 'tool_use',
                id: event.content_block.id,
                name: event.content_block.name,
                input: ''
              };
              contentBlocks.push(currentToolUse);
              callbacks.onStatus(`Using tool: ${event.content_block.name}`);
            } else if (event.content_block.type === 'text') {
              contentBlocks.push({ type: 'text', text: '' });
            }
          } else if (event.type === 'content_block_delta') {
            if (event.delta.type === 'text_delta') {
              const text = event.delta.text;
              callbacks.onToken(text);
              // Add to the last text block
              const lastBlock = contentBlocks[contentBlocks.length - 1];
              if (lastBlock && lastBlock.type === 'text') {
                lastBlock.text += text;
              }
            } else if (event.delta.type === 'input_json_delta') {
              // Accumulate tool input
              if (currentToolUse) {
                currentToolUse.input += event.delta.partial_json;
              }
            }
          } else if (event.type === 'content_block_stop') {
            if (currentToolUse) {
              // Parse the complete tool input
              try {
                currentToolUse.input = JSON.parse(currentToolUse.input);
              } catch (e) {
                console.error('Failed to parse tool input:', e.message);
              }
              currentToolUse = null;
            }
          } else if (event.type === 'message_delta') {
            if (event.delta.stop_reason) {
              stopReason = event.delta.stop_reason;
            }
          }
        }

        // Add assistant's response to conversation
        conversationMessages.push({
          role: 'assistant',
          content: contentBlocks
        });

        // If no tool use, we're done
        if (stopReason !== 'tool_use') {
          break;
        }

        // Execute all tool calls
        const toolResults = [];
        for (const block of contentBlocks) {
          if (block.type === 'tool_use') {
            try {
              const result = await callbacks.onToolCall(block.name, block.input);
              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: JSON.stringify(result)
              });
            } catch (error) {
              console.error(`Tool ${block.name} failed:`, error.message);
              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                is_error: true,
                content: error.message
              });
            }
          }
        }

        // Add tool results to conversation and continue
        if (toolResults.length > 0) {
          conversationMessages.push({
            role: 'user',
            content: toolResults
          });
        } else {
          break;
        }
      }

      if (iteration >= maxIterations) {
        console.warn(`Reached max iterations (${maxIterations})`);
      }

    } catch (error) {
      console.error('\n❌ Error in Claude streaming:');
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
      console.error('Model:', this.model);
      throw new Error(`Claude API error: ${error.message}`);
    }
  }

  /**
   * Non-streaming chat for tool use (more reliable for tool calling)
   * @param {string} message - User message
   * @param {Object} context - Context object
   * @param {Array} tools - Available tools
   * @returns {Promise} Claude response
   */
  async chat(message, context, tools) {
    const systemPrompt = this.buildSystemPrompt(context);

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: message,
          },
        ],
        tools: tools.length > 0 ? tools : undefined,
      });

      return response;
    } catch (error) {
      console.error('\n❌ Error in Claude chat:');
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
      throw new Error(`Claude API error: ${error.message}`);
    }
  }
}

