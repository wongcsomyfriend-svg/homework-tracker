import { copyFile } from 'node:fs/promises'

// GitHub Pages has no SPA rewrite rule, so a deep link like /spike would 404.
// Serving the same document as 404.html lets the client router take over.
await copyFile('dist/index.html', 'dist/404.html')
console.log('created dist/404.html')
