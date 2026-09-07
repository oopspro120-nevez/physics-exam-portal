// Wrangler bundling applies Cloudflare's Node.js compatibility transforms.
import { execFileSync } from 'node:child_process';
import { cp, mkdir, rm, readFile, writeFile, rename } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await mkdir('dist/server', { recursive: true });
await mkdir('dist/.openai', { recursive: true });
execFileSync(
  process.execPath,
  [
    'node_modules/wrangler/bin/wrangler.js',
    'deploy',
    '--dry-run',
    '--minify',
    '--outdir',
    'dist/server',
  ],
  { stdio: 'inherit' },
);
await rename('dist/server/worker.js', 'dist/server/index.js');
// Production artifacts do not need Wrangler's sourcemap or dry-run instructions.
await rm('dist/server/worker.js.map', { force: true });
await rm('dist/server/README.md', { force: true });
await cp('.open-next/assets', 'dist/client', { recursive: true });
await writeFile('dist/.openai/hosting.json', await readFile('.openai/hosting.json', 'utf8'));
console.log('Worker và tài nguyên đã sẵn sàng trong dist/.');
