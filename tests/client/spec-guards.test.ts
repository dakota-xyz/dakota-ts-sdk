/**
 * Guards on the checked-in OpenAPI spec.
 *
 * These exist because a spec sync is a file copy, and a copy can silently
 * reintroduce a bug that was already fixed by hand. Each guard below encodes
 * a deviation the SDK deliberately maintains against the upstream file it
 * syncs from, so a future `cp platform/openapi.public.yaml openapi.yaml`
 * fails loudly here instead of shipping.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, it, expect } from 'vitest';
import * as yaml from 'js-yaml';

const ROOT = resolve(__dirname, '../..');

interface Spec {
  paths: Record<string, unknown>;
  components?: { schemas?: Record<string, unknown> };
}

function loadSpec(file: string): Spec {
  return yaml.load(readFileSync(resolve(ROOT, file), 'utf8')) as Spec;
}

/** Every `#/components/schemas/X` name reachable from `node`, one hop. */
function directRefs(node: unknown, acc: Set<string>): void {
  if (Array.isArray(node)) {
    for (const v of node) directRefs(v, acc);
    return;
  }
  if (node === null || typeof node !== 'object') return;
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (k === '$ref' && typeof v === 'string' && v.startsWith('#/components/schemas/')) {
      acc.add(v.slice('#/components/schemas/'.length));
    } else {
      directRefs(v, acc);
    }
  }
}

/** Transitive closure of schema names reachable from `roots`. */
function refClosure(roots: unknown, schemas: Record<string, unknown>): Set<string> {
  const seen = new Set<string>();
  const queue: string[] = [];
  const seed = new Set<string>();
  directRefs(roots, seed);
  queue.push(...seed);
  while (queue.length > 0) {
    const name = queue.pop() as string;
    if (seen.has(name)) continue;
    seen.add(name);
    const next = new Set<string>();
    directRefs(schemas[name], next);
    for (const n of next) if (!seen.has(n)) queue.push(n);
  }
  return seen;
}

function partitionPaths(spec: Spec): {
  alpha: Record<string, unknown>;
  rest: Record<string, unknown>;
} {
  const alpha: Record<string, unknown> = {};
  const rest: Record<string, unknown> = {};
  for (const [route, def] of Object.entries(spec.paths)) {
    const isAlpha =
      def !== null &&
      typeof def === 'object' &&
      (def as Record<string, unknown>)['x-alpha'] === true;
    (isAlpha ? alpha : rest)[route] = def;
  }
  return { alpha, rest };
}

describe('openapi spec guards', () => {
  /**
   * The agentic policy route takes NO client id: it resolves the client from
   * the API key, and the platform's router registers exactly `/agentic-policy`
   * (see internal/api/oapi/routes.go).
   *
   * The platform's published `openapi.public.yaml` still describes the older
   * `/clients/{client_id}/agentic-policy` shape — it was not regenerated when
   * the route was simplified — and SDK 2.2.0 shipped that stale path, so every
   * `agenticPolicy` call 404'd. Until upstream regenerates, the SDK carries
   * the corrected path by hand, and this guard keeps it corrected.
   */
  // Only the CHECKED-IN specs. `openapi.merged.yaml` is a gitignored build
  // artifact that does not exist on a fresh clone, and it is wholly derived
  // from these two — guarding both covers it.
  for (const spec of ['openapi.yaml', 'openapi.agentic.yaml']) {
    it(`${spec} has /agentic-policy and NOT the client-scoped shape`, () => {
      const { paths } = loadSpec(spec);

      expect(paths['/agentic-policy']).toBeDefined();
      expect(paths['/clients/{client_id}/agentic-policy']).toBeUndefined();
    });
  }

  it('no path in the spec is scoped by a client id', () => {
    // A `client_id` path parameter is the shape that caused the bug: the only
    // legal value is one the server already knows, and a caller has no way to
    // discover it. If a new one appears in a sync, it deserves a second look
    // rather than a silent adoption.
    const { paths } = loadSpec('openapi.yaml');
    const clientScoped = Object.keys(paths).filter((p) => p.includes('{client_id}'));

    expect(clientScoped).toEqual([]);
  });

  /**
   * The insight CHAT operation is removed on purpose (ENG-3153): the agentic
   * beta dropped the conversational surface, and `client.insights.chat()` was
   * deleted with it. The deterministic report `GET /customers/{id}/insights`
   * stays.
   *
   * The platform's `openapi.public.yaml` STILL describes the chat operation —
   * the removal lives on a platform branch that main has not taken — so a
   * wholesale re-sync reintroduces it, and `npm run generate` would then hand
   * the SDK back a type for a method that no longer exists. This guard is the
   * thing that catches that.
   */
  for (const spec of ['openapi.yaml', 'openapi.agentic.yaml']) {
    it(`${spec} does not carry the removed insight chat surface`, () => {
      const { paths, components } = loadSpec(spec);

      expect(paths['/customers/{customer_id}/insights/chat']).toBeUndefined();
      for (const schema of ['InsightChatMessage', 'InsightChatRequest', 'InsightChatResponse']) {
        expect(components?.schemas?.[schema]).toBeUndefined();
      }
    });
  }

  /**
   * The overlay only earns its keep if it is COMPLETE: it exists so the alpha
   * surface survives a sync that strips alpha paths from the base, and an
   * overlay missing one schema those paths reference would generate dangling
   * `$ref`s on exactly the sync it is meant to survive.
   *
   * The allowlist in `scripts/extract-agentic.mjs` is maintained by hand, and
   * it had already drifted ten schemas behind the alpha paths (AgenticBlocker,
   * MandateVersion, DeveloperFee, …) before this guard existed.
   *
   * Only schemas the alpha paths OWN are required. Ones also reachable from a
   * non-alpha path (Address, ProblemDetails, Meta, …) stay in the base on any
   * sync, so duplicating them into the overlay would only add a second copy to
   * keep in step.
   */
  it('the agentic overlay carries every schema its alpha paths own', () => {
    const base = loadSpec('openapi.yaml');
    const overlay = loadSpec('openapi.agentic.yaml');
    const schemas = base.components?.schemas ?? {};
    const { alpha, rest } = partitionPaths(base);

    const sharedWithStable = refClosure(rest, schemas);
    const alphaOnly = [...refClosure(alpha, schemas)].filter((name) => !sharedWithStable.has(name));
    const carried = new Set(Object.keys(overlay.components?.schemas ?? {}));
    const missing = alphaOnly.filter((name) => !carried.has(name)).sort();

    expect(missing).toEqual([]);
  });

  it('the agentic overlay carries every x-alpha path', () => {
    const base = loadSpec('openapi.yaml');
    const overlay = loadSpec('openapi.agentic.yaml');
    const { alpha } = partitionPaths(base);

    const missing = Object.keys(alpha)
      .filter((route) => overlay.paths[route] === undefined)
      .sort();

    expect(missing).toEqual([]);
  });
});
