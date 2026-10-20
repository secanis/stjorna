#!/usr/bin/env node
// Syntax-checks every PocketBase JSVM hook file (pb_hooks/*.pb.js and
// pb_hooks/lib/*.js) with `node --check`. The hooks are plain ES5/ES2015
// scripts, so a syntax error would otherwise only show up when PocketBase
// fails to load them at boot.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
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
console.log(`check:hooks — ${files.length - failed}/${files.length} files pass node --check`);

// Every routerAdd() must be in the route registry (lib/routes.js), which
// feeds the OpenAPI spec — and every registry entry must be registered.
const registered = new Set();
const routeRe = /routerAdd\(\s*["'](GET|POST|PUT|PATCH|DELETE)["']\s*,\s*["']([^"']+)["']/g;
for (const file of files.filter((f) => f.endsWith('.pb.js'))) {
  for (const m of readFileSync(file, 'utf8').matchAll(routeRe)) registered.add(`${m[1]} ${m[2]}`);
}
const require = createRequire(import.meta.url);
const { ROUTES } = require(join(root, 'lib', 'routes.js'));
const documented = new Set(ROUTES.map((r) => `${r.method} ${r.path}`));
for (const r of registered) {
  if (!documented.has(r)) {
    failed++;
    process.stderr.write(`✗ ${r} is registered but missing from pb_hooks/lib/routes.js\n`);
  }
}
for (const r of documented) {
  if (!registered.has(r)) {
    failed++;
    process.stderr.write(`✗ ${r} is in pb_hooks/lib/routes.js but no hook registers it\n`);
  }
}
console.log(`check:hooks — ${registered.size} routes registered, ${documented.size} in registry`);
process.exit(failed ? 1 : 0);
