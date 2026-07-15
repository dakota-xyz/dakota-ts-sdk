/**
 * High-level agentic helpers: collapse the multi-step, crypto-heavy hosted-
 * agent flows into single calls with good defaults, so a partner integration
 * stays short. The raw operations remain reachable via the resource classes
 * on `DakotaClient`.
 *
 * Agentic payments is an alpha surface (x-alpha, flag-gated on the platform)
 * and may change without a major-version bump.
 */

import { randomUUID } from 'node:crypto';

import type { DakotaClient } from '../client/client.js';

/**
 * Grant a principal — a user OR an agent, both are just signers — permission
 * to spend from a wallet by adding its signer to an EXISTING signer group on
 * that wallet: the group whose attached policies should govern it.
 *
 * That membership change is the whole operation, and it is UNENDORSED: group
 * membership is a client-admin action, not a wallet endorsement, so it needs
 * NO signature — not from the wallet owner, not from the principal being
 * added. From then on the principal's transactions are subject to exactly
 * the policies bound to `spendingGroupId`, the same as any other member of
 * that group. The per-payment spend bound remains the agentic mandate gate,
 * not the policy.
 *
 * Deliberately reuses the wallet's pre-built policies and creates NO
 * per-signer policy. Two policy-engine realities make a per-signer policy
 * the wrong tool: a policy → wallet attach is endorsed by the policy's OWN
 * signer group (so only that group's key could attach it), and an
 * unconditional approval-threshold ALLOW policy inverts to a deny for any
 * transaction its group didn't sign, so a second signer's policy would veto
 * the first. Prepare the wallet's groups + policies in advance and point
 * each principal at the group whose constraints you want it to inherit.
 *
 * Idempotent: if the signer is already a member, returns
 * `alreadyMember: true` and makes no write. Rejects `spendingGroupId` if it
 * is not attached to `walletId`, so a wrong group fails loudly instead of
 * silently granting nothing.
 *
 * The key must already exist as a signer resource — the add endpoint takes
 * a `member_key` reference, it does not register keys. A hosted agent's key
 * is minted by `paymentAgents.create`; for a bare user key, register it
 * first (`POST /signers`) or the add fails with a signer-not-found error.
 *
 * @param client - Dakota client
 * @param walletId - The wallet the principal will spend from
 * @param signerPublicKey - The principal's registered signer public key
 *   (base64 PKIX) — e.g. `signer_public_key` returned by
 *   `paymentAgents.create` for a hosted agent
 * @param spendingGroupId - The signer group whose attached policies should
 *   govern the principal; must already be attached to `walletId`
 * @param options - Optional. Supply `idempotencyKey` to make the WHOLE
 *   helper safely retryable — a crashed or partitioned call replayed with
 *   the same key dedupes the underlying write server-side. Defaults to a
 *   fresh random key per call.
 * @returns `{ alreadyMember }` — true when the signer was already a member
 *   (no write performed)
 */
export async function attachUserToWallet(
  client: DakotaClient,
  walletId: string,
  signerPublicKey: string,
  spendingGroupId: string,
  options?: { idempotencyKey?: string }
): Promise<{ alreadyMember: boolean }> {
  if (!walletId || !signerPublicKey || !spendingGroupId) {
    throw new Error('walletId, signerPublicKey and spendingGroupId are all required');
  }

  await requireGroupOnWallet(client, walletId, spendingGroupId);

  // Idempotency: skip the add if the signer's key is already a member.
  const group = await client.signerGroups.get(spendingGroupId);
  for (const member of group.members ?? []) {
    if (member.public_key === signerPublicKey) {
      return { alreadyMember: true };
    }
  }

  // Add the signer to the group (unendorsed). Granting spend permission is
  // security-relevant, so set an explicit idempotency key rather than depend
  // on transport config (`automaticIdempotency: false` would otherwise send
  // this POST without the required header and 400).
  await client.signerGroups.addSigner(
    spendingGroupId,
    { member_key: signerPublicKey },
    { idempotencyKey: options?.idempotencyKey ?? randomUUID() }
  );
  return { alreadyMember: false };
}

/**
 * Revoke a principal's spend permission by removing its signer from
 * `spendingGroupId` — the inverse of {@link attachUserToWallet}, and
 * likewise UNENDORSED (no signature).
 *
 * Deliberately SCOPED to the one group you pass, NOT a sweep across every
 * group on the wallet, for two reasons:
 *   - signer groups are NOT wallet-exclusive — the same group can govern
 *     multiple wallets — so removing a signer from a group revokes it on
 *     EVERY wallet that group governs; passing one explicit group keeps
 *     that blast radius known instead of multiplying it across all of the
 *     wallet's groups;
 *   - a sweep cannot tell "added for this agent" from "belongs here for
 *     another reason" (e.g. the human owner sitting in the admin group),
 *     so it can lock out a legitimate member.
 *
 * Pass the same group you used to attach. Idempotent: if the signer isn't
 * a member, it is a no-op (`wasMember: false`). Rejects `spendingGroupId`
 * if it is not attached to `walletId`.
 *
 * NOTE: this does not guard against removing a group's LAST member —
 * emptying the group that governs a wallet can leave it with no authorized
 * signer. The caller must avoid stranding the wallet. For a hosted agent,
 * prefer `paymentAgents.revoke` (it destroys the agent's key, so the signer
 * can authorize nothing even while still listed) and use this for
 * membership hygiene.
 *
 * @param options - Optional. Supply `idempotencyKey` to make the WHOLE
 *   helper safely retryable across crashes/partitions; defaults to a fresh
 *   random key per call.
 */
export async function detachUserFromWallet(
  client: DakotaClient,
  walletId: string,
  signerPublicKey: string,
  spendingGroupId: string,
  options?: { idempotencyKey?: string }
): Promise<{ wasMember: boolean }> {
  if (!walletId || !signerPublicKey || !spendingGroupId) {
    throw new Error('walletId, signerPublicKey and spendingGroupId are all required');
  }

  await requireGroupOnWallet(client, walletId, spendingGroupId);

  // Resolve the signer's public key → its resource id within the group: the
  // delete endpoint addresses members by id, not key. Absent ⇒ idempotent
  // no-op.
  const group = await client.signerGroups.get(spendingGroupId);
  let signerId = '';
  for (const member of group.members ?? []) {
    if (member.public_key === signerPublicKey) {
      signerId = member.id ?? '';
      break;
    }
  }
  if (!signerId) {
    return { wasMember: false };
  }

  // The platform requires an idempotency key on this DELETE. The transport
  // now injects one on DELETEs too, but revoking spend permission is
  // security-relevant, so we set one explicitly — this path must not depend
  // on transport configuration.
  await client.signerGroups.removeSigner(spendingGroupId, signerId, {
    idempotencyKey: options?.idempotencyKey ?? randomUUID(),
  });
  return { wasMember: true };
}

/**
 * Errors unless `spendingGroupId` is one of the signer groups attached to
 * `walletId` — so attach/detach can't silently operate on a group that has
 * nothing to do with the named wallet.
 *
 * Uses the symmetric group → wallets read (`GET /signer-groups/{id}/wallets`)
 * because it returns a bare array with a stable shape. Semantically
 * equivalent to `GET /wallets/{id}/signer-groups`; the check succeeds iff
 * the pair is attached.
 */
async function requireGroupOnWallet(
  client: DakotaClient,
  walletId: string,
  spendingGroupId: string
): Promise<void> {
  const wallets = await client.signerGroups.getWallets(spendingGroupId);
  for (const w of wallets) {
    if (w.id === walletId) {
      return;
    }
  }
  throw new Error(`signer group ${spendingGroupId} is not attached to wallet ${walletId}`);
}
