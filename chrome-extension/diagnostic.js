let logs = [];

function log(message) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  logs.push(`[${timestamp}] ${message}`);
  updateLogDisplay();
}

function updateLogDisplay() {
  document.getElementById('logs').textContent = logs.join('\n');
}

function clearLogs() {
  logs = [];
  updateLogDisplay();
}

async function runDiagnostics() {
  clearLogs();
  log('🔍 Starting diagnostics...\n');
  
  // Check extension basics
  log('✓ Extension loaded');
  log(`✓ Extension ID: ${chrome.runtime.id}`);
  
  // Check permissions
  const permissions = await chrome.permissions.getAll();
  log(`✓ Permissions: ${permissions.permissions.join(', ')}`);
  log(`✓ Host permissions: ${permissions.origins.join(', ')}`);
  
  // Check active tab
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]) {
    log(`✓ Active tab URL: ${tabs[0].url}`);
    
    // Check if it's a DA page
    const isDAPage = tabs[0].url.includes('da.live') || tabs[0].url.includes('localhost:3000');
    if (isDAPage) {
      log('✓ This is a DA page');
    } else {
      log('⚠️ This is NOT a DA page - extension will not work here');
    }
    
    // Try to communicate with content script
    try {
      const response = await chrome.tabs.sendMessage(tabs[0].id, { type: 'EXTRACT_CONTEXT' });
      log('✓ Content script is responding');
    } catch (error) {
      log(`❌ Content script error: ${error.message}`);
      log('⚠️ Try refreshing the DA page');
    }
  } else {
    log('❌ No active tab found');
  }
  
  // Check background script context
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_CONTEXT' });
    log('✓ Background script is responding');
    log(`Context: ${JSON.stringify(response.context, null, 2)}`);
  } catch (error) {
    log(`❌ Background script error: ${error.message}`);
  }
  
  log('\n✅ Diagnostics complete!');
  updateStatus();
}

async function testContentScript() {
  clearLogs();
  log('📝 Testing content script...\n');
  
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs[0]) {
    log('❌ No active tab');
    return;
  }
  
  log(`Testing on: ${tabs[0].url}`);
  
  try {
    const response = await chrome.tabs.sendMessage(tabs[0].id, { type: 'EXTRACT_CONTEXT' });
    log('✓ Content script responded');
    log(`Response: ${JSON.stringify(response, null, 2)}`);
  } catch (error) {
    log(`❌ Error: ${error.message}`);
    log('\nPossible causes:');
    log('1. Not on a DA page (da.live or localhost:3000)');
    log('2. Content script not loaded - try refreshing the page');
    log('3. Extension needs to be reloaded in chrome://extensions/');
  }
}

async function checkActiveTab() {
  clearLogs();
  log('🌐 Checking active tab...\n');
  
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs[0]) {
    log('❌ No active tab');
    return;
  }
  
  const tab = tabs[0];
  log(`URL: ${tab.url}`);
  log(`Title: ${tab.title}`);
  log(`ID: ${tab.id}`);
  
  // Check if URL matches DA patterns
  const isDaLive = tab.url.includes('da.live');
  const isLocalhost = tab.url.includes('localhost:3000');
  
  if (isDaLive || isLocalhost) {
    log('✓ This is a DA page');
    
    // Try to extract context from URL
    const url = tab.url;
    let org = null, repo = null, path = null, viewType = null;
    
    if (url.includes('/edit#/')) {
      viewType = 'editor';
      const match = url.match(/\/edit#\/([^/]+)\/([^/]+)(?:\/(.+))?/);
      if (match) {
        org = match[1];
        repo = match[2];
        path = match[3] || '';
      }
    } else if (url.includes('/#/')) {
      viewType = 'explorer';
      const match = url.match(/\/#\/([^/]+)\/([^/]+)(?:\/(.+))?/);
      if (match) {
        org = match[1];
        repo = match[2];
        path = match[3] || '';
      }
    }
    
    log(`\nExtracted context:`);
    log(`  Organization: ${org || 'NOT FOUND'}`);
    log(`  Repository: ${repo || 'NOT FOUND'}`);
    log(`  Path: ${path || '(root)'}`);
    log(`  View Type: ${viewType || 'NOT FOUND'}`);
    
    if (!org || !repo) {
      log('\n⚠️ Context extraction failed!');
      log('The URL might not match the expected pattern.');
      log('Expected: https://da.live/#/org/repo/path or https://da.live/edit#/org/repo/path');
    }
  } else {
    log('⚠️ This is NOT a DA page');
    log('Extension only works on:');
    log('  - https://da.live');
    log('  - http://localhost:3000');
  }
}

function updateStatus() {
  // This would update the status display
  document.getElementById('status').innerHTML = `
    <div class="status-item">
      <span>Extension Status:</span>
      <span class="status-good">✓ Running</span>
    </div>
    <div class="status-item">
      <span>Diagnostics:</span>
      <span class="status-good">✓ Complete</span>
    </div>
  `;
}

log('Ready! Click a button to start diagnostics.');

