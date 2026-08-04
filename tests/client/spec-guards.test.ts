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

function loadSpec(file: string): { paths: Record<string, unknown> } {
  return yaml.load(readFileSync(resolve(ROOT, file), 'utf8')) as {
    paths: Record<string, unknown>;
  };
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
  for (const spec of ['openapi.yaml', 'openapi.merged.yaml']) {
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
});
