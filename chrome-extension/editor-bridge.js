/**
 * DA Editor Bridge
 * 
 * Provides direct access to the ProseMirror editor on da.live pages.
 * This allows the extension to get and set content without making API calls.
 */

/**
 * Check if we're on a DA editor page with ProseMirror loaded
 * @returns {boolean} True if editor is available
 */
function isEditorAvailable() {
  return !!(window.view && window.view.state && window.view.docView);
}

/**
 * Get the current document content as HTML
 * @returns {string|null} HTML content or null if editor not available
 */
function getEditorContent() {
  if (!isEditorAvailable()) {
    console.warn('DA Agent: ProseMirror editor not available');
    return null;
  }

  try {
    // Clone the editor's DOM
    const clone = window.view.docView.dom.cloneNode(true);
    
    // Get the HTML content
    // The editor stores content in a format similar to the final output
    const html = clone.innerHTML;
    
    return html;
  } catch (error) {
    console.error('DA Agent: Error getting editor content:', error);
    return null;
  }
}

/**
 * Get the current document content as structured HTML (body with sections)
 * This mimics the prose2aem conversion
 * @returns {string|null} Structured HTML or null if editor not available
 */
function getEditorContentAsHTML() {
  if (!isEditorAvailable()) {
    console.warn('DA Agent: ProseMirror editor not available');
    return null;
  }

  try {
    // Clone the editor's DOM
    const clone = window.view.docView.dom.cloneNode(true);
    
    // Basic cleanup
    clone.removeAttribute('class');
    clone.removeAttribute('contenteditable');
    clone.removeAttribute('translate');
    
    // Remove ProseMirror-specific elements
    const emptyImgs = clone.querySelectorAll('img.ProseMirror-separator');
    emptyImgs.forEach(el => el.remove());
    
    const trailingBreaks = clone.querySelectorAll('.ProseMirror-trailingBreak');
    trailingBreaks.forEach(el => el.remove());
    
    const userPointers = clone.querySelectorAll('.ProseMirror-yjs-cursor');
    userPointers.forEach(el => el.remove());
    
    const gapCursors = clone.querySelectorAll('.ProseMirror-gapcursor');
    gapCursors.forEach(el => el.remove());
    
    const highlights = clone.querySelectorAll('span.ProseMirror-yjs-selection');
    highlights.forEach(el => {
      el.parentElement.replaceChild(document.createTextNode(el.innerText), el);
    });
    
    // Return wrapped in body structure
    const html = `<body><header></header><main>${clone.innerHTML}</main><footer></footer></body>`;
    
    return html;
  } catch (error) {
    console.error('DA Agent: Error converting editor content:', error);
    return null;
  }
}

/**
 * Set the editor content from HTML
 * @param {string} html - HTML content to set
 * @returns {boolean} True if successful
 */
function setEditorContent(html) {
  if (!isEditorAvailable()) {
    console.warn('DA Agent: ProseMirror editor not available');
    return false;
  }

  try {
    // Parse the HTML to extract main content
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const main = doc.querySelector('main');
    const content = main ? main.innerHTML : html;
    
    // Get the editor's DOM element
    const editorDom = window.view.docView.dom;
    
    // Update the content
    // This is a simple approach - for production, you'd want to use ProseMirror transactions
    editorDom.innerHTML = content;
    
    // Trigger an update to ensure ProseMirror state is synchronized
    // This simulates user input to trigger the collaboration sync
    const event = new Event('input', { bubbles: true });
    editorDom.dispatchEvent(event);
    
    return true;
  } catch (error) {
    console.error('DA Agent: Error setting editor content:', error);
    return false;
  }
}

/**
 * Update a specific section of the document
 * @param {string} sectionSelector - CSS selector to find the section
 * @param {string} newContent - New HTML content for the section
 * @returns {boolean} True if successful
 */
function updateEditorSection(sectionSelector, newContent) {
  if (!isEditorAvailable()) {
    console.warn('DA Agent: ProseMirror editor not available');
    return false;
  }

  try {
    const editorDom = window.view.docView.dom;
    const section = editorDom.querySelector(sectionSelector);
    
    if (!section) {
      console.warn(`DA Agent: Section not found: ${sectionSelector}`);
      return false;
    }
    
    section.innerHTML = newContent;
    
    // Trigger update
    const event = new Event('input', { bubbles: true });
    editorDom.dispatchEvent(event);
    
    return true;
  } catch (error) {
    console.error('DA Agent: Error updating section:', error);
    return false;
  }
}

/**
 * Insert content at the end of the document
 * @param {string} html - HTML content to insert
 * @returns {boolean} True if successful
 */
function appendEditorContent(html) {
  if (!isEditorAvailable()) {
    console.warn('DA Agent: ProseMirror editor not available');
    return false;
  }

  try {
    const editorDom = window.view.docView.dom;
    
    // Parse the HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const fragment = doc.body;
    
    // Append all children
    while (fragment.firstChild) {
      editorDom.appendChild(fragment.firstChild);
    }
    
    // Trigger update
    const event = new Event('input', { bubbles: true });
    editorDom.dispatchEvent(event);
    
    return true;
  } catch (error) {
    console.error('DA Agent: Error appending content:', error);
    return false;
  }
}

// Export functions for use in content script
window.daEditorBridge = {
  isEditorAvailable,
  getEditorContent,
  getEditorContentAsHTML,
  setEditorContent,
  updateEditorSection,
  appendEditorContent,
};

// Listen for messages from content script
window.addEventListener('message', (event) => {
  // Only accept messages from the same window
  if (event.source !== window) return;
  
  try {
    if (event.data.type === 'DA_GET_CONTENT') {
      const content = getEditorContentAsHTML();
      window.postMessage({
        type: 'DA_CONTENT_RESPONSE',
        requestId: event.data.requestId,
        content,
        success: content !== null,
      }, '*');
      
    } else if (event.data.type === 'DA_SET_CONTENT') {
      const success = setEditorContent(event.data.content);
      window.postMessage({
        type: 'DA_OPERATION_RESPONSE',
        requestId: event.data.requestId,
        success,
        error: success ? null : 'Failed to set content',
      }, '*');
      
    } else if (event.data.type === 'DA_UPDATE_SECTION') {
      const success = updateEditorSection(event.data.selector, event.data.content);
      window.postMessage({
        type: 'DA_OPERATION_RESPONSE',
        requestId: event.data.requestId,
        success,
        error: success ? null : 'Failed to update section',
      }, '*');
    }
  } catch (error) {
    console.error('DA Agent: Error handling bridge message:', error);
    window.postMessage({
      type: 'DA_OPERATION_RESPONSE',
      requestId: event.data.requestId,
      success: false,
      error: error.message,
    }, '*');
  }
});

console.log('🔌 DA Agent: Editor Bridge loaded');

