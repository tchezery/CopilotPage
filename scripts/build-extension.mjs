import { cp, mkdir, rm, watch } from 'node:fs/promises';
import path from 'node:path';
import { build as viteBuild } from 'vite';

const source = path.resolve('extension');
const output = path.resolve('dist');

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
  console.log('Watching extension sources…');
  const watcher = watch(source, { recursive: true });
  let queued;
  for await (const event of watcher) {
    clearTimeout(queued);
    queued = setTimeout(() => build().catch(console.error), 80);
  }
}
