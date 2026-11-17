/**
 * Passkey-signed signer-group changes, end to end against SANDBOX.
 *
 * A real integration signs in the user's browser or app:
 *
 *   server:  change = await client.signerGroups.prepareAddSigner(groupId, key)
 *            -> send change.canonical to the browser, keep `change`
 *   browser: navigator.credentials.get({ publicKey: { challenge: buildChallenge(canonical), ... } })
 *            -> packAssertion(credential) -> send it back
 *   server:  await client.signerGroups.submitSignedChange(change, [packed])
 *
 * Here a synthetic passkey (a P-256 key in this process acting as the
 * authenticator) stands in for the browser, so the script runs unattended.
 * It builds the assertion exactly as a browser does, with RP ID and origin
 * `passkey-example.dakota.xyz`.
 *
 * Steps (group {P = passkey, E = ES256}, quorum 1, then {P, E, Y} quorum 2):
 *   1. an unsigned add is refused               -> EndorsementRequiredError
 *   2. a passkey-signed add (two-phase)         -> version 0 -> 1
 *   3. a passkey signature over an old version  -> StaleSignerGroupVersionError
 *   4. a passkey-signed removal                 -> version 1 -> 2
 *   5. at quorum 2, a removal signed by P alone -> InsufficientEndorsementsError
 *   6. the same removal signed by P and E       -> version 0 -> 1
 *
 * Use the API key of an ordinary sandbox client, never one of an internal
 * staff client. The script creates signers and signer groups (named
 * `gov-passkey-example-*`) and touches nothing else.
 *
 * Run with: DAKOTA_API_KEY=... npx tsx examples/governance-passkey.ts
 */

import {
  createHash,
  createSign,
  generateKeyPairSync,
  randomBytes,
  type KeyObject,
} from 'node:crypto';

import {
  APIError,
  DakotaClient,
  EndorsementRequiredError,
  Environment,
  ES256Signer,
  InsufficientEndorsementsError,
  StaleSignerGroupVersionError,
  assertionChallengeMatches,
  buildChallenge,
  packAssertion,
  webauthnSigner,
  type AssertionCredential,
  type PreparedSignerGroupChange,
} from '../src/index.js';

const apiKey = process.env.DAKOTA_API_KEY;
if (!apiKey) {
  console.error('Set DAKOTA_API_KEY to a sandbox API key of an ordinary (non-superadmin) client.');
  process.exit(2);
}

const client = new DakotaClient({ apiKey, environment: Environment.Sandbox });
const tag = `gov-passkey-example-${Date.now()}`;
const RP_ID = 'passkey-example.dakota.xyz';

// ---------------------------------------------------------------------------
// Synthetic passkey: what the browser and the authenticator would do.
// ---------------------------------------------------------------------------

const sha256 = (b: Buffer) => createHash('sha256').update(b).digest();
const ab = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

class SyntheticPasskey {
  private readonly privateKey: KeyObject;
  private readonly rawId = randomBytes(16);
  private counter = 0;
  /** COSE EC2 P-256 public key, base64: what a WEBAUTHN signer registers. */
  readonly coseKeyBase64: string;

  constructor() {
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    this.privateKey = privateKey;
    const jwk = publicKey.export({ format: 'jwk' });
    const x = Buffer.from(jwk.x as string, 'base64url');
    const y = Buffer.from(jwk.y as string, 'base64url');
    // {1: 2 (EC2), 3: -7 (ES256), -1: 1 (P-256), -2: x, -3: y}
    this.coseKeyBase64 = Buffer.concat([
      Buffer.from([0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58, 0x20]),
      x,
      Buffer.from([0x22, 0x58, 0x20]),
      y,
    ]).toString('base64');
  }

  /** Answers navigator.credentials.get({ publicKey: { challenge } }). */
  get(challenge: ArrayBuffer | Uint8Array): AssertionCredential {
    const authenticatorData = Buffer.concat([
      sha256(Buffer.from(RP_ID)),
      Buffer.from([0x05]), // user present + user verified
      Buffer.from([0, 0, 0, ++this.counter]),
    ]);
    const clientDataJSON = Buffer.from(
      JSON.stringify({
        type: 'webauthn.get',
        challenge: Buffer.from(new Uint8Array(challenge)).toString('base64url'),
        origin: `https://${RP_ID}`,
        crossOrigin: false,
      })
    );
    const s = createSign('SHA256');
    s.update(Buffer.concat([authenticatorData, sha256(clientDataJSON)]));
    return {
      id: this.rawId.toString('base64url'),
      rawId: ab(this.rawId),
      type: 'public-key',
      authenticatorAttachment: 'platform',
      response: {
        clientDataJSON: ab(clientDataJSON),
        authenticatorData: ab(authenticatorData),
        signature: ab(s.sign({ key: this.privateKey, dsaEncoding: 'der' })),
        userHandle: null,
      },
    };
  }
}

/** The browser half of the two-phase flow: only `canonical` crosses over. */
function signInBrowser(passkey: SyntheticPasskey, canonical: string): string {
  return packAssertion(passkey.get(buildChallenge(canonical)));
}

/** The server's second half: check what came back, then submit. */
async function submitFromBrowser(change: PreparedSignerGroupChange, packed: string[]) {
  if (!packed.every((p) => assertionChallengeMatches(p, change.canonical))) {
    throw new Error('a returned passkey assertion was not made over this change');
  }
  return client.signerGroups.submitSignedChange(change, packed);
}

async function expectRefusal(
  step: string,
  cls: new (...args: never[]) => APIError,
  run: () => Promise<unknown>
): Promise<void> {
  try {
    await run();
  } catch (err) {
    if (err instanceof cls) {
      console.log(`ok   ${step}: ${err.name} (${err.statusCode} ${err.code})`);
      return;
    }
    throw err;
  }
  throw new Error(`${step}: expected ${cls.name}, but the request succeeded`);
}

async function main(): Promise<void> {
  const p = new SyntheticPasskey();
  const [e, x, y] = [0, 1, 2].map(() => ES256Signer.generate()) as [
    ES256Signer,
    ES256Signer,
    ES256Signer,
  ];
  await client.signers.create({
    name: `${tag}-P`,
    public_key: p.coseKeyBase64,
    key_type: 'WEBAUTHN',
  });
  for (const [name, s] of Object.entries({ E: e, X: x, Y: y })) {
    await client.signers.create({
      name: `${tag}-${name}`,
      public_key: s.publicKeyBase64(),
      key_type: 'ES256',
    });
  }

  let group = await client.signerGroups.create({
    name: tag,
    member_keys: [p.coseKeyBase64, e.publicKeyBase64()],
    governance_threshold: 1,
  });
  console.log(`group ${group.id} at version ${group.version}`);

  await expectRefusal('1 unsigned add', EndorsementRequiredError, () =>
    client.signerGroups.addSigner(group.id, { member_key: x.publicKeyBase64() })
  );

  // Two-phase: the prepared change survives a JSON round trip (a session store).
  const prepared = await client.signerGroups.prepareAddSigner(group.id, x.publicKeyBase64());
  const stored: PreparedSignerGroupChange = JSON.parse(JSON.stringify(prepared));
  const packed = signInBrowser(p, stored.canonical);
  group = await submitFromBrowser(stored, [packed]);
  console.log(`ok   2 passkey add: version ${group.version}, ${group.members.length} members`);

  const stale = await client.signerGroups.prepareAddSigner(group.id, y.publicKeyBase64(), {
    signerGroupVersion: 0,
  });
  await expectRefusal('3 stale version', StaleSignerGroupVersionError, () =>
    submitFromBrowser(stale, [signInBrowser(p, stale.canonical)])
  );

  // One call, with the passkey as a pluggable signer.
  const passkeySigner = webauthnSigner((challenge) => p.get(challenge));
  group = await client.signerGroups.removeSignersSigned(
    group.id,
    [x.publicKeyBase64()],
    [passkeySigner]
  );
  console.log(`ok   4 passkey removal: version ${group.version}, ${group.members.length} members`);

  let group2 = await client.signerGroups.create({
    name: `${tag}-q2`,
    member_keys: [p.coseKeyBase64, e.publicKeyBase64(), y.publicKeyBase64()],
    governance_threshold: 2,
  });
  await expectRefusal('5 passkey alone at quorum 2', InsufficientEndorsementsError, () =>
    client.signerGroups.removeSignersSigned(group2.id, [y.publicKeyBase64()], [passkeySigner])
  );
  group2 = await client.signerGroups.removeSignersSigned(
    group2.id,
    [y.publicKeyBase64()],
    [passkeySigner, e]
  );
  console.log(
    `ok   6 passkey + ES256 at quorum 2: version ${group2.version}, ${group2.members.length} members`
  );
  console.log('PASS');
}

main().catch((err: unknown) => {
  if (err instanceof APIError) {
    console.error(`FAIL ${err.toString()} (request ${err.requestId ?? 'n/a'})`);
  } else {
    console.error('FAIL', err);
  }
  process.exit(1);
});
