/**
 * Compile-only check (no runtime): the browser passkey flow from the README
 * must type-check against the DOM's own WebAuthn types, with no casts beyond
 * the one `navigator.credentials.get` itself needs. Compiled by
 * `npm run typecheck` through tsconfig.typecheck-extra.json (lib: DOM).
 */

import {
  assertionChallengeMatches,
  buildChallenge,
  packAssertion,
  webauthnSigner,
  webCryptoES256Signer,
} from '../../src/governance/index.js';

export async function signInBrowser(canonical: string): Promise<string> {
  const credential = await navigator.credentials.get({
    publicKey: {
      challenge: buildChallenge(canonical),
      rpId: 'app.example.com',
      userVerification: 'required',
    },
  });
  const signature = packAssertion(credential as PublicKeyCredential);
  if (!assertionChallengeMatches(signature, canonical)) {
    throw new Error('unexpected challenge');
  }
  return signature;
}

export const passkey = webauthnSigner(
  (challenge) =>
    navigator.credentials.get({
      publicKey: { challenge, rpId: 'app.example.com', userVerification: 'required' },
    }) as Promise<PublicKeyCredential>
);

export async function browserKey(): Promise<string> {
  const { privateKey } = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign', 'verify']
  );
  return webCryptoES256Signer(privateKey, crypto.subtle).sign(new Uint8Array([1]));
}
