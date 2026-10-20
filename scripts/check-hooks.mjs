#!/usr/bin/env node
// Syntax-checks every PocketBase JSVM hook file (pb_hooks/*.pb.js and
// pb_hooks/lib/*.js) with `node --check`. The hooks are plain ES5/ES2015
// scripts, so a syntax error would otherwise only show up when PocketBase
// fails to load them at boot.
import { readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'pocketbase', 'pb_hooks');

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === 'node_modules' ? [] : walk(p);
    return p.endsWith('.js') ? [p] : [];
  });
}

let failed = 0;
const files = walk(root);
for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (err) {
    failed++;
    process.stderr.write(`✗ ${file}\n${err.stderr?.toString() ?? err.message}\n`);
  }
}
console.log(`check:hooks — ${files.length - failed}/${files.length} files OK`);
process.exit(failed ? 1 : 0);
