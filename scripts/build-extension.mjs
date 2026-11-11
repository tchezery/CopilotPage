import { cp, mkdir, rm, watch } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { build as viteBuild } from 'vite';

const source = path.resolve('extension');
const output = path.resolve('dist');
const bridgeHost = '127.0.0.1';
const bridgePort = Number(process.env.FELPS_BRIDGE_PORT || 11435);
const ollamaUrl = String(process.env.FELPS_OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/+$/, '');

function startOllamaBridge() {
  const server = createServer(async (request, response) => {
    const origin = request.headers.origin || '';
    if (origin.startsWith('moz-extension://')) {
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Vary', 'Origin');
    }
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (request.method === 'OPTIONS') { response.writeHead(204).end(); return; }

    const allowed = (request.method === 'GET' && request.url === '/api/tags') ||
      (request.method === 'POST' && request.url === '/api/chat');
    if (!allowed) { response.writeHead(404).end('Not found'); return; }

    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of request) {
        size += chunk.length;
        if (size > 1_000_000) throw new Error('Requisição grande demais.');
        chunks.push(chunk);
      }
      const upstream = await fetch(`${ollamaUrl}${request.url}`, {
        method: request.method,
        headers: request.method === 'POST' ? { 'Content-Type': 'application/json' } : {},
        body: request.method === 'POST' ? Buffer.concat(chunks) : undefined,
        signal: AbortSignal.timeout(120000)
      });
      const body = Buffer.from(await upstream.arrayBuffer());
      response.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') || 'application/json' });
      response.end(body);
    } catch (error) {
      response.writeHead(502, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: `Ponte do Felps: ${error?.message || error}` }));
    }
  });
  server.on('error', error => {
    if (error.code === 'EADDRINUSE') console.error(`A porta ${bridgePort} já está em uso. Encerre o npm run dev antigo e tente novamente.`);
    else console.error(error);
  });
  server.listen(bridgePort, bridgeHost, () => console.log(`Felps Ollama bridge at http://${bridgeHost}:${bridgePort} → ${ollamaUrl}`));
}

async function build() {
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await cp(source, output, { recursive: true });
  await viteBuild({
    configFile: false,
    logLevel: 'warn',
    build: {
      emptyOutDir: false,
      outDir: output,
      sourcemap: false,
      lib: {
        entry: path.join(source, 'content-source.js'),
        name: 'FelpsContent',
        formats: ['iife'],
        fileName: () => 'content.js'
      }
    }
  });
  await rm(path.join(output, 'content-source.js'), { force: true });
  console.log(`Firefox extension built at ${output}`);
}

await build();

if (process.argv.includes('--watch')) {
  startOllamaBridge();
  console.log('Watching extension sources…');
  const watcher = watch(source, { recursive: true });
  let queued;
  for await (const event of watcher) {
    clearTimeout(queued);
    queued = setTimeout(() => build().catch(console.error), 80);
  }
}
