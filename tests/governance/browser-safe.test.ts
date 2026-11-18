/**
 * `@dakota-xyz/ts-sdk/governance` must bundle for browsers and React Native:
 * passkeys are signed there. So it is bundled here the way a browser app's
 * bundler would (esbuild, platform "browser", nothing external): a `node:`
 * built-in or a package reached by ANY import form (static, side-effect,
 * dynamic, re-export) fails the build, and the files it pulls in are pinned.
 */

import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

import { build } from 'esbuild';
import { describe, it, expect } from 'vitest';

const ROOT = resolve(__dirname, '../..');
const ENTRY = resolve(ROOT, 'src/governance/index.ts');

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

async function bundleForBrowser() {
  return build({
    entryPoints: [ENTRY],
    bundle: true,
    platform: 'browser',
    format: 'esm',
    write: false,
    metafile: true,
    logLevel: 'silent',
  });
}

describe('governance entry point is browser-safe', () => {
  it('bundles for the browser with nothing external', async () => {
    const result = await bundleForBrowser();
    expect(result.errors).toEqual([]);
    const code = result.outputFiles[0]!.text;
    expect(code).not.toMatch(/\bnode:|\brequire\(/);
  });

  it('pulls in only the pure modules it is meant to use', async () => {
    const { metafile } = await bundleForBrowser();
    const inputs = Object.keys(metafile.inputs)
      .map((f) => relative(ROOT, resolve(ROOT, f)))
      .sort();
    expect(inputs).toEqual([
      'src/agentic/canonicalize.ts',
      'src/governance/encoding.ts',
      'src/governance/index.ts',
      'src/governance/intents.ts',
      'src/governance/signer.ts',
      'src/governance/webauthn.ts',
    ]);
  });

  it('uses no Node-only globals', async () => {
    const { metafile } = await bundleForBrowser();
    for (const f of Object.keys(metafile.inputs)) {
      const code = stripComments(readFileSync(resolve(ROOT, f), 'utf8'));
      expect(code, f).not.toMatch(/\b(Buffer|process|require)\b/);
    }
  });
});
