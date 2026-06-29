import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { readFile } from 'node:fs/promises';

const host = '127.0.0.1';
const port = Number(process.env.PORT || 5173);
const root = process.cwd();

const types = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${host}:${port}`);
    const cleanPath = normalize(url.pathname).replace(/^(\.\.[/\\])+/, '');
    const filePath = join(root, cleanPath === '/' ? 'index.html' : cleanPath);
    const file = await readFile(filePath);

    response.writeHead(200, {
      'content-type': types[extname(filePath)] || 'application/octet-stream',
    });
    response.end(file);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
}).listen(port, host, () => {
  console.log(`Conway explorer running at http://${host}:${port}`);
});
