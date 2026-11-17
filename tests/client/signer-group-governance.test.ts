/**
 * Signed signer-group changes: the helpers read the group's version, build
 * the intent, sign it, and send the request with the SAME idempotency key in
 * the intent and the header. Governance refusals surface as typed errors.
 */

import { describe, it, expect, vi } from 'vitest';

import { DakotaClient } from '../../src/client/client.js';
import {
  APIError,
  BelowThresholdError,
  EndorsementRequiredError,
  InsufficientEndorsementsError,
  InvalidGoverningGroupError,
  StaleSignerGroupVersionError,
} from '../../src/client/errors.js';
import { createRoutedFetch, type RecordedRequest } from '../agentic/helpers.js';

const GROUP = '3MF5pRlAIRFYkOAd3TstqUKMOpp';
const KEY_X = 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEMbuCXgirK7R0SD7rp7e/YLTY';
const KEY_Y = 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEyrrHNsQMwUxGIWthOdpPCAwR';
const LOWER_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function makeClient(fetchImpl: unknown) {
  return new DakotaClient({
    apiKey: 'test',
    baseURL: 'http://localhost',
    fetch: fetchImpl as typeof fetch,
    retryPolicy: { maxAttempts: 1, initialBackoffMs: 1, maxBackoffMs: 1 },
  });
}

function group(version: number) {
  return { id: GROUP, client_id: 'c', name: 'g', members: [], version };
}

/** A fake signer that records the exact bytes it was asked to sign. */
function recordingSigner(label: string) {
  const seen: Array<Record<string, unknown>> = [];
  const raw: string[] = [];
  return {
    seen,
    raw,
    sign(payload: Uint8Array) {
      const text = new TextDecoder().decode(payload);
      raw.push(text);
      seen.push(JSON.parse(text));
      return `${label}-sig-${seen.length}`;
    },
  };
}

function problem(status: number, code: string, detail: string) {
  return {
    status,
    body: {
      type: `https://docs.dakota.xyz/api-reference/errors#${code.replace(/_/g, '-')}`,
      title: 'Refused',
      status,
      detail,
      reason: code,
      code,
      request_id: 'req_1',
    },
  };
}

const header = (r: RecordedRequest | undefined) => r?.headers['x-idempotency-key'];

describe('signerGroups signed changes', () => {
  it('addSignerSigned reads the version and sends one key in intent and header', async () => {
    const { fetch, requests } = createRoutedFetch({
      [`GET /signer-groups/${GROUP}`]: () => ({ status: 200, body: group(4) }),
      [`POST /signer-groups/${GROUP}/signers`]: () => ({ status: 200, body: group(5) }),
    });
    const a = recordingSigner('a');
    const b = recordingSigner('b');

    const updated = await makeClient(fetch).signerGroups.addSignerSigned(GROUP, KEY_X, [a, b]);

    expect(updated.version).toBe(5);
    const post = requests[1];
    expect(post?.method).toBe('POST');
    expect(header(post)).toMatch(LOWER_UUID);
    expect(post?.body).toEqual({
      member_key: KEY_X,
      signer_group_version: 4,
      signatures: ['a-sig-1', 'b-sig-1'],
    });
    expect(a.seen[0]).toEqual({
      type: 'add_signers_to_group',
      signer_group_id: GROUP,
      new_member_keys: [KEY_X],
      signer_group_version: 4,
      idempotency_key: header(post),
    });
    expect(b.seen[0]).toEqual(a.seen[0]);
    // The exact bytes, not just an equal object: sorted keys, no whitespace.
    expect(a.raw[0]).toBe(
      `{"idempotency_key":"${header(post)}","new_member_keys":["${KEY_X}"],"signer_group_id":"${GROUP}","signer_group_version":4,"type":"add_signers_to_group"}`
    );
  });

  it('removeSignersSigned posts signer-removals with members in the order given', async () => {
    const { fetch, requests } = createRoutedFetch({
      [`GET /signer-groups/${GROUP}`]: () => ({ status: 200, body: group(0) }),
      [`POST /signer-groups/${GROUP}/signer-removals`]: () => ({ status: 200, body: group(1) }),
    });
    const s = recordingSigner('s');

    await makeClient(fetch).signerGroups.removeSignersSigned(GROUP, [KEY_Y, KEY_X], [s]);

    const post = requests[1];
    expect(post?.path).toBe(`/signer-groups/${GROUP}/signer-removals`);
    expect(post?.body).toEqual({
      members_to_remove: [KEY_Y, KEY_X],
      signer_group_version: 0,
      signatures: ['s-sig-1'],
    });
    expect(s.raw[0]).toBe(
      `{"group_id":"${GROUP}","idempotency_key":"${header(post)}","members_to_remove":["${KEY_Y}","${KEY_X}"],"signer_group_version":0,"type":"remove_signers_from_group"}`
    );
  });

  it('updateGovernanceSigned PATCHes the whole state and omits cleared settings', async () => {
    const { fetch, requests } = createRoutedFetch({
      [`GET /signer-groups/${GROUP}`]: () => ({ status: 200, body: group(3) }),
      [`PATCH /signer-groups/${GROUP}/governance`]: () => ({ status: 200, body: group(4) }),
    });
    const s = recordingSigner('s');

    await makeClient(fetch).signerGroups.updateGovernanceSigned(
      GROUP,
      { governance_threshold: 2, governance_signer_group_id: null },
      [s]
    );

    const patch = requests[1];
    expect(patch?.method).toBe('PATCH');
    expect(header(patch)).toMatch(LOWER_UUID);
    expect(patch?.body).toEqual({
      governance_threshold: 2,
      signer_group_version: 3,
      signatures: ['s-sig-1'],
    });
    expect(s.raw[0]).toBe(
      `{"governance_threshold":2,"idempotency_key":"${header(patch)}","signer_group_id":"${GROUP}","signer_group_version":3,"type":"update_signer_group_governance"}`
    );
  });

  it('prepare + submit works across a JSON round trip (server -> browser -> server)', async () => {
    const { fetch, requests } = createRoutedFetch({
      [`POST /signer-groups/${GROUP}/signers`]: () => ({ status: 200, body: group(8) }),
    });
    const client = makeClient(fetch);
    const key = '047caa77-8cec-4e96-994c-a12b655231de';

    // An explicit version skips the read.
    const change = await client.signerGroups.prepareAddSigner(GROUP, KEY_X, {
      signerGroupVersion: 7,
      idempotencyKey: key,
    });
    expect(requests).toHaveLength(0);
    expect(change.canonical).toBe(
      `{"idempotency_key":"${key}","new_member_keys":["${KEY_X}"],"signer_group_id":"${GROUP}","signer_group_version":7,"type":"add_signers_to_group"}`
    );

    const stored = JSON.parse(JSON.stringify(change));
    await client.signerGroups.submitSignedChange(stored, ['passkey-assertion']);

    expect(header(requests[0])).toBe(key);
    expect(requests[0]?.body).toEqual({
      member_key: KEY_X,
      signer_group_version: 7,
      signatures: ['passkey-assertion'],
    });
  });

  it('refuses to submit a change whose fields no longer match what was signed', async () => {
    const { fetch, requests } = createRoutedFetch({});
    const client = makeClient(fetch);
    const change = await client.signerGroups.prepareRemoveSigners(GROUP, [KEY_X], {
      signerGroupVersion: 2,
    });

    await expect(
      client.signerGroups.submitSignedChange({ ...change, memberKeys: [KEY_Y] }, ['sig'])
    ).rejects.toThrow(/does not match/);
    await expect(client.signerGroups.submitSignedChange(change, [])).rejects.toThrow(/signature/);
    expect(requests).toHaveLength(0);
  });

  it('refuses a caller idempotency key that is not a lowercase UUID', async () => {
    const { fetch } = createRoutedFetch({});
    await expect(
      makeClient(fetch).signerGroups.prepareAddSigner(GROUP, KEY_X, {
        signerGroupVersion: 0,
        idempotencyKey: '047CAA77-8CEC-4E96-994C-A12B655231DE',
      })
    ).rejects.toThrow(/lowercase UUID/);
  });

  it('refuses to sign when the group carries no version', async () => {
    const { fetch } = createRoutedFetch({
      [`GET /signer-groups/${GROUP}`]: () => ({
        status: 200,
        body: { id: GROUP, client_id: 'c', name: 'g', members: [] },
      }),
    });
    await expect(
      makeClient(fetch).signerGroups.addSignerSigned(GROUP, KEY_X, [recordingSigner('a')])
    ).rejects.toThrow(/version/);
  });

  it('does not re-sign a stale change by default', async () => {
    const { fetch, requests } = createRoutedFetch({
      [`GET /signer-groups/${GROUP}`]: () => ({ status: 200, body: group(0) }),
      [`POST /signer-groups/${GROUP}/signers`]: () =>
        problem(
          409,
          'stale_signer_group_version',
          'The signer group changed since the signatures were made.'
        ),
    });
    const s = recordingSigner('s');

    const err = await makeClient(fetch)
      .signerGroups.addSignerSigned(GROUP, KEY_X, [s])
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(StaleSignerGroupVersionError);
    expect(err).toBeInstanceOf(APIError);
    expect(s.seen).toHaveLength(1);
    expect(requests).toHaveLength(2);
  });

  it('with staleRetries, re-reads the version and re-signs under a fresh key', async () => {
    let posts = 0;
    let version = 0;
    const { fetch, requests } = createRoutedFetch({
      [`GET /signer-groups/${GROUP}`]: () => ({ status: 200, body: group(version) }),
      [`POST /signer-groups/${GROUP}/signer-removals`]: () => {
        posts++;
        if (posts === 1) {
          version = 1; // someone else changed the group meanwhile
          return problem(409, 'stale_signer_group_version', 'stale');
        }
        return { status: 200, body: group(2) };
      },
    });
    const s = recordingSigner('s');

    const updated = await makeClient(fetch).signerGroups.removeSignersSigned(GROUP, [KEY_X], [s], {
      staleRetries: 1,
    });

    expect(updated.version).toBe(2);
    expect(s.seen.map((i) => i.signer_group_version)).toEqual([0, 1]);
    const postReqs = requests.filter((r) => r.method === 'POST');
    expect(header(postReqs[0])).not.toBe(header(postReqs[1]));
    expect(s.seen[1]?.idempotency_key).toBe(header(postReqs[1]));
  });

  it('refuses staleRetries combined with a caller-fixed version or key', async () => {
    const { fetch, requests } = createRoutedFetch({});
    const sg = makeClient(fetch).signerGroups;
    const s = recordingSigner('s');
    await expect(
      sg.addSignerSigned(GROUP, KEY_X, [s], { signerGroupVersion: 3, staleRetries: 1 })
    ).rejects.toThrow(/staleRetries/);
    await expect(
      sg.addSignerSigned(GROUP, KEY_X, [s], {
        idempotencyKey: '047caa77-8cec-4e96-994c-a12b655231de',
        staleRetries: 1,
      })
    ).rejects.toThrow(/staleRetries/);
    expect(requests).toHaveLength(0);
    expect(s.seen).toHaveLength(0);
  });

  it('refuses a staleRetries that is negative, fractional, infinite or above 5', async () => {
    const { fetch, requests } = createRoutedFetch({});
    const sg = makeClient(fetch).signerGroups;
    for (const n of [-1, 1.5, Infinity, NaN, 6]) {
      await expect(
        sg.removeSignersSigned(GROUP, [KEY_X], [recordingSigner('s')], { staleRetries: n })
      ).rejects.toThrow(/staleRetries/);
    }
    expect(requests).toHaveLength(0);
  });

  it('refuses staleRetries on a governance update (a re-sign could undo a concurrent change)', async () => {
    const { fetch, requests } = createRoutedFetch({});
    await expect(
      makeClient(fetch).signerGroups.updateGovernanceSigned(
        GROUP,
        { governance_threshold: 2 },
        [recordingSigner('s')],
        { staleRetries: 1 }
      )
    ).rejects.toThrow(/staleRetries/);
    expect(requests).toHaveLength(0);
  });

  it('gives up after staleRetries + 1 attempts', async () => {
    const { fetch, requests } = createRoutedFetch({
      [`GET /signer-groups/${GROUP}`]: () => ({ status: 200, body: group(0) }),
      [`POST /signer-groups/${GROUP}/signers`]: () =>
        problem(409, 'stale_signer_group_version', 'stale'),
    });
    const s = recordingSigner('s');
    await expect(
      makeClient(fetch).signerGroups.addSignerSigned(GROUP, KEY_X, [s], { staleRetries: 2 })
    ).rejects.toBeInstanceOf(StaleSignerGroupVersionError);
    expect(requests.filter((r) => r.method === 'POST')).toHaveLength(3);
    expect(s.seen).toHaveLength(3);
  });

  it('does not retry a governance refusal other than a stale version', async () => {
    const { fetch, requests } = createRoutedFetch({
      [`GET /signer-groups/${GROUP}`]: () => ({ status: 200, body: group(0) }),
      [`POST /signer-groups/${GROUP}/signers`]: () =>
        problem(403, 'insufficient_endorsements', 'insufficient endorsements: have 1, need 2'),
    });
    const s = recordingSigner('s');
    await expect(
      makeClient(fetch).signerGroups.addSignerSigned(GROUP, KEY_X, [s], { staleRetries: 3 })
    ).rejects.toBeInstanceOf(InsufficientEndorsementsError);
    expect(requests.filter((r) => r.method === 'POST')).toHaveLength(1);
  });

  it('an explicit version of 0 skips the read', async () => {
    const { fetch, requests } = createRoutedFetch({
      [`POST /signer-groups/${GROUP}/signers`]: () => ({ status: 200, body: group(1) }),
    });
    await makeClient(fetch).signerGroups.addSignerSigned(GROUP, KEY_X, [recordingSigner('s')], {
      signerGroupVersion: 0,
    });
    expect(requests.map((r) => r.method)).toEqual(['POST']);
  });

  it('works without a global crypto (Node 18), drawing the key from node:crypto', async () => {
    vi.stubGlobal('crypto', undefined);
    try {
      const { fetch, requests } = createRoutedFetch({
        [`GET /signer-groups/${GROUP}`]: () => ({ status: 200, body: group(0) }),
        [`POST /signer-groups/${GROUP}/signers`]: () => ({ status: 200, body: group(1) }),
      });
      const s = recordingSigner('s');
      await makeClient(fetch).signerGroups.addSignerSigned(GROUP, KEY_X, [s]);
      expect(header(requests[1])).toMatch(LOWER_UUID);
      expect(s.seen[0]?.idempotency_key).toBe(header(requests[1]));
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('sends only the signed fields, whatever else a stored change carries', async () => {
    const { fetch, requests } = createRoutedFetch({
      [`PATCH /signer-groups/${GROUP}/governance`]: () => ({ status: 200, body: group(4) }),
    });
    const sg = makeClient(fetch).signerGroups;
    const change = await sg.prepareGovernanceUpdate(
      GROUP,
      { governance_threshold: 2 },
      { signerGroupVersion: 3 }
    );
    const tampered = {
      ...change,
      governance: { ...change.governance, governance_signer_group_id: null, rogue: 'x' },
    } as unknown as typeof change;

    await sg.submitSignedChange(tampered, ['sig']);

    expect(requests[0]?.body).toEqual({
      governance_threshold: 2,
      signer_group_version: 3,
      signatures: ['sig'],
    });
  });

  it('low-level removeSigners and updateGovernance send the body as given', async () => {
    const { fetch, requests } = createRoutedFetch({
      [`POST /signer-groups/${GROUP}/signer-removals`]: () => ({ status: 200, body: group(1) }),
      [`PATCH /signer-groups/${GROUP}/governance`]: () => ({ status: 200, body: group(2) }),
    });
    const client = makeClient(fetch);
    const key = '11111111-1111-4111-8111-111111111111';
    const body = { members_to_remove: [KEY_X], signer_group_version: 0, signatures: ['x'] };

    await client.signerGroups.removeSigners(GROUP, body, { idempotencyKey: key });
    await client.signerGroups.updateGovernance(
      GROUP,
      { signer_group_version: 1, signatures: ['y'] },
      { idempotencyKey: key }
    );

    expect(requests[0]?.body).toEqual(body);
    expect(header(requests[0])).toBe(key);
    expect(requests[1]?.body).toEqual({ signer_group_version: 1, signatures: ['y'] });
  });

  it('a signed low-level call must name the idempotency key that was signed', async () => {
    const { fetch, requests } = createRoutedFetch({});
    const sg = makeClient(fetch).signerGroups;
    const signed = { signer_group_version: 0, signatures: ['x'] };
    await expect(
      sg.removeSigners(GROUP, { ...signed, members_to_remove: [KEY_X] })
    ).rejects.toThrow(/idempotencyKey/);
    await expect(sg.updateGovernance(GROUP, signed)).rejects.toThrow(/idempotencyKey/);
    await expect(sg.addSigner(GROUP, { ...signed, member_key: KEY_X })).rejects.toThrow(
      /idempotencyKey/
    );
    expect(requests).toHaveLength(0);
  });
});

describe('governance errors are typed', () => {
  async function fail(status: number, code: string, detail = 'refused') {
    const { fetch } = createRoutedFetch({
      [`POST /signer-groups/${GROUP}/signers`]: () => problem(status, code, detail),
    });
    return makeClient(fetch)
      .signerGroups.addSigner(GROUP, { member_key: KEY_X })
      .then(
        () => {
          throw new Error('expected a refusal');
        },
        (e: unknown) => e as APIError
      );
  }

  it('maps each governance code to its class, still an APIError', async () => {
    const cases: Array<[number, string, new (...a: never[]) => APIError]> = [
      [400, 'endorsement_required', EndorsementRequiredError],
      [403, 'insufficient_endorsements', InsufficientEndorsementsError],
      [409, 'stale_signer_group_version', StaleSignerGroupVersionError],
      [422, 'below_threshold', BelowThresholdError],
      [409, 'invalid_governing_group', InvalidGoverningGroupError],
    ];
    for (const [status, code, cls] of cases) {
      const err = await fail(status, code);
      expect(err).toBeInstanceOf(cls);
      expect(err).toBeInstanceOf(APIError);
      expect(err.code).toBe(code);
      expect(err.statusCode).toBe(status);
      expect(err.name).toBe(cls.name);
    }
  });

  it('insufficient_endorsements carries how many signatures counted and are needed', async () => {
    const err = (await fail(
      403,
      'insufficient_endorsements',
      'insufficient endorsements: have 1, need 2'
    )) as InsufficientEndorsementsError;
    expect(err.have).toBe(1);
    expect(err.need).toBe(2);
  });

  it('maps from the problem type when the body has no code', async () => {
    const { fetch } = createRoutedFetch({
      [`POST /signer-groups/${GROUP}/signers`]: () => ({
        status: 409,
        body: {
          type: 'https://docs.dakota.xyz/api-reference/errors#stale-signer-group-version',
          title: 'Stale Signer Group Version',
          status: 409,
        },
      }),
    });
    const err = await makeClient(fetch)
      .signerGroups.addSigner(GROUP, { member_key: KEY_X })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(StaleSignerGroupVersionError);
  });

  it('a non-string or prototype-named code stays a plain APIError', async () => {
    for (const code of [42, 'toString', 'constructor', '__proto__', 'hasOwnProperty']) {
      const { fetch } = createRoutedFetch({
        [`POST /signer-groups/${GROUP}/signers`]: () => ({
          status: 400,
          body: { title: 'Bad', status: 400, code },
        }),
      });
      const err = await makeClient(fetch)
        .signerGroups.addSigner(GROUP, { member_key: KEY_X })
        .catch((e: unknown) => e);
      expect(err, String(code)).toBeInstanceOf(APIError);
      expect((err as APIError).constructor, String(code)).toBe(APIError);
      expect((err as APIError).statusCode).toBe(400);
    }
  });

  it('leaves other errors as plain APIError', async () => {
    const err = await fail(404, 'not_found');
    expect(err.constructor).toBe(APIError);
  });
});
