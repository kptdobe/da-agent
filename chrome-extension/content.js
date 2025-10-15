// Content script for extracting context from DA pages

// Extract context from current URL and page
function extractContext() {
  const url = window.location.href;
  const context = {
    url,
    org: null,
    repo: null,
    path: null,
    viewType: null,
  };
  
  // Parse URL patterns
  // Explorer pattern: https://da.live/#/owner/repo/directory_path
  // Editor pattern: https://da.live/edit#/owner/repo/file_path
  
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

// Send context to background script
function sendContext() {
  const context = extractContext();
  console.log('DA Agent: Extracted context:', context);
  
  try {
    chrome.runtime.sendMessage(
      { type: 'CONTEXT_UPDATE', context },
      (response) => {
        if (chrome.runtime.lastError) {
          // Extension context might be invalidated - this can happen during reload
          console.warn('DA Agent: Could not send context (extension may be reloading)');
        } else {
          console.log('DA Agent: Context sent successfully');
        }
      }
    );
  } catch (error) {
    console.warn('DA Agent: Exception sending context:', error.message);
  }
}

// Store pending requests
const pendingRequests = new Map();

// Listen for messages from background script and side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EXTRACT_CONTEXT') {
    sendContext();
    sendResponse({ success: true });
  } else if (message.type === 'GET_EDITOR_CONTENT') {
    // Forward to page context via postMessage
    const requestId = message.requestId || Date.now().toString();
    pendingRequests.set(requestId, sendResponse);
    window.postMessage({ type: 'DA_GET_CONTENT', requestId }, '*');
    return true; // Keep channel open for async response
  } else if (message.type === 'SET_EDITOR_CONTENT') {
    const requestId = message.requestId || Date.now().toString();
    pendingRequests.set(requestId, sendResponse);
    window.postMessage({ 
      type: 'DA_SET_CONTENT', 
      content: message.content,
      requestId 
    }, '*');
    return true;
  } else if (message.type === 'UPDATE_EDITOR_SECTION') {
    const requestId = message.requestId || Date.now().toString();
    pendingRequests.set(requestId, sendResponse);
    window.postMessage({ 
      type: 'DA_UPDATE_SECTION', 
      selector: message.selector,
      content: message.content,
      requestId 
    }, '*');
    return true;
  }
  return false;
});

// Listen for responses from the page
window.addEventListener('message', (event) => {
  // Only accept messages from the same window
  if (event.source !== window) return;
  
  if (event.data.type === 'DA_CONTENT_RESPONSE') {
    const sendResponse = pendingRequests.get(event.data.requestId);
    if (sendResponse) {
      sendResponse({
        content: event.data.content,
        success: event.data.success,
      });
      pendingRequests.delete(event.data.requestId);
    }
  } else if (event.data.type === 'DA_OPERATION_RESPONSE') {
    const sendResponse = pendingRequests.get(event.data.requestId);
    if (sendResponse) {
      sendResponse({
        success: event.data.success,
        error: event.data.error,
      });
      pendingRequests.delete(event.data.requestId);
    }
  }
});

// Watch for URL changes (for SPA navigation)
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    sendContext();
  }
}).observe(document, { subtree: true, childList: true });

// Initial context extraction - FIRST THING TO RUN
(function() {
  console.log('%c🤖 DA Agent Content Script Loaded!', 'background: #667eea; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;');
  console.log('DA Agent: URL:', window.location.href);
  console.log('DA Agent: Manifest version:', chrome.runtime.getManifest().version);
  console.log('DA Agent: Message listener set up');
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('DA Agent: DOM loaded, extracting context...');
    sendContext();
  });
} else {
  console.log('DA Agent: Document ready, extracting context...');
  sendContext();
}

// Also send context after a short delay to ensure page is fully loaded
setTimeout(() => {
  console.log('DA Agent: Delayed context extraction...');
  sendContext();
}, 1000);

// ============================================
// Editor Bridge Integration
// ============================================

// Inject editor-bridge.js into the page context
function injectEditorBridge() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('editor-bridge.js');
  script.onload = function() {
    this.remove();
  };
  (document.head || document.documentElement).appendChild(script);
}

// Inject when on an editor page
const context = extractContext();
if (context.viewType === 'editor') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectEditorBridge);
  } else {
    injectEditorBridge();
  }
}

