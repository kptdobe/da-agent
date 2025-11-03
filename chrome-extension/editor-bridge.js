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
 * Find the actual scrollable container for the editor
 * @returns {Element|Window} The scrollable element or window
 */
function getScrollContainer() {
  // Strategy 1: Check for <main> element (DA's scroll container)
  const mainElement = document.querySelector('main');
  if (mainElement && mainElement.scrollHeight > mainElement.clientHeight) {
    return mainElement;
  }
  
  // Strategy 2: Check if window is scrolled
  if (window.scrollY > 0 || document.documentElement.scrollTop > 0 || document.body.scrollTop > 0) {
    return window;
  }
  
  // Strategy 3: Find any parent that is currently scrolled
  let element = window.view.dom;
  while (element && element !== document.documentElement) {
    if (element.scrollTop > 0 || element.scrollLeft > 0) {
      return element;
    }
    element = element.parentElement;
  }
  
  // Strategy 4: Find any parent that CAN scroll (has overflow and scrollable area)
  element = window.view.dom;
  while (element && element !== document.documentElement) {
    const style = window.getComputedStyle(element);
    const overflow = style.overflow + style.overflowY;
    if (overflow.includes('scroll') || overflow.includes('auto')) {
      if (element.scrollHeight > element.clientHeight) {
        return element;
      }
    }
    element = element.parentElement;
  }
  
  // Strategy 5: Check body
  if (document.body && (document.body.scrollTop > 0 || document.body.scrollHeight > document.body.clientHeight)) {
    return document.body;
  }
  
  // Strategy 6: Fall back to main element if it exists
  if (mainElement) {
    return mainElement;
  }
  
  // Strategy 7: Fall back to document.documentElement
  return document.documentElement;
}

/**
 * Get scroll position from a container (handles both window and element)
 * @param {Element|Window} container - The scroll container
 * @returns {{top: number, left: number}} Scroll position
 */
function getScrollPosition(container) {
  if (container === window) {
    return {
      top: window.scrollY || window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0,
      left: window.scrollX || window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft || 0,
    };
  }
  return {
    top: container.scrollTop || 0,
    left: container.scrollLeft || 0,
  };
}

/**
 * Set scroll position on a container (handles both window and element)
 * @param {Element|Window} container - The scroll container
 * @param {{top: number, left: number}} position - Scroll position
 */
function setScrollPosition(container, position) {
  if (container === window) {
    window.scrollTo(position.left, position.top);
  } else {
    container.scrollTop = position.top;
    container.scrollLeft = position.left;
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
    // Save current cursor position and scroll position
    const scrollContainer = getScrollContainer();
    const savedScrollPosition = getScrollPosition(scrollContainer);
    const savedSelection = {
      from: window.view.state.selection.from,
      to: window.view.state.selection.to
    };
    
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
    
    // Restore cursor position and scroll after a brief delay
    setTimeout(() => {
      try {
        const docSize = window.view.state.doc.content.size;
        
        if (savedSelection.from > 0 && savedSelection.from <= docSize && savedSelection.to <= docSize) {
          const TextSelection = window.view.state.selection.constructor;
          const tr = window.view.state.tr.setSelection(
            TextSelection.create(window.view.state.doc, savedSelection.from, savedSelection.to)
          );
          window.view.dispatch(tr);
        }
        
        setScrollPosition(scrollContainer, savedScrollPosition);
      } catch (restoreError) {
        console.warn('Could not restore cursor position:', restoreError.message);
      }
    }, 100);
    
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
    // Use tracked positions
    const savedSelection = { ...lastKnownCursorPosition };
    const savedScrollPosition = { ...lastKnownScrollPosition };
    
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
    
    // Restore positions after a brief delay
    setTimeout(() => {
      try {
        const docSize = window.view.state.doc.content.size;
        
        if (savedSelection.from > 0 && savedSelection.from <= docSize && savedSelection.to <= docSize) {
          const TextSelection = window.view.state.selection.constructor;
          const tr = window.view.state.tr.setSelection(
            TextSelection.create(window.view.state.doc, savedSelection.from, savedSelection.to)
          );
          window.view.dispatch(tr);
        }
        
        const scrollContainer = getScrollContainer();
        setScrollPosition(scrollContainer, savedScrollPosition);
      } catch (restoreError) {
        console.warn('Could not restore cursor position:', restoreError.message);
      }
    }, 100);
    
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
    // Use tracked scroll position
    const savedScrollPosition = { ...lastKnownScrollPosition };
    
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
    
    // Restore scroll position after a brief delay
    setTimeout(() => {
      try {
        const scrollContainer = getScrollContainer();
        setScrollPosition(scrollContainer, savedScrollPosition);
      } catch (restoreError) {
        console.warn('Could not restore scroll position:', restoreError.message);
      }
    }, 100);
    
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
  // Debug helpers
  updateTrackedPositions,
  getTrackedPositions: () => ({ 
    cursor: lastKnownCursorPosition, 
    scroll: lastKnownScrollPosition 
  }),
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

