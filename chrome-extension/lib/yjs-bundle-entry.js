// Bundle entry point for Y.js and y-websocket
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import * as lib0 from 'lib0';

// Export to global window object for use in extension
window.Y = Y;
window.WebsocketProvider = WebsocketProvider;
window.lib0 = lib0;

