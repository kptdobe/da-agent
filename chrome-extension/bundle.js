import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure lib directory exists
const libDir = path.join(__dirname, 'lib');
if (!fs.existsSync(libDir)) {
  fs.mkdirSync(libDir, { recursive: true });
}

// Bundle Y.js and y-websocket (for awareness-only connections)
console.log('📦 Bundling Y.js + y-websocket...');
esbuild.buildSync({
  entryPoints: [path.join(__dirname, 'lib', 'yjs-bundle-entry.js')],
  bundle: true,
  format: 'iife',
  outfile: path.join(__dirname, 'lib', 'yjs-bundle.js'),
  globalName: 'YjsBundle',
});
console.log('✅ Y.js bundle created');

// Bundle EVERYTHING together: Y.js + ProseMirror + y-prosemirror
// This ensures a single Y.js instance (no constructor conflicts)
console.log('📦 Bundling complete editor stack...');
esbuild.buildSync({
  entryPoints: [path.join(__dirname, 'lib', 'prosemirror-bundle-entry.js')],
  bundle: true,
  format: 'iife',
  outfile: path.join(__dirname, 'lib', 'prosemirror-bundle.js'),
  globalName: 'ProseMirrorBundle',
  define: {
    'global': 'window',
  },
});
console.log('✅ Complete editor bundle created (single Y.js instance)');

console.log('🎉 All bundles created successfully!');
console.log('⚠️  Note: Y.js is in BOTH bundles - this is intentional:');
console.log('   - yjs-bundle.js: For sidepanel awareness-only connections');
console.log('   - prosemirror-bundle.js: Complete editor with Y.js (single instance)');

