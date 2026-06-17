// ============================================================
// One-shot codemod: console.* -> logger.* across src, injecting the
// logger import where needed. console.log/debug -> logger.debug,
// console.info -> logger.info, warn/error map 1:1.
//
//   node scripts/codemod-logger.mjs
//
// Skips: tests, the logger itself, ad-hoc test scripts, and the user's
// in-progress admin/workflows files (left untouched on purpose).
// ============================================================
import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('src');
const EXTS = new Set(['.ts', '.tsx']);
const SKIP_DIRS = new Set(['__tests__', 'tests']);
const SKIP_FILES = new Set(['logger.ts', 'test-sla-service.ts']);
// Leave the user's WIP workflow editor files alone.
const SKIP_PATH_FRAGMENTS = ['app\\admin\\workflows', 'app/admin/workflows'];

const LEVEL_MAP = { error: 'error', warn: 'warn', log: 'debug', debug: 'debug', info: 'info' };

let totalFiles = 0;
let totalRepl = 0;

function shouldSkip(p, name) {
  if (SKIP_FILES.has(name)) return true;
  if (name.endsWith('.test.ts') || name.endsWith('.spec.ts')) return true;
  if (SKIP_PATH_FRAGMENTS.some(f => p.includes(f))) return true;
  return false;
}

function addImport(src) {
  const importLine = `import { logger } from '@/lib/logger';`;
  const lines = src.split('\n');
  // Insert right after a leading 'use client' / 'use server' directive if present.
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const t = lines[i].trim().replace(/;$/, '');
    if (t === `'use client'` || t === `"use client"` || t === `'use server'` || t === `"use server"`) {
      lines.splice(i + 1, 0, importLine);
      return lines.join('\n');
    }
  }
  // Else before the first existing import.
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*import\s/.test(lines[i])) {
      lines.splice(i, 0, importLine);
      return lines.join('\n');
    }
  }
  lines.unshift(importLine);
  return lines.join('\n');
}

async function processFile(p) {
  let src = await fs.readFile(p, 'utf8');
  let count = 0;
  const next = src.replace(/console\.(error|warn|log|debug|info)\(/g, (_m, lvl) => {
    count++;
    return `logger.${LEVEL_MAP[lvl]}(`;
  });
  if (count === 0) return;
  src = next;
  if (!/from ['"]@\/lib\/logger['"]/.test(src)) {
    src = addImport(src);
  }
  await fs.writeFile(p, src, 'utf8');
  totalFiles++;
  totalRepl += count;
  console.log(`${path.relative(process.cwd(), p)}: ${count}`);
}

async function walk(dir) {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      await walk(p);
    } else {
      if (!EXTS.has(path.extname(e.name))) continue;
      if (shouldSkip(p, e.name)) continue;
      await processFile(p);
    }
  }
}

await walk(ROOT);
console.log(`\nFiles changed: ${totalFiles}, replacements: ${totalRepl}`);
