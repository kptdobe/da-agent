// Context storage
let currentContext = {
  org: null,
  repo: null,
  path: null,
  viewType: null, // 'explorer' or 'editor'
  url: null,
};

// Set up side panel behavior
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// Listen for messages from content script and side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CONTEXT_UPDATE') {
    // Update context from content script
    console.log('DA Agent Background: Received context update:', message.context);
    currentContext = { ...currentContext, ...message.context };
    console.log('DA Agent Background: Current context:', currentContext);
    
    // Broadcast to side panel if it's open
    broadcastToSidePanel({ type: 'CONTEXT_UPDATE', context: currentContext });
    
    sendResponse({ success: true });
  } else if (message.type === 'GET_CONTEXT') {
    // Side panel requesting current context
    console.log('DA Agent Background: GET_CONTEXT request, sending:', currentContext);
    sendResponse({ context: currentContext });
  } else if (message.type === 'REFRESH_PAGE') {
    // Refresh the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.reload(tabs[0].id);
      }
    });
    sendResponse({ success: true });
  }
  
  return true; // Keep the message channel open for async responses
});

// Monitor tab updates to refresh context
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Check if URL is a DA site
    if (tab.url.includes('localhost:3000') || tab.url.includes('da.live')) {
      console.log('DA Agent Background: Page loaded, checking for content script...');
      
      // Wait a moment for content script to load
      setTimeout(() => {
        chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_CONTEXT' }, (response) => {
          if (chrome.runtime.lastError) {
            console.warn('DA Agent Background: Content script not responding, might need manual injection');
            console.log('DA Agent Background: URL was:', tab.url);
          } else {
            console.log('DA Agent Background: Content script responded successfully');
          }
        });
      }, 100);
    }
  }
});

// Monitor active tab changes
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab.url && (tab.url.includes('localhost:3000') || tab.url.includes('da.live'))) {
      // Request context extraction from content script
      chrome.tabs.sendMessage(activeInfo.tabId, { type: 'EXTRACT_CONTEXT' });
    } else {
      // Clear context if not on DA site
      currentContext = {
        org: null,
        repo: null,
        path: null,
        viewType: null,
        url: null,
      };
      broadcastToSidePanel({ type: 'CONTEXT_UPDATE', context: currentContext });
    }
  });
});

// Broadcast message to side panel (with better error handling)
function broadcastToSidePanel(message) {
  try {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        // Side panel might not be open, that's okay
        // Don't log this as it's normal when panel is closed
      }
    });
  } catch (error) {
    // Silently fail - this is expected when side panel is closed
  }
}

console.log('DA Agent background script loaded');

