// Configuration
const BACKEND_URL = 'http://localhost:3101';

// DOM elements
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendButton = document.getElementById('sendButton');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const contextBadge = document.getElementById('contextBadge');

// State
let currentContext = null;
let isProcessing = false;
let currentTabId = null;
let currentEditorTabId = null; // Store the tab ID of the editor page
let chatHistoryByTab = {}; // Store chat history per tab

// Helper function to extract context from URL (fallback when content script doesn't load)
function extractContextFromURL(url) {
  const context = {
    url,
    org: null,
    repo: null,
    path: null,
    viewType: null,
  };
  
  if (url.includes('/edit#/')) {
    context.viewType = 'editor';
    const match = url.match(/\/edit#\/([^/]+)\/([^/]+)(?:\/(.+))?/);
    if (match) {
      context.org = match[1];
      context.repo = match[2];
      context.path = match[3] || '';
    }
  } else if (url.includes('/#/')) {
    context.viewType = 'explorer';
    const match = url.match(/\/#\/([^/]+)\/([^/]+)(?:\/(.+))?/);
    if (match) {
      context.org = match[1];
      context.repo = match[2];
      context.path = match[3] || '';
    }
  }
  
  return context;
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  
  // Get current tab ID
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]) {
    currentTabId = tabs[0].id;
    loadChatHistoryForTab(currentTabId);
  }
  
  // Wait a bit for everything to be ready, then request context
  setTimeout(() => {
    requestContext();
  }, 500);
  
  // Listen for tab activation (when user switches tabs)
  chrome.tabs.onActivated.addListener(handleTabActivation);
  
  // Listen for tab updates (when URL changes in current tab)
  chrome.tabs.onUpdated.addListener(handleTabUpdate);
  
  // Clean up chat history when tabs are closed
  chrome.tabs.onRemoved.addListener((tabId) => {
    delete chatHistoryByTab[tabId];
  });
});

function setupEventListeners() {
  sendButton.addEventListener('click', handleSend);
  
  // Add refresh context button listener
  const refreshButton = document.getElementById('refreshContext');
  if (refreshButton) {
    refreshButton.addEventListener('click', () => {
      console.log('DA Agent Side Panel: Manual context refresh requested');
      contextBadge.textContent = 'Refreshing context...';
      contextBadge.style.background = 'rgba(52, 152, 219, 0.3)'; // Blue for loading
      requestContext();
    });
  }
  
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });
  
  chatInput.addEventListener('input', () => {
    autoResizeTextarea();
  });
  
  // Listen for context updates from content script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
      if (message.type === 'CONTEXT_UPDATE') {
        updateContext(message.context);
        sendResponse({ success: true });
      }
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
    return true; // Keep message channel open
  });
}

async function handleTabActivation(activeInfo) {
  // User switched to a different tab
  if (activeInfo.tabId !== currentTabId) {
    // Save current chat history before switching
    if (currentTabId) {
      saveChatHistoryForTab(currentTabId);
    }
    
    // Load chat history for the new tab
    currentTabId = activeInfo.tabId;
    loadChatHistoryForTab(currentTabId);
    
    // Request context for the new tab
    requestContext();
  }
}

async function handleTabUpdate(tabId, changeInfo, tab) {
  // URL changed in the current tab
  if (tabId === currentTabId && changeInfo.url) {
    // Request fresh context when URL changes
    requestContext();
  }
}

function saveChatHistoryForTab(tabId) {
  // Get all messages except the welcome message
  const messages = Array.from(chatMessages.children).filter(msg => 
    msg.id !== 'welcomeMessage'
  ).map(msg => {
    const contentEl = msg.querySelector('.message-content');
    return {
      role: msg.classList.contains('user') ? 'user' : 'assistant',
      content: contentEl ? contentEl.innerHTML : ''
    };
  });
  
  chatHistoryByTab[tabId] = messages;
}

function loadChatHistoryForTab(tabId) {
  // Clear current messages (except welcome)
  const messagesToRemove = Array.from(chatMessages.children).filter(msg => 
    msg.id !== 'welcomeMessage'
  );
  messagesToRemove.forEach(msg => msg.remove());
  
  // Load messages for this tab
  const history = chatHistoryByTab[tabId] || [];
  history.forEach(msg => {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${msg.role}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerHTML = msg.content;
    
    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);
  });
  
  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function autoResizeTextarea() {
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
}

async function requestContext() {
  try {
    // Request context from the background script
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'GET_CONTEXT' }, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });
    
    if (response && response.context) {
      updateContext(response.context);
    }
  } catch (error) {
    // Background might not have context yet
  }
  
  // Also request the content script to extract context from the current page
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
      // Store the tab ID for later use
      currentEditorTabId = tabs[0].id;
      
      // Check if it's a DA page
      const isDAPage = tabs[0].url.includes('da.live') || tabs[0].url.includes('localhost:3000');
      if (!isDAPage) {
        updateContext(null);
        currentEditorTabId = null;
        return;
      }
      
      try {
        await new Promise((resolve, reject) => {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'EXTRACT_CONTEXT' }, (response) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(response);
            }
          });
        });
      } catch (msgError) {
        // Content script didn't respond - try to extract context directly from URL
        const context = extractContextFromURL(tabs[0].url);
        if (context.org) {
          updateContext(context);
          // Update background with this context
          chrome.runtime.sendMessage({ type: 'CONTEXT_UPDATE', context });
        }
      }
    }
  } catch (error) {
    console.error('Error requesting context:', error.message);
  }
}

async function updateContext(context) {
  currentContext = context;
  
  if (context && context.org && context.repo) {
    let contextText = `📁 ${context.org}/${context.repo}`;
    if (context.path) {
      contextText += `/${context.path}`;
    }
    if (context.viewType) {
      contextText += ` (${context.viewType === 'editor' ? '✏️ editor' : '📂 explorer'})`;
    }
    contextBadge.textContent = contextText;
    contextBadge.style.background = 'rgba(46, 204, 113, 0.3)'; // Green for valid context
    contextBadge.style.color = 'white';
    
    // Update welcome message based on view type
    updateWelcomeMessage(context.viewType);
  } else {
    contextBadge.textContent = '⚠️ No DA context - Open a DA.live page';
    contextBadge.style.background = 'rgba(231, 76, 60, 0.3)'; // Red for no context
    contextBadge.style.color = 'white';
    
    // Reset to generic welcome message
    updateWelcomeMessage(null);
  }
}

function updateWelcomeMessage(viewType) {
  const welcomeMessage = document.getElementById('welcomeMessage');
  if (!welcomeMessage) return;
  
  const messageContent = welcomeMessage.querySelector('.message-content');
  
  if (viewType === 'editor') {
    messageContent.innerHTML = `
      <p>Hi! I'm your DA Agent. You're in <strong>Editor mode</strong>.</p>
      <p>I can help you with:</p>
      <ul>
        <li>Reading and analyzing the current document</li>
        <li>Editing content (HTML or JSON)</li>
        <li>Adding, updating, or removing sections</li>
        <li>Formatting and restructuring content</li>
      </ul>
      <p><strong>💡 Tip:</strong> I can see you're editing <code>${currentContext?.path || 'a document'}</code>. Just describe what you'd like to change!</p>
      <p>What would you like to do with this document?</p>
    `;
  } else if (viewType === 'explorer') {
    messageContent.innerHTML = `
      <p>Hi! I'm your DA Agent. You're in <strong>Explorer mode</strong>.</p>
      <p>I can help you with:</p>
      <ul>
        <li>Listing files and folders</li>
        <li>Creating new documents</li>
        <li>Deleting documents</li>
        <li>Managing your content structure</li>
      </ul>
      <p><strong>💡 Tip:</strong> I work at the file level here. To edit content, open a document in the editor.</p>
      <p>What would you like to do?</p>
    `;
  } else {
    messageContent.innerHTML = `
      <p>Hi! I'm your DA Agent.</p>
      <p><strong>💡 Tip:</strong> Make sure you're on a DA page and the badge above shows your current location.</p>
      <p>What would you like to do?</p>
    `;
  }
}

/**
 * Apply an editor update
 * @param {string} content - New content to set in the editor
 * @returns {Promise<boolean>} Success status
 */
async function applyEditorUpdate(content) {
  try {
    // Use the stored tab ID
    if (!currentEditorTabId) {
      console.error('No editor tab ID available');
      return false;
    }
    
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(currentEditorTabId, { 
        type: 'SET_EDITOR_CONTENT',
        content,
        requestId: Date.now().toString()
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to update editor:', chrome.runtime.lastError.message);
          resolve(false);
        } else {
          resolve(response?.success || false);
        }
      });
      
      // Timeout after 2 seconds
      setTimeout(() => resolve(false), 2000);
    });
  } catch (error) {
    console.error('Error updating editor:', error);
    return false;
  }
}

/**
 * Get editor content if we're in editor mode
 * @returns {Promise<string|null>} Editor content or null
 */
async function getEditorContent() {
  if (!currentContext || currentContext.viewType !== 'editor') {
    return null;
  }
  
  // Use the stored tab ID from when we got the context
  if (!currentEditorTabId) {
    console.error('No editor tab ID stored');
    return null;
  }
  
  try {
    // Verify the tab still exists
    try {
      await chrome.tabs.get(currentEditorTabId);
    } catch (tabError) {
      console.error('Tab no longer exists:', tabError.message);
      return null;
    }
    
    return new Promise((resolve) => {
      const requestId = Date.now().toString();
      
      // Set up timeout
      const timeoutId = setTimeout(() => {
        console.error('Timeout waiting for editor content - content script may not be responding');
        resolve(null);
      }, 5000);
      
      // Send message to content script to get editor content
      chrome.tabs.sendMessage(currentEditorTabId, { 
        type: 'GET_EDITOR_CONTENT',
        requestId
      }, (response) => {
        clearTimeout(timeoutId);
        
        if (chrome.runtime.lastError) {
          console.error('Failed to get editor content:', chrome.runtime.lastError.message);
          resolve(null);
        } else {
          resolve(response?.content || null);
        }
      });
    });
  } catch (error) {
    console.error('Error getting editor content:', error);
    return null;
  }
}

async function handleSend() {
  const message = chatInput.value.trim();
  
  if (!message || isProcessing) {
    return;
  }
  
  // Warn if no context (but still allow sending)
  if (!currentContext || !currentContext.org) {
    requestContext();
    // Wait a moment and try to get fresh context
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Add user message to chat
  addMessage(message, 'user');
  chatInput.value = '';
  autoResizeTextarea();
  
  // Show processing state
  setProcessing(true, 'Thinking...');
  
  try {
    // Get editor content if in editor mode
    let editorContent = null;
    
    if (currentContext?.viewType === 'editor') {
      setProcessing(true, 'Reading editor content...');
      editorContent = await getEditorContent();
      
      if (!editorContent) {
        console.warn('Failed to get editor content, will use API fallback');
      }
    }
    
    // Send to backend
    const response = await fetch(`${BACKEND_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        context: currentContext,
        editorContent, // Include editor content if available
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }
    
    // Handle streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let assistantMessage = '';
    let messageElement = null;
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        break;
      }
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            
            if (data.type === 'token') {
              assistantMessage += data.content;
              if (!messageElement) {
                messageElement = addMessage('', 'assistant');
              }
              updateMessage(messageElement, assistantMessage);
            } else if (data.type === 'status') {
              statusText.textContent = data.message;
            } else if (data.type === 'operations') {
              // Execute operations via headless editor
              if (data.operations && Array.isArray(data.operations)) {
                setProcessing(true, `Executing ${data.operations.length} operations...`);
                await executeOperations(data.operations);
              }
            } else if (data.type === 'complete') {
              // Apply editor update if provided
              if (data.editorUpdate && data.editorUpdate.content) {
                setProcessing(true, 'Updating editor...');
                await applyEditorUpdate(data.editorUpdate.content);
              } else if (data.shouldRefresh) {
                // Refresh the page if action was performed (for non-editor operations)
                setTimeout(() => {
                  chrome.runtime.sendMessage({ type: 'REFRESH_PAGE' });
                }, 1000);
              }
            } else if (data.type === 'error') {
              showError(data.message);
            }
          } catch (e) {
            console.error('Error parsing SSE data:', e.message);
          }
        }
      }
    }
    
  } catch (error) {
    console.error('Error sending message:', error.message);
    showError('Failed to communicate with the server. Please check if the backend is running.');
  } finally {
    setProcessing(false);
    
    // Save final chat history for current tab
    if (currentTabId) {
      saveChatHistoryForTab(currentTabId);
    }
  }
}

/**
 * Execute operations via backend DA Agent
 */
async function executeOperations(operations) {
  if (!currentContext || !currentContext.org || !currentContext.repo || !currentContext.path) {
    console.error('🤖 No valid context for operations');
    showError('Context not ready. Please refresh the page.');
    return;
  }

  console.log(`🤖 Executing ${operations.length} operations via DA Agent`);
  
  // Build docUrl and collabUrl from context
  const adminUrl = 'http://localhost:8787';
  const collabUrl = 'ws://localhost:4711';
  const docUrl = `${adminUrl}/source/${currentContext.org}/${currentContext.repo}/${currentContext.path}.html`;
  
  try {
    const results = [];
    
    // Execute each operation via backend
    for (const op of operations) {
      console.log('🤖 Executing operation:', op);
      let result;
      
      switch (op.type) {
        case 'position-cursor':
        case 'positionCursor':
          result = await callBackendOperation('position-cursor', { 
            docUrl, 
            collabUrl, 
            text: op.text || op.params?.text 
          });
          break;
          
        case 'delete-block':
        case 'deleteBlock':
          result = await callBackendOperation('delete-block', { 
            docUrl, 
            collabUrl 
          });
          break;
          
        case 'insert-at-cursor':
        case 'insertAtCursor':
          result = await callBackendOperation('insert-at-cursor', { 
            docUrl, 
            collabUrl, 
            text: op.text || op.params?.text,
            nodeType: op.nodeType || op.params?.nodeType || 'paragraph'
          });
          break;
          
        case 'replace-text':
        case 'replaceText':
          result = await callBackendOperation('replace-text', { 
            docUrl, 
            collabUrl, 
            find: op.find || op.params?.find,
            replace: op.replace || op.params?.replace
          });
          break;
          
        default:
          result = { success: false, message: `Unknown operation type: ${op.type}` };
      }
      
      console.log('🤖 Operation result:', result);
      results.push(result);
    }
    
    // Log results
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    
    console.log(`🤖 Operations complete: ${successCount} succeeded, ${failCount} failed`);
    
    // Show summary in status
    if (failCount > 0) {
      setProcessing(true, `⚠️ ${successCount}/${operations.length} operations succeeded`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    } else {
      setProcessing(true, `✅ All ${successCount} operations completed`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (err) {
    console.error('🤖 Error executing operations:', err);
    showError(`Failed to execute operations: ${err.message}`);
  }
}

/**
 * Call backend operation API
 */
async function callBackendOperation(endpoint, data) {
  try {
    console.log(`🤖 Calling ${endpoint} with:`, data);
    const response = await fetch(`${BACKEND_URL}/api/operations/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`🤖 Backend error (${response.status}):`, errorText);
      return { success: false, message: `Backend error: ${response.status} - ${errorText}` };
    }
    
    const result = await response.json();
    console.log(`🤖 Backend response for ${endpoint}:`, result);
    return result;
  } catch (error) {
    console.error(`🤖 Network error calling ${endpoint}:`, error);
    return { success: false, message: error.message };
  }
}

function addMessage(content, role) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${role}`;
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  contentDiv.textContent = content;
  
  messageDiv.appendChild(contentDiv);
  chatMessages.appendChild(messageDiv);
  
  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
  
  // Save history for current tab
  if (currentTabId) {
    saveChatHistoryForTab(currentTabId);
  }
  
  return contentDiv;
}

function updateMessage(element, content) {
  // Simple markdown-like formatting
  const formatted = content
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
  
  element.innerHTML = formatted;
  chatMessages.scrollTop = chatMessages.scrollHeight;
  
  // Save history for current tab (throttled updates for performance)
  // Only save every 50 characters to avoid excessive saves during streaming
  if (currentTabId && content.length % 50 === 0) {
    saveChatHistoryForTab(currentTabId);
  }
}

function setProcessing(processing, message = 'Thinking...') {
  isProcessing = processing;
  sendButton.disabled = processing;
  chatInput.disabled = processing;
  
  if (processing) {
    statusIndicator.style.display = 'flex';
    statusText.textContent = message;
  } else {
    statusIndicator.style.display = 'none';
  }
}

function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.textContent = `Error: ${message}`;
  
  chatMessages.appendChild(errorDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  
  setTimeout(() => {
    errorDiv.remove();
  }, 5000);
}

