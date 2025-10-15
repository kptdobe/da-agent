# DA Agent - Chrome Extension

This directory contains the Chrome extension component of DA Agent.

## Quick Troubleshooting

### "Could not establish connection" Error

This error is normal and can be safely ignored. It occurs when:
- The side panel is closed and the background script tries to send updates
- The extension is being reloaded
- The content script loads before the background script is ready

The extension handles these cases gracefully and will continue to work.

### Context Not Detected

1. **Reload the extension**
   - Go to `chrome://extensions/`
   - Find "DA Agent"
   - Click the reload icon 🔄

2. **Check you're on a DA page**
   - URL must be `https://da.live/#/...` or `http://localhost:3000/#/...`
   - URL must contain org and repo: `/#/org/repo/path`

3. **Refresh the DA page**
   - F5 or Cmd+R to reload
   - Then reopen the side panel

4. **Use the diagnostic tool**
   - Go to `chrome://extensions/`
   - Find "DA Agent" → Click "Details"
   - Click "Extension options"
   - Click "Run Diagnostics"

5. **Click the refresh button**
   - In the side panel, click the 🔄 button next to the context badge
   - This manually refreshes the context

## Files

- `manifest.json` - Extension manifest (Manifest V3)
- `background.js` - Background service worker
- `content.js` - Content script for context extraction
- `sidepanel.html` - Side panel UI structure
- `sidepanel.css` - Side panel styles
- `sidepanel.js` - Side panel logic and backend communication
- `diagnostic.html/js` - Diagnostic tool for troubleshooting
- `icons/` - Extension icons (16x16, 48x48, 128x128)

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select this directory

## Development

After making changes:
1. Go to `chrome://extensions/`
2. Click the refresh button on DA Agent
3. Reload any DA pages

## Configuration

Edit `sidepanel.js` to change:
- `BACKEND_URL` - Backend server URL (default: http://localhost:3101)

## Permissions

- `sidePanel` - Display side panel interface
- `activeTab` - Access current tab information
- `storage` - Store extension state
- Host permissions for `http://localhost:3000/*` and `https://da.live/*`

## Architecture

### Background Worker (`background.js`)
- Maintains context state
- Handles messages between content script and side panel
- Manages tab updates and navigation
- Triggers page refreshes

### Content Script (`content.js`)
- Extracts context from DA URLs
- Watches for URL changes (SPA navigation)
- Sends context updates to background worker

### Side Panel (`sidepanel.*`)
- Chat interface
- Communicates with backend via HTTP/SSE
- Displays streaming responses
- Shows current context badge with refresh button

## Context Extraction

The extension detects two DA view types:

**Explorer**: `https://da.live/#/org/repo/path`
```json
{
  "org": "org",
  "repo": "repo",
  "path": "path",
  "viewType": "explorer"
}
```

**Editor**: `https://da.live/edit#/org/repo/path/file`
```json
{
  "org": "org",
  "repo": "repo",
  "path": "path/file",
  "viewType": "editor"
}
```

## Communication Flow

1. Content script extracts context from URL
2. Context sent to background worker
3. Background broadcasts to side panel (if open)
4. User sends message in side panel
5. Side panel sends to backend with context
6. Backend streams response via SSE
7. Side panel displays response
8. On completion, background refreshes page

## Debugging

### Check Content Script
Open DevTools on DA page (F12):
```
DA Agent content script loaded on: https://da.live/edit#/...
DA Agent: Extracted context: {org: "...", repo: "..."}
```

### Check Background Script
Go to `chrome://extensions/` → DA Agent → "service worker":
```
DA Agent Background: Received context update: {...}
```

### Check Side Panel
Right-click side panel → Inspect:
```
DA Agent Side Panel: Received context: {...}
```

### Use Diagnostic Tool
Go to `chrome://extensions/` → DA Agent → "Extension options"
- Run full diagnostics
- Test content script
- Check active tab
- View detailed logs

## Common Issues

### Context is null in backend
- Content script not loaded → refresh DA page
- Not on DA page → check URL pattern
- Extension needs reload → reload in chrome://extensions/

### Side panel shows "No DA context"
- Click the 🔄 refresh button
- Or close and reopen the panel
- Or refresh the DA page

### Extension errors after update
- Reload extension in chrome://extensions/
- Close all DA tabs and reopen
- Clear extension storage if needed
