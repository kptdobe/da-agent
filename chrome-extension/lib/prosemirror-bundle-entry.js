// Y.js and collaborative editing
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

// ProseMirror core
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { Schema, DOMParser, DOMSerializer } from 'prosemirror-model';
import { keymap } from 'prosemirror-keymap';
import { history, undo, redo } from 'prosemirror-history';
import { baseKeymap } from 'prosemirror-commands';

// y-prosemirror (binds ProseMirror to Y.js)
import { ySyncPlugin, yCursorPlugin, yUndoPlugin, undo as yUndo, redo as yRedo } from 'y-prosemirror';

// da.live schema (1:1 with the real editor)
import { getSchema } from './schema.js';

// Export Y.js to window (single instance in this bundle)
window.Y = Y;
window.WebsocketProvider = WebsocketProvider;

// Export ProseMirror to window
window.prosemirror = {
  EditorState,
  EditorView,
  Schema,
  DOMParser,
  DOMSerializer,
  getSchema, // Export getSchema function
  keymap,
  history,
  undo,
  redo,
  baseKeymap
};

window.yProsemirror = {
  ySyncPlugin,
  yCursorPlugin,
  yUndoPlugin,
  undo: yUndo,
  redo: yRedo
};

console.log('✅ Complete editor stack loaded (Y.js + ProseMirror + y-prosemirror + da.live schema)');

