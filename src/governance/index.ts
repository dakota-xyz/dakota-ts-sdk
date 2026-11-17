/**
 * Signer-group governance: build the canonical intents, sign them with an
 * ES256 key or a passkey, and package the signatures.
 *
 * This entry point (`@dakota-xyz/ts-sdk/governance`) has no `node:` import
 * and no `Buffer`, so it bundles for browsers and React Native (which needs
 * `TextEncoder` and `crypto.getRandomValues`; polyfill them on older Hermes). The API
 * calls that send a signed change live on `client.signerGroups` in the main
 * entry, which runs where your API key is (your server).
 *
 * @example Passkey, two-phase (server prepares, browser signs, server submits)
 * ```typescript
 * // server
 * const change = await client.signerGroups.prepareAddSigner(groupId, newMemberKey);
 * // ... send change.canonical to the browser, keep `change` ...
 *
 * // browser
 * import { buildChallenge, packAssertion } from '@dakota-xyz/ts-sdk/governance';
 * const credential = await navigator.credentials.get({
 *   publicKey: { challenge: buildChallenge(canonical), rpId, userVerification: 'required' },
 * });
 * const signature = packAssertion(credential as PublicKeyCredential);
 * // ... send `signature` back ...
 *
 * // server
 * const group = await client.signerGroups.submitSignedChange(change, [signature]);
 * ```
 */

export {
  addSignersToGroupIntent,
  assertIdempotencyKey,
  createCryptoDestinationIntent,
  newIdempotencyKey,
  removeSignersFromGroupIntent,
  updateSignerGroupGovernanceIntent,
  type AddSignersToGroupIntent,
  type CanonicalIntent,
  type CreateCryptoDestinationIntent,
  type GovernanceIntent,
  type RemoveSignersFromGroupIntent,
  type UpdateSignerGroupGovernanceIntent,
} from './intents.js';

export {
  assertionChallengeMatches,
  buildChallenge,
  packAssertion,
  webauthnSigner,
  type AssertionCredential,
  type BinaryOrBase64,
} from './webauthn.js';

export {
  signGovernanceIntent,
  webCryptoES256Signer,
  type GovernanceSigner,
  type GovernanceSignerLike,
  type SubtleCryptoLike,
} from './signer.js';

export { canonicalJSON } from '../agentic/canonicalize.js';
