import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';

const defaultHost = '127.0.0.1';
const defaultPort = Number(process.env.PORT || 5173);
const defaultRoot = process.cwd();

const types = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

export function getCommunityConfig(env = process.env) {
  if (env.SUPABASE_URL && env.SUPABASE_ANON_KEY) {
    return {
      backend: 'supabase',
      supabaseUrl: env.SUPABASE_URL,
      supabaseAnonKey: env.SUPABASE_ANON_KEY,
    };
  }

  return { backend: 'local' };
}

export function renderCommunityConfigScript(env = process.env) {
  return `window.LIFE_LOGIC_COMMUNITY = ${JSON.stringify(getCommunityConfig(env))};\n`;
}

export function createRequestHandler({
  root = defaultRoot,
  env = process.env,
  host = defaultHost,
  port = defaultPort,
} = {}) {
  return async (request, response) => {
    try {
      const url = new URL(request.url || '/', `http://${host}:${port}`);

      if (
        url.pathname === '/life-runtime.js'
        || url.pathname === '/life-config.js'
        || url.pathname === '/community-config.js'
      ) {
        response.writeHead(200, {
          'cache-control': 'no-store',
          'content-type': types['.js'],
        });
        response.end(renderCommunityConfigScript(env));
        return;
      }

      const cleanPath = normalize(url.pathname).replace(/^(\.\.[/\\])+/, '');
      const filePath = join(root, cleanPath === '/' ? 'index.html' : cleanPath);
      const file = await readFile(filePath);
      const isIndexHtml = filePath.endsWith('index.html');
      const body = isIndexHtml
        ? injectCommunityConfig(file.toString('utf8'), env)
        : file;

      response.writeHead(200, {
        'content-type': types[extname(filePath)] || 'application/octet-stream',
      });
      response.end(body);
    } catch {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
    }
  };
}

export function injectCommunityConfig(html, env = process.env) {
  return html.replace(
    /<script id="life-runtime-config" type="application\/json">[\s\S]*?<\/script>/,
    `<script id="life-runtime-config" type="application/json">${JSON.stringify(getCommunityConfig(env))}</script>`,
  );
}

export function startServer({
  root = defaultRoot,
  env = process.env,
  host = defaultHost,
  port = defaultPort,
} = {}) {
  return createServer(createRequestHandler({ root, env, host, port })).listen(port, host, () => {
    console.log(`Conway explorer running at http://${host}:${port}`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer();
}
