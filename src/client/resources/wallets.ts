/**
 * Wallets resource.
 */

import { BaseResource } from './base.js';
import type {
  Wallet,
  WalletCreateRequest,
  WalletBalance,
  WalletBalances,
  WalletTransactionRequest,
  WalletTransaction,
  AttachedPolicy,
  RequestOptions,
} from '../types.js';

/**
 * Wallets API resource.
 */
export class WalletsResource extends BaseResource {
  /**
   * Create a new wallet.
   *
   * Creates a non-custodial multi-sig wallet for a customer.
   *
   * @param data - Wallet creation data
   * @returns Created wallet
   *
   * @example
   * ```typescript
   * const wallet = await client.wallets.create({
   *   customer_id: customerId,
   *   family: 'evm',
   *   name: 'Treasury Wallet',
   * });
   * console.log(wallet.address);
   * ```
   */
  async create(data: WalletCreateRequest, options?: RequestOptions): Promise<Wallet> {
    return this.transport.request<Wallet>({
      method: 'POST',
      path: '/wallets',
      body: data,
      idempotencyKey: options?.idempotencyKey,
    });
  }

  /**
   * Get a single wallet by ID.
   *
   * @param walletId - Wallet ID
   * @returns Wallet record (includes `customer_name` and `created_at`)
   *
   * @example
   * ```typescript
   * const wallet = await client.wallets.get(walletId);
   * console.log(wallet.address, wallet.customer_name);
   * ```
   */
  async get(walletId: string): Promise<Wallet> {
    return this.transport.request<Wallet>({
      method: 'GET',
      path: `/wallets/${walletId}`,
    });
  }

  /**
   * Get policies attached to a wallet.
   *
   * Returns slim references (id + name) for the policies currently attached to the wallet.
   *
   * @param walletId - Wallet ID
   * @returns Array of attached policies
   *
   * @example
   * ```typescript
   * const policies = await client.wallets.getPolicies(walletId);
   * for (const policy of policies) {
   *   console.log(policy.id, policy.name);
   * }
   * ```
   */
  async getPolicies(walletId: string): Promise<AttachedPolicy[]> {
    return this.transport.request<AttachedPolicy[]>({
      method: 'GET',
      path: `/wallets/${walletId}/policies`,
    });
  }

  /**
   * Get wallet balances.
   *
   * @param walletId - Wallet ID
   * @returns Array of balances
   *
   * @example
   * ```typescript
   * const balances = await client.wallets.getBalances(walletId);
   * for (const balance of balances) {
   *   console.log(balance.asset, balance.amount);
   * }
   * ```
   */
  async getBalances(walletId: string): Promise<WalletBalance[]> {
    // /wallets/{id}/balances returns the WalletBalances object directly
    // ({ wallet_id, address, balances, total_amount_usd }), not the
    // paginated { data, meta } envelope. Earlier versions read
    // response.data here and silently returned undefined.
    const response = await this.transport.request<WalletBalances>({
      method: 'GET',
      path: `/wallets/${walletId}/balances`,
    });
    // WalletBalances.balances is readonly per the OpenAPI types — copy
    // into a mutable array so callers can sort/filter/etc.
    return response.balances ? [...response.balances] : [];
  }

  /**
   * Send a transaction from a wallet.
   *
   * The platform expects an **endorsed request** envelope —
   * `{ signatures, intent }` — at this endpoint. Build the
   * `SendTransactionIntent`, canonicalize it per RFC 8785 (JCS), sign
   * with the wallet's signer-group ECDSA P-256 key, base64-encode the
   * DER signature, then post the envelope.
   *
   * @param walletId - Wallet ID
   * @param data - Endorsed wallet transaction request: `{ signatures, intent }`
   * @returns Created transaction
   *
   * @example
   * ```typescript
   * import canonicalize from 'canonicalize';
   * import { createSign, createPrivateKey, randomUUID } from 'node:crypto';
   *
   * const intent = {
   *   wallet_id: walletId,
   *   caip2: 'eip155:1',                 // 11155111 for sepolia
   *   operation: {
   *     kind: 'transfer',
   *     from: wallet.address,
   *     to: '0x...',
   *     amount: '100.00',
   *     asset_id: 'USDC',
   *   },
   *   idempotency_key: randomUUID(),
   * };
   * const canonical = canonicalize(intent)!;
   * const sig = createSign('SHA256').update(canonical).sign({
   *   key: createPrivateKey({ key: privateKeyDer, format: 'der', type: 'pkcs8' }),
   *   dsaEncoding: 'der',
   * });
   * const tx = await client.wallets.createTransaction(walletId, {
   *   signatures: [sig.toString('base64')],
   *   intent,
   * });
   * ```
   *
   * @see https://docs.dakota.xyz/documentation/signing-guide
   */
  async createTransaction(
    walletId: string,
    data: WalletTransactionRequest,
    options?: RequestOptions
  ): Promise<WalletTransaction> {
    return this.transport.request<WalletTransaction>({
      method: 'POST',
      path: `/wallets/${walletId}/transactions`,
      body: data,
      idempotencyKey: options?.idempotencyKey,
    });
  }
}
