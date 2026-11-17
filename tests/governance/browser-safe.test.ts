/**
 * `@dakota-xyz/ts-sdk/governance` must bundle for browsers and React Native:
 * passkeys are signed there. So nothing it reaches may import a Node
 * built-in or a package, or use Node-only globals. This walks the real
 * import graph from the entry point, so a future import of, say, the
 * mandate signer (which needs `node:crypto`) fails here.
 */

import { readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

import { describe, it, expect } from 'vitest';

const ROOT = resolve(__dirname, '../..');
const ENTRY = resolve(ROOT, 'src/governance/index.ts');

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function importGraph(entry: string): { files: string[]; external: string[] } {
  const files = new Set<string>();
  const external = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (files.has(file)) continue;
    files.add(file);
    const src = stripComments(readFileSync(file, 'utf8'));
    for (const m of src.matchAll(/(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]/g)) {
      const spec = m[1] as string;
      if (spec.startsWith('.')) {
        queue.push(resolve(dirname(file), spec.replace(/\.js$/, '.ts')));
      } else {
        external.add(spec);
      }
    }
  }
  return { files: [...files].map((f) => relative(ROOT, f)).sort(), external: [...external] };
}

describe('governance entry point is browser-safe', () => {
  const graph = importGraph(ENTRY);

  it('imports nothing outside the SDK source (no node: built-ins, no packages)', () => {
    expect(graph.external).toEqual([]);
  });

  it('stays within the pure modules it is meant to use', () => {
    expect(graph.files).toEqual([
      'src/agentic/canonicalize.ts',
      'src/governance/encoding.ts',
      'src/governance/index.ts',
      'src/governance/intents.ts',
      'src/governance/signer.ts',
      'src/governance/webauthn.ts',
    ]);
  });

  it('uses no Node-only globals', () => {
    for (const f of graph.files) {
      const code = stripComments(readFileSync(resolve(ROOT, f), 'utf8'));
      expect(code, f).not.toMatch(/\b(Buffer|process|require)\b/);
    }
  });
});
