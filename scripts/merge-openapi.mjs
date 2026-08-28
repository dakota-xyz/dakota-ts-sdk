#!/usr/bin/env node
/**
 * Merge SDK-owned overlays onto the base OpenAPI spec.
 *
 * A platform sync can strip pre-release endpoints from `openapi.yaml`
 * (agentic payments today, marked `x-beta`). The SDK still needs those
 * bits so it can generate types for the BETA surface it opts into.
 * Overlays keep that surface owned by the SDK: on `npm run generate`, the base spec
 * (whatever a fresh sync produced) is deep-merged with each overlay, then
 * `openapi-typescript` runs on the merged output.
 *
 * The merge is idempotent — if the base already contains a path/schema
 * the overlay redefines, the overlay wins (so an overlay can also patch
 * an existing definition). Passing `--check` exits non-zero if the base
 * is missing any overlay path or schema, so CI can catch drift.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as yaml from 'js-yaml';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const BASE = resolve(ROOT, 'openapi.yaml');
const OUT = resolve(ROOT, 'openapi.merged.yaml');
const OVERLAYS = [resolve(ROOT, 'openapi.agentic.yaml')];

const args = new Set(process.argv.slice(2));
const check = args.has('--check');

function loadYaml(path) {
  return yaml.load(readFileSync(path, 'utf8'));
}

function mergePaths(base, overlay) {
  base.paths ??= {};
  const overlayPaths = overlay.paths ?? {};
  for (const [route, def] of Object.entries(overlayPaths)) {
    base.paths[route] = def;
  }
  return Object.keys(overlayPaths);
}

function mergeSchemas(base, overlay) {
  base.components ??= {};
  base.components.schemas ??= {};
  const overlaySchemas = overlay.components?.schemas ?? {};
  for (const [name, def] of Object.entries(overlaySchemas)) {
    base.components.schemas[name] = def;
  }
  return Object.keys(overlaySchemas);
}

const base = loadYaml(BASE);
const missing = { paths: [], schemas: [] };

for (const overlayPath of OVERLAYS) {
  if (!existsSync(overlayPath)) {
    console.error(`overlay not found: ${overlayPath}`);
    process.exit(1);
  }
  const overlay = loadYaml(overlayPath);
  if (check) {
    for (const p of Object.keys(overlay.paths ?? {})) {
      if (!base.paths?.[p]) missing.paths.push(p);
    }
    for (const s of Object.keys(overlay.components?.schemas ?? {})) {
      if (!base.components?.schemas?.[s]) missing.schemas.push(s);
    }
  } else {
    mergePaths(base, overlay);
    mergeSchemas(base, overlay);
  }
}

if (check) {
  if (missing.paths.length || missing.schemas.length) {
    console.error('base openapi.yaml is missing overlay content:');
    for (const p of missing.paths) console.error(`  path:   ${p}`);
    for (const s of missing.schemas) console.error(`  schema: ${s}`);
    process.exit(1);
  }
  console.log('overlay check passed');
  process.exit(0);
}

writeFileSync(OUT, yaml.dump(base, { lineWidth: 1000, noRefs: true }));
console.log(`wrote ${OUT}`);
