/**
 * Document Operations Service
 * Server-side headless editor using JSDOM (like helix-collab)
 */

import { JSDOM } from 'jsdom';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { EditorState, TextSelection, Selection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { Schema } from 'prosemirror-model';
import { ySyncPlugin, yUndoPlugin, initProseMirrorDoc } from 'y-prosemirror';
import { yHeadlessCursorPlugin } from './headless-cursor-plugin.js';

global.ClipboardEvent = Event;

class DocumentOperations {
  constructor() {
    this.connections = new Map(); // docUrl -> connection
  }

  /**
   * Get or create a connection to a document
   */
  async connect(docUrl, collabUrl) {
    const key = `${collabUrl}:${docUrl}`;
    
    if (this.connections.has(key)) {
      return this.connections.get(key);
    }

    console.log('🔌 Connecting to document:', { docUrl, collabUrl });

    // Setup JSDOM (like helix-collab)
    const dom = new JSDOM('', {
      url: 'http://localhost',
      pretendToBeVisual: true,
    });
    
    // Set globals (needed by ProseMirror)
    global.window = dom.window;
    global.document = dom.window.document;

    // Create da.live schema (simplified for now)
    const schema = new Schema({
      nodes: {
        doc: { content: 'block+' },
        paragraph: {
          content: 'inline*',
          group: 'block',
          parseDOM: [{ tag: 'p' }],
          toDOM() { return ['p', 0]; }
        },
        heading: {
          attrs: { level: { default: 1 } },
          content: 'inline*',
          group: 'block',
          defining: true,
          parseDOM: [1, 2, 3, 4, 5, 6].map(level => ({
            tag: `h${level}`,
            attrs: { level }
          })),
          toDOM(node) { return [`h${node.attrs.level}`, 0]; }
        },
        text: {
          group: 'inline'
        }
      },
      marks: {}
    });

    // Create Y.js document
    const ydoc = new Y.Doc();
    
    // Create WebSocket provider
    const provider = new WebsocketProvider(collabUrl, docUrl, ydoc);
    const awareness = provider.awareness;

    // Set awareness
    awareness.setLocalStateField('user', {
      color: '#667eea',
      name: '🤖 DA Agent',
      id: `da-agent-${awareness.clientID}`
    });

    // Wait for sync
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Sync timeout'));
      }, 10000);

      if (provider.synced) {
        clearTimeout(timeout);
        resolve();
      } else {
        provider.on('sync', (isSynced) => {
          if (isSynced) {
            clearTimeout(timeout);
            resolve();
          }
        });
      }
    });

    // Initialize ProseMirror document (like helix-collab)
    const type = ydoc.getXmlFragment('prosemirror');
    const { doc, mapping } = initProseMirrorDoc(type, schema);

    // Create ProseMirror view with headless cursor plugin
    const view = new EditorView(null, {
      state: EditorState.create({
        doc,
        schema,
        plugins: [
          ySyncPlugin(type, { mapping }),
          yHeadlessCursorPlugin(awareness),
          yUndoPlugin(),
        ],
      }),
    });

    const connection = {
      ydoc,
      provider,
      awareness,
      view,
      schema,
      dom
    };

    this.connections.set(key, connection);
    console.log('✅ Connected to document');

    return connection;
  }

  /**
   * Disconnect from a document
   */
  disconnect(docUrl, collabUrl) {
    const key = `${collabUrl}:${docUrl}`;
    const connection = this.connections.get(key);
    
    if (connection) {
      connection.view.destroy();
      connection.provider.destroy();
      this.connections.delete(key);
      console.log('🔌 Disconnected from document');
    }
  }

  /**
   * Find text in document
   */
  findText(view, searchText) {
    const doc = view.state.doc;
    let found = false;
    let foundPos = -1;

    doc.descendants((node, pos) => {
      if (found) return false;

      if (node.isText && node.text) {
        const index = node.text.toLowerCase().indexOf(searchText.toLowerCase());
        if (index >= 0) {
          foundPos = pos + index;
          found = true;
          return false;
        }
      }
    });

    return found ? { from: foundPos, to: foundPos + searchText.length } : null;
  }

  /**
   * Helper: Set cursor position (like helix-collab)
   */
  setCursor(view, pos) {
    let sel;
    if (pos === 0) {
      sel = Selection.atStart(view.state.doc);
    } else if (pos < 0) {
      sel = Selection.atEnd(view.state.doc);
    } else {
      sel = TextSelection.create(view.state.doc, pos);
    }
    view.dispatch(view.state.tr.setSelection(sel));
  }

  /**
   * Operation 1: Position cursor (find and select text)
   */
  async positionCursor(docUrl, collabUrl, searchText) {
    try {
      const connection = await this.connect(docUrl, collabUrl);
      const { view } = connection;

      const pos = this.findText(view, searchText);

      if (pos) {
        // Set selection - the headless cursor plugin will update awareness
        const tr = view.state.tr.setSelection(
          TextSelection.create(view.state.doc, pos.from, pos.to)
        );
        view.dispatch(tr);

        return {
          success: true,
          message: `Found "${searchText}" at position ${pos.from}-${pos.to}`,
          position: pos
        };
      } else {
        return {
          success: false,
          message: `Text "${searchText}" not found`
        };
      }
    } catch (error) {
      console.error('Error in positionCursor:', error);
      return {
        success: false,
        message: `Error: ${error.message}`
      };
    }
  }

  /**
   * Operation 2: Delete block at cursor
   */
  async deleteBlock(docUrl, collabUrl) {
    try {
      const connection = await this.connect(docUrl, collabUrl);
      const { view } = connection;

      const { $from } = view.state.selection;
      const node = $from.parent;

      if (node) {
        const from = $from.before();
        const to = $from.after();
        const tr = view.state.tr.delete(from, to);
        view.dispatch(tr);

        return {
          success: true,
          message: 'Block deleted successfully'
        };
      } else {
        return {
          success: false,
          message: 'No block to delete'
        };
      }
    } catch (error) {
      console.error('Error in deleteBlock:', error);
      return {
        success: false,
        message: `Error: ${error.message}`
      };
    }
  }

  /**
   * Operation 3: Insert content at cursor
   */
  async insertAtCursor(docUrl, collabUrl, text, nodeType = 'paragraph') {
    try {
      const connection = await this.connect(docUrl, collabUrl);
      const { view, schema } = connection;

      // Create node based on type
      let node;
      if (nodeType === 'paragraph') {
        node = schema.nodes.paragraph.create(null, schema.text(text));
      } else if (nodeType.startsWith('heading')) {
        const level = parseInt(nodeType.replace('heading', ''));
        node = schema.nodes.heading.create({ level }, schema.text(text));
      } else {
        node = schema.nodes.paragraph.create(null, schema.text(text));
      }

      // Insert at cursor
      const tr = view.state.tr.insert(view.state.selection.to, node);
      view.dispatch(tr);

      return {
        success: true,
        message: `${nodeType} inserted successfully`
      };
    } catch (error) {
      console.error('Error in insertAtCursor:', error);
      return {
        success: false,
        message: `Error: ${error.message}`
      };
    }
  }

  /**
   * Operation 4: Replace text
   */
  async replaceText(docUrl, collabUrl, findText, replaceText) {
    try {
      const connection = await this.connect(docUrl, collabUrl);
      const { view, schema } = connection;

      const pos = this.findText(view, findText);

      if (pos) {
        const tr = view.state.tr.replaceWith(
          pos.from,
          pos.to,
          schema.text(replaceText)
        );
        view.dispatch(tr);

        return {
          success: true,
          message: 'Text replaced successfully'
        };
      } else {
        return {
          success: false,
          message: `Text "${findText}" not found`
        };
      }
    } catch (error) {
      console.error('Error in replaceText:', error);
      return {
        success: false,
        message: `Error: ${error.message}`
      };
    }
  }
}

export default new DocumentOperations();

