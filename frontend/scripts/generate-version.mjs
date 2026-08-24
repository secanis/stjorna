#!/usr/bin/env node
// Generate public/version.json at build time so the frontend can show
// the version it shipped with. Resolution order:
//   1. STJORNA_VERSION env var — used by the release workflow
//      (release.yml passes the tag as --build-arg STJORNA_VERSION).
//   2. `git describe --tags --always --dirty` — works in dev / local
//      builds where the source tree is a checkout. Returns
//      "v3.0.0-rc2-3-gabcdef" for a tag, or the short SHA when no
//      tag is reachable, with "-dirty" suffix if the worktree is
//      modified.
//   3. `node -p "require('../package.json').version"` — last-resort
//      fallback (matches the `stjorna-frontend` package version).
//
// The script also writes a `commit` (short SHA) and `buildTime`
// (ISO timestamp). It runs before `vite build` (wired in
// package.json `scripts.build`).

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const outPath = resolve(projectRoot, 'public', 'version.json');

function git(cmd, fallback) {
    try {
        return execFileSync('git', cmd, { cwd: projectRoot, encoding: 'utf8' }).trim() || fallback;
    } catch {
        return fallback;
    }
}

function pkgVersion() {
    try {
        const pkg = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8'));
        return pkg.version || '0.0.0-dev';
    } catch {
        return '0.0.0-dev';
    }
}

// STJORNA_VERSION typically has the form "v3.0.0-rc2" (with leading v).
// We strip it for display so the UI shows "3.0.0-rc2" not "v3.0.0-rc2".
function normalizeVersion(v) {
    if (!v) return v;
    // git describe output like "v3.0.0-rc2-3-gabcdef" or "v3.0.0-rc2-dirty"
    // → keep as-is, the leading "v" + dashes read fine in the About page.
    return v;
}

const version = normalizeVersion(process.env.STJORNA_VERSION || git(['describe', '--tags', '--always', '--dirty'], null) || pkgVersion());

const commit = process.env.STJORNA_COMMIT || git(['rev-parse', '--short', 'HEAD'], 'unknown');

const buildTime = new Date().toISOString();

// Pretty-print for human inspection on the deployed site
// (visit /version.json directly).
const payload = {
    version,
    commit,
    buildTime,
};

// Always overwrite — stale version.json is worse than missing.
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(payload, null, 2) + '\n');

// eslint-disable-next-line no-console
console.log(`[generate-version] wrote ${outPath} → ${JSON.stringify(payload)}`);
