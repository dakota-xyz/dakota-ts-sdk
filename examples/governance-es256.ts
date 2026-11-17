/**
 * Signed signer-group changes with ES256 keys, end to end against SANDBOX.
 *
 * Creates two governing signers (A, B) and a signer group governed by them
 * (quorum 1), then:
 *   1. an unsigned add is refused        -> EndorsementRequiredError
 *   2. a signed add (A) succeeds          -> version 0 -> 1
 *   3. a signature over an old version    -> StaleSignerGroupVersionError
 *   4. a signed removal (A) succeeds      -> version 1 -> 2
 *   5. raising the quorum to 2 (A)        -> version 2 -> 3
 *   6. an add signed by A and B           -> version 3 -> 4
 *   7. a removal signed by A alone        -> InsufficientEndorsementsError
 *   8. the same removal signed by A and B -> version 4 -> 5
 *
 * Use an ORDINARY sandbox client's API key. Never run it with a key of an
 * internal superadmin client: every key there acts as superadmin, whatever
 * its scope. The script creates signers and a signer group (named
 * `gov-example-*`) and touches nothing else.
 *
 * Run with: DAKOTA_API_KEY=... npx tsx examples/governance-es256.ts
 */

import {
  APIError,
  DakotaClient,
  EndorsementRequiredError,
  Environment,
  ES256Signer,
  InsufficientEndorsementsError,
  StaleSignerGroupVersionError,
} from '../src/index.js';

const apiKey = process.env.DAKOTA_API_KEY;
if (!apiKey) {
  console.error('Set DAKOTA_API_KEY to a sandbox API key of an ordinary (non-superadmin) client.');
  process.exit(2);
}

const client = new DakotaClient({ apiKey, environment: Environment.Sandbox });
const tag = `gov-example-${Date.now()}`;

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
  const [a, b, x, y] = [0, 1, 2, 3].map(() => ES256Signer.generate()) as [
    ES256Signer,
    ES256Signer,
    ES256Signer,
    ES256Signer,
  ];
  for (const [name, s] of Object.entries({ A: a, B: b, X: x, Y: y })) {
    await client.signers.create({
      name: `${tag}-${name}`,
      public_key: s.publicKeyBase64(),
      key_type: 'ES256',
    });
  }

  let group = await client.signerGroups.create({
    name: tag,
    member_keys: [a.publicKeyBase64(), b.publicKeyBase64()],
    governance_threshold: 1,
  });
  console.log(`group ${group.id} at version ${group.version}`);

  await expectRefusal('1 unsigned add', EndorsementRequiredError, () =>
    client.signerGroups.addSigner(group.id, { member_key: x.publicKeyBase64() })
  );

  group = await client.signerGroups.addSignerSigned(group.id, x.publicKeyBase64(), [a]);
  console.log(`ok   2 signed add: version ${group.version}, ${group.members.length} members`);

  // A change signed over version 0 after the group moved on.
  const stale = await client.signerGroups.prepareAddSigner(group.id, y.publicKeyBase64(), {
    signerGroupVersion: 0,
  });
  await expectRefusal('3 stale version', StaleSignerGroupVersionError, () =>
    client.signerGroups.submitSignedChange(stale, [
      a.sign(new TextEncoder().encode(stale.canonical)),
    ])
  );

  group = await client.signerGroups.removeSignersSigned(group.id, [x.publicKeyBase64()], [a]);
  console.log(`ok   4 signed removal: version ${group.version}, ${group.members.length} members`);

  group = await client.signerGroups.updateGovernanceSigned(group.id, { governance_threshold: 2 }, [
    a,
  ]);
  console.log(
    `ok   5 quorum raised: version ${group.version}, effective ${group.effective_governance_threshold}`
  );

  group = await client.signerGroups.addSignerSigned(group.id, y.publicKeyBase64(), [a, b]);
  console.log(`ok   6 add at quorum 2: version ${group.version}, ${group.members.length} members`);

  await expectRefusal('7 one signature at quorum 2', InsufficientEndorsementsError, () =>
    client.signerGroups.removeSignersSigned(group.id, [y.publicKeyBase64()], [a])
  );

  group = await client.signerGroups.removeSignersSigned(group.id, [y.publicKeyBase64()], [a, b]);
  console.log(
    `ok   8 removal at quorum 2: version ${group.version}, ${group.members.length} members`
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
