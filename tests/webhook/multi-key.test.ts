/**
 * Multi-key webhook verification (ENG-6686): the `X-Dakota-Webhook-Signatures`
 * list header, the `X-Webhook-Signature` fallback and trusting several Dakota
 * public keys through a signing-key rotation.
 *
 * The parsing rules come from docs.dakota.xyz "Verifying a Delivery" and
 * "Key Rotation", and match platform's signer
 * (`internal/security/webhook_signer.go`) and the Go SDK.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import * as ed25519 from '@noble/ed25519';

// Count signature checks: each trusted key must be checked at most once.
vi.mock('@noble/ed25519', async (importOriginal) => {
  const original = await importOriginal<typeof import('@noble/ed25519')>();
  return { ...original, verifyAsync: vi.fn(original.verifyAsync), verify: vi.fn(original.verify) };
});
const verifyAsyncCalls = ed25519.verifyAsync as unknown as ReturnType<typeof vi.fn>;

import {
  WebhookHandler,
  type WebhookHandlerConfig,
  type MultiKeyWebhookHandlerConfig,
  SignatureVerificationError,
  SIGNATURES_HEADER,
  keyId,
  parsePublicKeys,
  verifyWebhookSignatures,
  verifyWebhookSignaturesSync,
} from '../../src/webhook/index.js';

// --- keys -----------------------------------------------------------------

function seed(byte: number): Uint8Array {
  return new Uint8Array(32).fill(byte);
}

function hex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

const oldPrivate = seed(0x11);
const newPrivate = seed(0x22);
const strangerPrivate = seed(0x33);
const oldKey = hex(ed25519.getPublicKey(oldPrivate));
const newKey = hex(ed25519.getPublicKey(newPrivate));
const strangerKey = hex(ed25519.getPublicKey(strangerPrivate));

// Platform's golden vector, internal/security/webhook_signer_rotation_test.go
// (platform main 23f11c5).
const GOLDEN = {
  publicKey: '79b5562e8fe654f94078b112e8a98ba7901f853ae695bed7e0e3910bad049664',
  keyId: '79b5562e',
  timestamp: '1795430000',
  body: '{"id":"evt_golden"}',
  signature:
    'kIhEmnAagqhecIiFrM89I6C2n8J4m6VS8GI8Rf7R1EROAtsC1clJef+0BE9nTNwzB3OmR8wkVpBqGcEcpXZuAA==',
};

// --- signing helpers ------------------------------------------------------

const BODY = '{"id":"evt_rotation","type":"customer.created","data":{"object":{}},"created":1}';

function now(): string {
  return Math.floor(Date.now() / 1000).toString();
}

async function sign(privateKey: Uint8Array, timestamp: string, body: string): Promise<string> {
  const message = new TextEncoder().encode(`${timestamp}${body}`);
  return Buffer.from(await ed25519.signAsync(message, privateKey)).toString('base64');
}

async function entry(privateKey: Uint8Array, timestamp: string, body = BODY): Promise<string> {
  return `${keyId(hex(ed25519.getPublicKey(privateKey)))}:${await sign(privateKey, timestamp, body)}`;
}

/** Headers as platform sends them: legacy = primary key, list = every key, primary first. */
async function platformHeaders(
  signingKeys: Uint8Array[],
  timestamp = now(),
  body = BODY
): Promise<Record<string, string>> {
  const entries = await Promise.all(signingKeys.map((k) => entry(k, timestamp, body)));
  return {
    'x-webhook-timestamp': timestamp,
    'x-webhook-signature': await sign(signingKeys[0]!, timestamp, body),
    'x-dakota-webhook-signatures': entries.join(', '),
  };
}

async function expectAccepted(p: Promise<unknown>): Promise<void> {
  await expect(p).resolves.not.toThrow();
}

async function expectRejected(p: Promise<unknown>): Promise<void> {
  await expect(p).rejects.toThrow(SignatureVerificationError);
}

afterEach(() => {
  vi.useRealTimers();
});

// --- keyId / parsePublicKeys ----------------------------------------------

describe('keyId', () => {
  it('is the first 8 hex characters of the public key, in lowercase', () => {
    expect(keyId(GOLDEN.publicKey)).toBe(GOLDEN.keyId);
    expect(keyId(GOLDEN.publicKey.toUpperCase())).toBe(GOLDEN.keyId);
    expect(keyId(Buffer.from(GOLDEN.publicKey, 'hex'))).toBe(GOLDEN.keyId);
  });
});

describe('parsePublicKeys', () => {
  it('reads a comma-separated list, trimming spaces and empty items', () => {
    const keys = parsePublicKeys(` ${oldKey} ,, ${newKey.toUpperCase()} , `);
    expect(keys.map(hex)).toEqual([oldKey, newKey]);
  });

  it('accepts several arguments and arrays, and keeps a repeated key once', () => {
    const keys = parsePublicKeys(oldKey, [newKey, oldKey], `${newKey}`);
    expect(keys.map(hex)).toEqual([oldKey, newKey]);
  });

  it('refuses an empty list', () => {
    expect(() => parsePublicKeys('')).toThrow(SignatureVerificationError);
    expect(() => parsePublicKeys(' , ')).toThrow(SignatureVerificationError);
    expect(() => parsePublicKeys([])).toThrow(SignatureVerificationError);
    // An unset environment variable
    expect(() => parsePublicKeys(undefined)).toThrow('At least one webhook public key is required');
    expect(() => parsePublicKeys(null)).toThrow(SignatureVerificationError);
  });

  it('refuses non-string keys with SignatureVerificationError', () => {
    expect(() => parsePublicKeys(42 as never)).toThrow(SignatureVerificationError);
    expect(() => parsePublicKeys([oldKey, 42] as never)).toThrow(SignatureVerificationError);
  });

  it('refuses a malformed key and names its position, never its value', () => {
    const secretLooking = 'ab'.repeat(64); // a 64-byte private key pasted by mistake
    const call = () => parsePublicKeys(`${oldKey},${secretLooking}`);
    expect(call).toThrow(SignatureVerificationError);
    expect(call).toThrow(/public key 2 is not/);
    expect(call).not.toThrow(/abab/);

    expect(() => parsePublicKeys('zz'.repeat(32))).toThrow(SignatureVerificationError);
    expect(() => parsePublicKeys(oldKey.slice(2))).toThrow(SignatureVerificationError);
  });
});

// --- verifyWebhookSignatures: parsing rules --------------------------------

describe('verifyWebhookSignatures', () => {
  it('accepts the golden vector through the list header', async () => {
    vi.useFakeTimers({ now: Number(GOLDEN.timestamp) * 1000, toFake: ['Date'] });
    await expectAccepted(
      verifyWebhookSignatures(
        GOLDEN.body,
        { timestamp: GOLDEN.timestamp, signatures: `${GOLDEN.keyId}:${GOLDEN.signature}` },
        [GOLDEN.publicKey]
      )
    );
    expect(() =>
      verifyWebhookSignaturesSync(
        GOLDEN.body,
        {
          timestamp: GOLDEN.timestamp,
          signatures: `${GOLDEN.keyId.toUpperCase()}:${GOLDEN.signature}`,
        },
        GOLDEN.publicKey
      )
    ).not.toThrow();
  });

  it('accepts the golden vector through the legacy header', async () => {
    vi.useFakeTimers({ now: Number(GOLDEN.timestamp) * 1000, toFake: ['Date'] });
    await expectAccepted(
      verifyWebhookSignatures(
        GOLDEN.body,
        { timestamp: GOLDEN.timestamp, signature: GOLDEN.signature },
        GOLDEN.publicKey
      )
    );
  });

  it('rejects the golden vector with a tampered body or another timestamp', async () => {
    vi.useFakeTimers({ now: Number(GOLDEN.timestamp) * 1000, toFake: ['Date'] });
    const signatures = `${GOLDEN.keyId}:${GOLDEN.signature}`;
    await expectRejected(
      verifyWebhookSignatures(
        '{"id":"evt_golden2"}',
        { timestamp: GOLDEN.timestamp, signatures },
        GOLDEN.publicKey
      )
    );
    await expectRejected(
      verifyWebhookSignatures(
        GOLDEN.body,
        { timestamp: '1795430001', signatures },
        GOLDEN.publicKey
      )
    );
  });

  it('rejects a stale timestamp before looking at signatures (tolerance unchanged)', async () => {
    // The golden vector is real, but the clock is 12 hours past it.
    vi.useFakeTimers({ now: (Number(GOLDEN.timestamp) + 12 * 3600) * 1000, toFake: ['Date'] });
    await expect(
      verifyWebhookSignatures(
        GOLDEN.body,
        { timestamp: GOLDEN.timestamp, signatures: `${GOLDEN.keyId}:${GOLDEN.signature}` },
        GOLDEN.publicKey
      )
    ).rejects.toThrow('Timestamp expired');
  });

  it('does not rely on order or spacing, and compares key ids in lowercase', async () => {
    const ts = now();
    const a = await entry(oldPrivate, ts);
    const b = await entry(newPrivate, ts);
    const upper = b.replace(/^[0-9a-f]{8}/, (id) => id.toUpperCase());
    for (const signatures of [`${b},${a}`, `  ${a} ,   ${b}  `, upper, `${upper},${a}`]) {
      await expectAccepted(verifyWebhookSignatures(BODY, { timestamp: ts, signatures }, [newKey]));
    }
  });

  it('skips entries whose key id is not trusted', async () => {
    const ts = now();
    const stranger = await entry(strangerPrivate, ts);
    const trusted = await entry(oldPrivate, ts);
    await expectRejected(
      verifyWebhookSignatures(BODY, { timestamp: ts, signatures: stranger }, oldKey)
    );
    await expectAccepted(
      verifyWebhookSignatures(
        BODY,
        { timestamp: ts, signatures: `${stranger}, ${trusted}` },
        oldKey
      )
    );
  });

  it('rejects a trusted signature filed under another key id', async () => {
    const ts = now();
    const sig = await sign(oldPrivate, ts, BODY);
    await expectRejected(
      verifyWebhookSignatures(BODY, { timestamp: ts, signatures: `${keyId(newKey)}:${sig}` }, [
        oldKey,
        newKey,
      ])
    );
  });

  it('checks each trusted key at most once: a bad first entry for a key hides a good second one', async () => {
    const ts = now();
    const good = await entry(oldPrivate, ts);
    const bad = `${keyId(oldKey)}:${await sign(oldPrivate, ts, '{"other":true}')}`;
    await expectRejected(
      verifyWebhookSignatures(BODY, { timestamp: ts, signatures: `${bad}, ${good}` }, oldKey)
    );
    // The same good entry first is accepted.
    await expectAccepted(
      verifyWebhookSignatures(BODY, { timestamp: ts, signatures: `${good}, ${bad}` }, oldKey)
    );
  });

  it('costs at most one check per trusted key, however many entries repeat it', async () => {
    const ts = now();
    const bad = `${keyId(oldKey)}:${await sign(oldPrivate, ts, '{"other":true}')}`;
    const good = await entry(oldPrivate, ts);
    const padded = [...Array(5000).fill(bad), good].join(', ');
    verifyAsyncCalls.mockClear();
    await expectRejected(
      verifyWebhookSignatures(BODY, { timestamp: ts, signatures: padded }, oldKey)
    );
    expect(verifyAsyncCalls).toHaveBeenCalledTimes(1);
  });

  it('checks every trusted key that shares an 8-hex key id', async () => {
    const ts = now();
    // A second trusted key with the same first 4 bytes as oldKey. Two real
    // keys collide only by a 1-in-2^32 chance, so this one has no private key:
    // it only has to share the id.
    const twin = keyId(oldKey) + 'f'.repeat(56);
    expect(keyId(twin)).toBe(keyId(oldKey));
    const good = await entry(oldPrivate, ts);

    for (const keys of [
      [twin, oldKey],
      [oldKey, twin],
    ]) {
      await expectAccepted(
        verifyWebhookSignatures(BODY, { timestamp: ts, signatures: good }, keys)
      );
      await expectAccepted(
        verifyWebhookSignatures(
          BODY,
          { timestamp: ts, signature: await sign(oldPrivate, ts, BODY) },
          keys
        )
      );
    }

    // Both twins are checked by the first entry naming the id; a later entry
    // naming it again is skipped.
    const bad = `${keyId(oldKey)}:${await sign(oldPrivate, ts, '{"other":true}')}`;
    verifyAsyncCalls.mockClear();
    await expectRejected(
      verifyWebhookSignatures(BODY, { timestamp: ts, signatures: `${bad}, ${good}` }, [
        twin,
        oldKey,
      ])
    );
    expect(verifyAsyncCalls).toHaveBeenCalledTimes(2);
  });

  it('never throws anything but SignatureVerificationError on malformed entries, and checks the rest', async () => {
    const ts = now();
    const good = await entry(oldPrivate, ts);
    const id = keyId(newKey);
    const malformed = [
      '',
      ',',
      ' , , ',
      'no-colon',
      ':',
      `${id}:`,
      `:${await sign(newPrivate, ts, BODY)}`,
      `${id}:not base64!!!`,
      `${id}:${Buffer.from('short').toString('base64')}`,
      `${id}:${Buffer.alloc(64, 0xff).toString('base64')}`,
      `${id}:${Buffer.alloc(64).toString('base64')}`,
      `${id}:${'A'.repeat(100000)}`,
      `${'g'.repeat(8)}:${await sign(newPrivate, ts, BODY)}`,
      `${id}:${await sign(newPrivate, ts, BODY)}:extra`,
    ];
    for (const m of malformed) {
      // On its own: rejected, with our error type only.
      if (m.trim() !== '') {
        await expectRejected(
          verifyWebhookSignatures(BODY, { timestamp: ts, signatures: m }, newKey)
        );
        expect(() =>
          verifyWebhookSignaturesSync(BODY, { timestamp: ts, signatures: m }, newKey)
        ).toThrow(SignatureVerificationError);
      }
      // Next to a good entry for another trusted key: still accepted.
      await expectAccepted(
        verifyWebhookSignatures(BODY, { timestamp: ts, signatures: `${m}, ${good}` }, [
          newKey,
          oldKey,
        ])
      );
    }
  });

  it('falls back to the legacy header only when the list header is missing or blank', async () => {
    const ts = now();
    const legacy = await sign(newPrivate, ts, BODY);
    for (const signatures of [undefined, '', '   ']) {
      await expectAccepted(
        verifyWebhookSignatures(BODY, { timestamp: ts, signatures, signature: legacy }, [
          oldKey,
          newKey,
        ])
      );
    }
    // Legacy signed by a key that is not trusted.
    await expectRejected(
      verifyWebhookSignatures(
        BODY,
        { timestamp: ts, signature: await sign(strangerPrivate, ts, BODY) },
        [oldKey, newKey]
      )
    );
  });

  it('does not fall back when a present list header has no entry that verifies', async () => {
    const ts = now();
    const legacy = await sign(oldPrivate, ts, BODY);
    const stranger = await entry(strangerPrivate, ts);
    await expectRejected(
      verifyWebhookSignatures(
        BODY,
        { timestamp: ts, signatures: stranger, signature: legacy },
        oldKey
      )
    );
    await expectRejected(
      verifyWebhookSignatures(
        BODY,
        { timestamp: ts, signatures: 'garbage', signature: legacy },
        oldKey
      )
    );
  });

  it('rejects when both signature headers are missing, naming both', async () => {
    await expect(verifyWebhookSignatures(BODY, { timestamp: now() }, oldKey)).rejects.toThrow(
      /x-dakota-webhook-signatures.*x-webhook-signature/i
    );
  });

  it('fails with exactly the old generic "Signature verification failed" message', async () => {
    const ts = now();
    await expect(
      verifyWebhookSignatures(
        BODY,
        { timestamp: ts, signatures: await entry(strangerPrivate, ts) },
        oldKey
      )
    ).rejects.toThrow(/^Signature verification failed$/);
  });
});

// --- parity with the Go SDK, non-string input, sync variant ------------------

describe('verifyWebhookSignatures edge cases', () => {
  it('trims spaces around the key id inside an entry (as the Go SDK does)', async () => {
    const ts = now();
    const sig = await sign(oldPrivate, ts, BODY);
    await expectAccepted(
      verifyWebhookSignatures(
        BODY,
        { timestamp: ts, signatures: `${keyId(oldKey)} : ${sig}` },
        oldKey
      )
    );
  });

  it('falls back to the legacy header when a split list header has only blank values', async () => {
    const ts = now();
    const legacy = await sign(oldPrivate, ts, BODY);
    await expectAccepted(
      verifyWebhookSignatures(
        BODY,
        { timestamp: ts, signatures: ['', '  '], signature: legacy },
        oldKey
      )
    );
    await expectAccepted(
      new WebhookHandler({ publicKeys: oldKey }).handleRequest(BODY, {
        'x-webhook-timestamp': ts,
        'x-dakota-webhook-signatures': ['', ' '],
        'x-webhook-signature': legacy,
      })
    );
  });

  it('takes raw Node header values (arrays) for every header', async () => {
    const ts = now();
    await expectAccepted(
      verifyWebhookSignatures(
        BODY,
        { timestamp: [ts], signatures: [await entry(oldPrivate, ts)], signature: undefined },
        [oldKey]
      )
    );
  });

  it('treats non-string header values as missing, with SignatureVerificationError only', async () => {
    const ts = now();
    const odd = [null, 42, {}, [42]] as never[];
    for (const value of odd) {
      await expectRejected(
        verifyWebhookSignatures(BODY, { timestamp: ts, signatures: value }, oldKey)
      );
      await expectRejected(
        verifyWebhookSignatures(BODY, { timestamp: value, signature: 'x' }, oldKey)
      );
      await expectRejected(
        new WebhookHandler({ publicKeys: oldKey }).handleRequest(BODY, {
          'x-webhook-timestamp': ts,
          'x-dakota-webhook-signatures': value,
        })
      );
    }
    // A non-string list value next to a valid legacy signature falls back.
    await expectAccepted(
      verifyWebhookSignatures(
        BODY,
        { timestamp: ts, signatures: 42 as never, signature: await sign(oldPrivate, ts, BODY) },
        oldKey
      )
    );
  });

  it('rejects an unset key list with SignatureVerificationError', async () => {
    const ts = now();
    await expectRejected(
      verifyWebhookSignatures(
        BODY,
        { timestamp: ts, signatures: await entry(oldPrivate, ts) },
        undefined
      )
    );
  });

  it('reports a runtime without synchronous SHA-512 instead of rejecting as a forgery', async () => {
    const ts = now();
    const signatures = await entry(oldPrivate, ts);
    const saved = ed25519.etc.sha512Sync;
    ed25519.etc.sha512Sync = undefined;
    try {
      let thrown: unknown;
      try {
        verifyWebhookSignaturesSync(BODY, { timestamp: ts, signatures }, oldKey);
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(Error);
      expect(thrown).not.toBeInstanceOf(SignatureVerificationError);
      expect((thrown as Error).message).toContain('sha512Sync');
    } finally {
      ed25519.etc.sha512Sync = saved;
    }
  });

  it('rethrows a missing async SHA-512 instead of rejecting as a forgery', async () => {
    const ts = now();
    const signatures = await entry(oldPrivate, ts);
    const saved = ed25519.etc.sha512Async;
    ed25519.etc.sha512Async = () => Promise.reject(new Error('crypto.subtle must be defined'));
    try {
      const result = verifyWebhookSignatures(BODY, { timestamp: ts, signatures }, oldKey);
      await expect(result).rejects.toThrow('crypto.subtle must be defined');
      await expect(result).rejects.not.toThrow(SignatureVerificationError);
    } finally {
      ed25519.etc.sha512Async = saved;
    }
  });

  describe.each([
    ['async', (...a: Parameters<typeof verifyWebhookSignatures>) => verifyWebhookSignatures(...a)],
    [
      'sync',
      async (...a: Parameters<typeof verifyWebhookSignatures>) => verifyWebhookSignaturesSync(...a),
    ],
  ] as const)('%s variant applies the same rules', (_name, verify) => {
    it('accepts a trusted entry and falls back only when the list is blank', async () => {
      const ts = now();
      const legacy = await sign(oldPrivate, ts, BODY);
      await expectAccepted(
        verify(BODY, { timestamp: ts, signatures: await entry(oldPrivate, ts) }, oldKey)
      );
      await expectAccepted(
        verify(BODY, { timestamp: ts, signatures: ' ', signature: legacy }, oldKey)
      );
      await expectRejected(
        verify(
          BODY,
          { timestamp: ts, signatures: await entry(strangerPrivate, ts), signature: legacy },
          oldKey
        )
      );
    });

    it('checks each trusted key once', async () => {
      const ts = now();
      const bad = `${keyId(oldKey)}:${await sign(oldPrivate, ts, '{"other":true}')}`;
      await expectRejected(
        verify(
          BODY,
          { timestamp: ts, signatures: `${bad}, ${await entry(oldPrivate, ts)}` },
          oldKey
        )
      );
    });

    it('rejects a stale timestamp, even with no signature headers', async () => {
      const stale = String(Math.floor(Date.now() / 1000) - 3600);
      await expect(verify(BODY, { timestamp: stale }, oldKey)).rejects.toThrow('Timestamp expired');
      await expect(
        verify(BODY, { timestamp: stale, signatures: await entry(oldPrivate, stale) }, oldKey)
      ).rejects.toThrow('Timestamp expired');
    });
  });
});

// --- WebhookHandler through a rotation --------------------------------------

describe('WebhookHandler with several trusted keys', () => {
  it('exports the list header name', () => {
    expect(SIGNATURES_HEADER).toBe('x-dakota-webhook-signatures');
  });

  it('case 1: legacy header signed by the old key (proxy stripped the list)', async () => {
    const headers = await platformHeaders([oldPrivate]);
    delete headers['x-dakota-webhook-signatures'];
    for (const config of [
      { publicKey: oldKey },
      { publicKeys: [oldKey, newKey] },
      { publicKeys: `${oldKey},${newKey}` },
    ]) {
      await expectAccepted(new WebhookHandler(config).handleRequest(BODY, headers));
    }
  });

  it('case 2: legacy header signed by the new key (after cutover, proxy stripped the list)', async () => {
    const headers = await platformHeaders([newPrivate]);
    delete headers['x-dakota-webhook-signatures'];
    await expectAccepted(
      new WebhookHandler({ publicKeys: [oldKey, newKey] }).handleRequest(BODY, headers)
    );
    await expectRejected(new WebhookHandler({ publicKey: oldKey }).handleRequest(BODY, headers));
  });

  it('case 3: list header with the new key only (cutover)', async () => {
    const headers = await platformHeaders([newPrivate]);
    await expectAccepted(
      new WebhookHandler({ publicKeys: [oldKey, newKey] }).handleRequest(BODY, headers)
    );
    await expectAccepted(new WebhookHandler({ publicKeys: newKey }).handleRequest(BODY, headers));
    // A receiver that still trusts only the old key breaks at cutover.
    await expectRejected(new WebhookHandler({ publicKey: oldKey }).handleRequest(BODY, headers));
  });

  it('case 4: list header with both keys (overlap)', async () => {
    const headers = await platformHeaders([oldPrivate, newPrivate]);
    for (const config of [
      { publicKey: oldKey },
      { publicKeys: [newKey] },
      { publicKeys: [oldKey, newKey] },
    ]) {
      await expectAccepted(new WebhookHandler(config).handleRequest(BODY, headers));
    }
    // The legacy header is ignored while the list is present: a receiver that
    // trusts only the new key is accepted through the list, not the legacy header.
    const listOnly = { ...headers };
    delete (listOnly as Record<string, string>)['x-webhook-signature'];
    await expectAccepted(
      new WebhookHandler({ publicKeys: [newKey] }).handleRequest(BODY, listOnly)
    );
  });

  it('accepts the golden vector through both headers', async () => {
    vi.useFakeTimers({ now: Number(GOLDEN.timestamp) * 1000, toFake: ['Date'] });
    const handler = new WebhookHandler({ publicKeys: [GOLDEN.publicKey], idempotencyStore: false });
    // The golden body has no event type, so a verified delivery gets as far as
    // event parsing; a signature failure would stop it earlier.
    const viaList = handler.handleRequest(GOLDEN.body, {
      'x-webhook-timestamp': GOLDEN.timestamp,
      'x-dakota-webhook-signatures': `${GOLDEN.keyId}:${GOLDEN.signature}`,
    });
    await expect(viaList).rejects.toThrow('Invalid event');
    await expect(viaList).rejects.not.toThrow(SignatureVerificationError);
    const viaLegacy = handler.handleRequest(GOLDEN.body, {
      'x-webhook-timestamp': GOLDEN.timestamp,
      'x-webhook-signature': GOLDEN.signature,
    });
    await expect(viaLegacy).rejects.toThrow('Invalid event');
    await expect(viaLegacy).rejects.not.toThrow(SignatureVerificationError);
    // The same headers over another body fail verification.
    await expectRejected(
      handler.handleRequest('{"id":"evt_golden","type":"x"}', {
        'x-webhook-timestamp': GOLDEN.timestamp,
        'x-dakota-webhook-signatures': `${GOLDEN.keyId}:${GOLDEN.signature}`,
      })
    );
  });

  it('does not fall back to a valid legacy header when the list header fails', async () => {
    const headers = await platformHeaders([oldPrivate]);
    headers['x-dakota-webhook-signatures'] = await entry(
      strangerPrivate,
      headers['x-webhook-timestamp']!
    );
    await expectRejected(new WebhookHandler({ publicKey: oldKey }).handleRequest(BODY, headers));
  });

  it('joins a list header that a proxy split over several values', async () => {
    const ts = now();
    const handler = new WebhookHandler({ publicKeys: [newKey] });
    await expectAccepted(
      handler.handleRequest(BODY, {
        'x-webhook-timestamp': ts,
        'x-dakota-webhook-signatures': [await entry(oldPrivate, ts), await entry(newPrivate, ts)],
      })
    );
  });

  it('rejects a request with neither signature header', async () => {
    const handler = new WebhookHandler({ publicKeys: [oldKey] });
    await expect(handler.handleRequest(BODY, { 'x-webhook-timestamp': now() })).rejects.toThrow(
      SignatureVerificationError
    );
  });

  it('constructEvent takes the list header as an optional fourth argument', async () => {
    const ts = now();
    const handler = new WebhookHandler({ publicKeys: [newKey] });
    const event = await handler.constructEvent(BODY, '', ts, await entry(newPrivate, ts));
    expect(event.id).toBe('evt_rotation');
    // Legacy-only callers are unchanged.
    await expectAccepted(handler.constructEvent(BODY, await sign(newPrivate, ts, BODY), ts));
  });

  it('reports the trusted key ids, which are safe to log', () => {
    expect(
      new WebhookHandler({
        publicKey: oldKey,
        publicKeys: [newKey],
        logger: { warn: vi.fn() },
      }).keyIds()
    ).toEqual([keyId(oldKey), keyId(newKey)]);
    // A key given in both options is kept once.
    expect(
      new WebhookHandler({ publicKey: oldKey, publicKeys: [newKey, oldKey] }).keyIds()
    ).toEqual([keyId(newKey), keyId(oldKey)]);
  });
});

// --- What the sender sees ------------------------------------------------------

describe('expressMiddleware responses stay generic', () => {
  function mockRes() {
    const res = {
      code: 0,
      body: '',
      status(code: number) {
        res.code = code;
        return { send: (body: string) => void (res.body = body) };
      },
      sendStatus(code: number) {
        res.code = code;
      },
    };
    return res;
  }

  it('answers a forged or untrusted delivery with 401 and the old generic text, no key ids', async () => {
    const handler = new WebhookHandler({ publicKeys: [oldKey, newKey] });
    const middleware = handler.expressMiddleware();
    const ts = now();
    const cases: Record<string, string | string[]>[] = [
      { 'x-dakota-webhook-signatures': await entry(strangerPrivate, ts) },
      { 'x-dakota-webhook-signatures': `${keyId(oldKey)}:${await sign(newPrivate, ts, BODY)}` },
      {
        'x-dakota-webhook-signatures': 'garbage',
        'x-webhook-signature': await sign(oldPrivate, ts, BODY),
      },
      { 'x-webhook-signature': await sign(strangerPrivate, ts, BODY) },
    ];
    for (const extra of cases) {
      const res = mockRes();
      await middleware(
        { body: Buffer.from(BODY), headers: { 'x-webhook-timestamp': ts, ...extra } },
        res,
        () => undefined
      );
      expect(res.code).toBe(401);
      expect(res.body).toBe('Signature verification failed');
      for (const id of [keyId(oldKey), keyId(newKey), keyId(strangerKey)]) {
        expect(res.body).not.toContain(id);
      }
    }
  });
});

// --- WebhookHandler configuration -----------------------------------------

describe('WebhookHandler key configuration', () => {
  const malformed = 'not-a-key';
  const privateLooking = 'cd'.repeat(64);

  it('requires publicKey or publicKeys', () => {
    expect(() => new WebhookHandler({} as never)).toThrow('Public key is required');
    expect(() => new WebhookHandler({ publicKey: '' })).toThrow('Public key is required');
  });

  it('throws at construction for a malformed key in publicKeys, without its value', () => {
    expect(() => new WebhookHandler({ publicKeys: [oldKey, privateLooking] })).toThrow(
      SignatureVerificationError
    );
    expect(() => new WebhookHandler({ publicKeys: [] })).toThrow(SignatureVerificationError);
    const build = () => new WebhookHandler({ publicKeys: privateLooking });
    expect(build).toThrow(SignatureVerificationError);
    expect(build).toThrow(/public key 1 is not/);
    expect(build).not.toThrow(/cdcd/);
  });

  it('treats publicKeys: null like an unset option', async () => {
    const handler = new WebhookHandler({ publicKey: oldKey, publicKeys: null as never });
    await expectAccepted(handler.handleRequest(BODY, await platformHeaders([oldPrivate])));
    expect(() => new WebhookHandler({ publicKeys: null as never })).toThrow(
      'Public key is required'
    );
  });

  it('accepts an empty publicKeys next to a valid publicKey (unset env var), but not alone', async () => {
    const warn = vi.fn();
    const handler = new WebhookHandler({ publicKey: oldKey, publicKeys: '', logger: { warn } });
    await expectAccepted(handler.handleRequest(BODY, await platformHeaders([oldPrivate])));
    expect(handler.keyIds()).toEqual([keyId(oldKey)]);
    expect(() => new WebhookHandler({ publicKeys: ' , ' })).toThrow(
      'At least one webhook public key is required'
    );
    expect(
      () => new WebhookHandler({ publicKey: malformed, publicKeys: '', logger: { warn } })
    ).toThrow('At least one webhook public key is required');
  });

  it('keeps a malformed legacy publicKey lazy: construction succeeds and each request fails as before', async () => {
    const warn = vi.fn();
    const handler = new WebhookHandler({ publicKey: malformed, logger: { warn } });
    const headers = await platformHeaders([oldPrivate]);
    await expect(handler.handleRequest(BODY, headers)).rejects.toThrow(SignatureVerificationError);
    await expect(handler.handleRequest(BODY, headers)).rejects.toThrow('Invalid public key length');
    // constructEvent fails the same way
    await expect(
      handler.constructEvent(BODY, headers['x-webhook-signature']!, headers['x-webhook-timestamp']!)
    ).rejects.toThrow('Invalid public key length');
    expect(handler.keyIds()).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('keeps the legacy-key request failures in their old order: missing headers, then timestamp, then key', async () => {
    const handler = new WebhookHandler({ publicKey: malformed, logger: { warn: vi.fn() } });
    await expect(handler.handleRequest(BODY, {})).rejects.toThrow(
      'Missing x-dakota-webhook-signatures and x-webhook-signature headers'
    );
    await expect(handler.handleRequest(BODY, { 'x-webhook-signature': 'x' })).rejects.toThrow(
      'Missing x-webhook-timestamp header'
    );
    await expect(
      handler.handleRequest(BODY, { 'x-webhook-signature': 'x', 'x-webhook-timestamp': '1' })
    ).rejects.toThrow('Timestamp expired');
  });

  it('with both options, skips a malformed legacy key, uses publicKeys, and warns once without the value', async () => {
    const warn = vi.fn();
    const handler = new WebhookHandler({
      publicKey: privateLooking,
      publicKeys: [newKey],
      logger: { warn },
    });
    expect(warn).toHaveBeenCalledTimes(1);
    const warning = String(warn.mock.calls[0]![0]);
    expect(warning).toContain('publicKey');
    expect(warning).not.toContain('cdcd');

    await expectAccepted(handler.handleRequest(BODY, await platformHeaders([newPrivate])));
    await expectAccepted(
      handler.handleRequest(BODY, await platformHeaders([oldPrivate, newPrivate]))
    );
    expect(warn).toHaveBeenCalledTimes(1);
    expect(handler.keyIds()).toEqual([keyId(newKey)]);
  });

  it('merges a valid legacy publicKey with publicKeys, warning with its key id so it is not forgotten at retirement', async () => {
    const warn = vi.fn();
    const handler = new WebhookHandler({
      publicKey: oldKey,
      publicKeys: [newKey],
      logger: { warn },
    });
    await expectAccepted(handler.handleRequest(BODY, await platformHeaders([oldPrivate])));
    await expectAccepted(handler.handleRequest(BODY, await platformHeaders([newPrivate])));
    expect(warn).toHaveBeenCalledTimes(1);
    const warning = String(warn.mock.calls[0]![0]);
    expect(warning).toContain(keyId(oldKey));
    expect(warning).not.toContain(oldKey);
  });

  it('does not warn for a single publicKey, publicKeys alone, or a publicKey also listed in publicKeys', () => {
    const warn = vi.fn();
    new WebhookHandler({ publicKey: oldKey, logger: { warn } });
    new WebhookHandler({ publicKeys: [oldKey, newKey], logger: { warn } });
    new WebhookHandler({ publicKey: oldKey, publicKeys: [newKey, oldKey], logger: { warn } });
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns through console by default', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      new WebhookHandler({ publicKey: malformed, publicKeys: [newKey] });
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  it('keeps the WebhookHandlerConfig interface usable by existing TypeScript code', () => {
    // Compile-time checks (npm run typecheck covers tests): these broke when
    // the config was briefly a union type.
    interface AppConfig extends WebhookHandlerConfig {
      route: string;
    }
    const cfg: AppConfig = { publicKey: oldKey, route: '/webhooks' };
    const key: string = cfg.publicKey;
    const partial: Omit<WebhookHandlerConfig, 'logger'> = { publicKey: key };
    const multi: MultiKeyWebhookHandlerConfig = { publicKeys: [oldKey, newKey] };
    expect(new WebhookHandler(partial).keyIds()).toEqual([keyId(oldKey)]);
    expect(new WebhookHandler(multi).keyIds()).toEqual([keyId(oldKey), keyId(newKey)]);
  });

  it('accepts a stranger key in a list that also has the right key (sanity: stranger key is valid)', async () => {
    const handler = new WebhookHandler({ publicKeys: [strangerKey, oldKey] });
    await expectAccepted(handler.handleRequest(BODY, await platformHeaders([oldPrivate])));
  });
});
