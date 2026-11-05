import preact from '@preact/preset-vite';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

const BASE = '/gym-tracker/';

function gitSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'local';
  }
}

function listFiles(dir: string, root = dir): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name.startsWith('.')) return [];
    const p = join(dir, name);
    return statSync(p).isDirectory() ? listFiles(p, root) : [relative(root, p).split('\\').join('/')];
  });
}

/**
 * Emits sw.js with the full list of built files. The cache name contains a hash of every file,
 * so any change produces a new service worker, which the app turns into an "Update available" prompt.
 */
function serviceWorker(): Plugin {
  return {
    name: 'gym-tracker-sw',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const publicFiles = listFiles('public');
      const bundled = Object.keys(bundle).filter((f) => !f.endsWith('.map'));
      const hash = createHash('sha256');
      for (const name of [...bundled].sort()) {
        const item = bundle[name];
        hash.update(name);
        hash.update(item.type === 'chunk' ? item.code : item.source);
      }
      for (const f of [...publicFiles].sort()) {
        hash.update(f);
        hash.update(readFileSync(join('public', f)));
      }
      const version = hash.digest('hex').slice(0, 12);
      const files = Array.from(new Set(['./', ...bundled.map((f) => `./${f}`), ...publicFiles.map((f) => `./${f}`)]));
      const source = readFileSync('sw/sw.template.js', 'utf8').replaceAll('__VERSION__', version).replaceAll('__ASSETS__', JSON.stringify(files));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

const builtAt = new Date();
const pad = (n: number) => String(n).padStart(2, '0');
const APP_VERSION = `${builtAt.getFullYear()}.${pad(builtAt.getMonth() + 1)}.${pad(builtAt.getDate())} ${pad(builtAt.getHours())}:${pad(builtAt.getMinutes())} (${gitSha()})`;

export default defineConfig({
  base: BASE,
  plugins: [preact(), serviceWorker()],
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  build: {
    target: 'safari15',
  },
});
