# Dakota TypeScript SDK - Agent Reference

## Install

```bash
npm install @dakota-xyz/ts-sdk
```

## Quick Start

```typescript
import { DakotaClient, Environment } from '@dakota-xyz/ts-sdk';

const client = new DakotaClient({
  apiKey: process.env.DAKOTA_API_KEY!,
  environment: Environment.Sandbox, // default
});
```

## API Reference

### Customers

```typescript
// Create customer (triggers KYB)
const customer = await client.customers.create({
  name: 'Acme Corp',
  customer_type: 'business',
  external_id: 'your-internal-id', // optional
});
console.log(customer.application_url); // KYB onboarding URL

// Designate as a sub-client at creation (ENG-2454).
// `is_sub_client` can ONLY be set here — a regular customer cannot be
// promoted to a sub-client afterwards. Cannot be combined with
// `sub_client_id`.
const subClient = await client.customers.create({
  name: 'Partner Corp',
  customer_type: 'business',
  is_sub_client: true,
});

// List customers
for await (const customer of client.customers.list()) {
  console.log(customer.name, customer.kyb_status);
}

// List with filters
const active = client.customers.list({ kyb_status: 'active' });

// List sub-clients only
const subClients = client.customers.list({ is_sub_client: true });

// Collect all to array
const all = await client.customers.list().toArray();

// Get single customer
const customer = await client.customers.get('cust_abc123');

// Delete a customer (soft delete; 409 if it still has accounts or is
// referenced as a sub-client)
await client.customers.delete('cust_abc123');

// What rails can this customer use, and what is still blocking each?
// Partner-agnostic: requirements are keyed by an opaque terms id or
// document type, never a provider or partner name.
const { capabilities } = await client.customers.getCapabilities(customerId);
for (const cap of capabilities) {
  if (cap.status !== 'action_required') continue;
  for (const req of cap.requirements) {
    console.log(`${cap.capability}: ${req.title} → ${req.url}`);
  }
}

// Re-engage an APPROVED customer whose onboarding token expired — mints a
// fresh application_url for the hosted terms-acceptance flow.
const { application_url } = await client.customers.reEngage(customerId);
```

#### Importing existing customers

Two import paths, and they behave differently. Sumsub redeems synchronously
and returns per-token results in the response. Persona redemption is
asynchronous on Persona's side, so it returns a JOB you poll.

```typescript
// Sumsub — synchronous
const result = await client.customers.bulkImportFromSumsubTokens({
  tokens: ['_act-sbx-jwt-...', '_act-sbx-jwt-...'],
});

// Persona Connect share tokens (cnst_...) — asynchronous, up to 5,000/request
const job = await client.customers.importPersonaTokens({
  tokens: ['cnst_ABC123def456', 'cnst_GHI789jkl012'],
});
console.log(`${job.accepted}/${job.total} queued as ${job.job_id}`);

// `skipped` is about the token STRING (malformed, duplicated in the batch,
// or already imported) — never a compliance decision about a person.
for (const s of job.skipped ?? []) {
  console.warn(`token #${s.index} skipped: ${s.reason}`);
}

// Poll for per-token results. Rows page on a row-index cursor.
let after: number | undefined;
for (;;) {
  const status = await client.customers.getPersonaImportJob(job.job_id!, {
    results_after_index: after,
  });
  for (const row of status.results ?? []) {
    // in flight: queued, inquiry_created, redeem_requested, redeemed, finalizing
    // terminal:  succeeded, failed, expired, stuck, cancelled
    if (row.state === 'succeeded') console.log(row.customer_id, row.application_id);
    if (row.state === 'failed') console.error(row.token, row.error_code, row.error);
    after = row.index;
  }
  if (!status.has_more_results) break;
}

// List past import jobs (own cursor — `starting_after` + `has_more`)
const { jobs, has_more } = await client.customers.listPersonaImportJobs({ limit: 20 });
```

### Recipients

```typescript
// Create recipient under customer
const recipient = await client.recipients.create(customerId, {
  name: 'Treasury Account',
});

// List recipients for customer
for await (const recipient of client.recipients.list(customerId)) {
  console.log(recipient.name);
}

// Get recipient
const recipient = await client.recipients.get(recipientId);

// Update recipient
const updated = await client.recipients.update(recipientId, {
  name: 'Updated Name',
});
```

### Destinations

```typescript
// destinations.create returns just `{ id }` (per IDResponse) — it does
// NOT return the full destination object. Call destinations.list to
// read the rest of the fields if needed.

// Create bank destination (for off-ramp)
const bankDest = await client.destinations.create(recipientId, {
  destination_type: 'fiat_us',
  name: 'Primary Bank Account',
  bank_name: 'Chase Bank',
  account_holder_name: 'Acme Corp',
  account_number: '123456789',
  aba_routing_number: '021000021',
  account_type: 'checking',
});
const bankDestId = bankDest.id;

// Create crypto destination (for on-ramp)
const cryptoDest = await client.destinations.create(recipientId, {
  destination_type: 'crypto',
  name: 'Crypto Wallet',
  crypto_address: '0x742d35Cc6634C0532925a3b844Bc9e7595f...',
  network_id: 'ethereum-mainnet',
});
const cryptoDestId = cryptoDest.id;

// List destinations — these DO have `destination_id` (full union shape)
for await (const dest of client.destinations.list(recipientId)) {
  console.log(dest.destination_id, dest.destination_type);
}
```

### Accounts

```typescript
// Create off-ramp account (crypto → USD)
const offramp = await client.accounts.create({
  account_type: 'offramp',
  customer_id: customerId,
  fiat_destination_id: bankDestId,
  asset: 'USDC',
  network_id: 'ethereum-mainnet',
  rail: 'ach',
  capabilities: ['ach'],
});
// Returns: { crypto_address: '0x...' } - customer sends USDC here

// Create on-ramp account (USD → crypto)
const onramp = await client.accounts.create({
  account_type: 'onramp',
  customer_id: customerId,
  crypto_destination_id: cryptoDestId,
  asset: 'USDC',
  network_id: 'ethereum-mainnet',
  rail: 'ach',
  capabilities: ['ach'],
});
// Returns: { bank_account: { bank_name, aba_routing_number, account_number } } - customer sends USD here

// Create swap account (crypto → crypto)
const swap = await client.accounts.create({
  account_type: 'swap',
  customer_id: customerId,
  crypto_destination_id: cryptoDestId,
  asset: 'USDC',
  network_id: 'ethereum-mainnet',
  destination_asset: 'USDT',
  destination_network_id: 'polygon-mainnet',
});

// List accounts
const accounts = await client.accounts.list({ customer_id: customerId }).toArray();

// Get account
const account = await client.accounts.get(accountId);

// Update account
const updated = await client.accounts.update(accountId, { status: 'inactive' });
```

### Transactions

```typescript
// Create one-off transaction
const tx = await client.transactions.create({
  customer_id: customerId,
  amount: '1000.00',
  source_asset: 'USDC',
  source_network_id: 'ethereum-mainnet',
  destination_id: destinationId,
  destination_asset: 'USD',
  destination_payment_rail: 'ach',
  payment_reference: 'Invoice #12345', // optional
});
console.log(tx.crypto_address); // Send USDC here
console.log(tx.status);

// List transactions
for await (const tx of client.transactions.list()) {
  console.log(tx.id, tx.status, tx.amount);
}

// List with filters
const completed = client.transactions.list({
  customer_id: customerId,
  status: 'completed',
});

// Wallet-scoped filters (ENG-2368). Require transaction_type: 'wallet'.
//  - wallet_id — filter to one wallet
//  - direction — 'out' = sent FROM the wallet, 'in' = received TO it
const sentFromWallet = client.transactions.list({
  transaction_type: 'wallet',
  wallet_id: walletId,
  direction: 'out',
});

// Get transaction
const tx = await client.transactions.get(transactionId);

// Cancel transaction (only pending)
const cancelled = await client.transactions.cancel(transactionId);
```

### Auto Transactions

```typescript
// List auto transactions
for await (const tx of client.autoTransactions.list()) {
  console.log(tx);
}

// Get auto transaction
const tx = await client.autoTransactions.get(autoTransactionId);
```

### Wallets

```typescript
// Create wallet
const wallet = await client.wallets.create({
  customer_id: customerId,
  family: 'evm',
  name: 'Treasury Wallet',
});
console.log(wallet.address);

// Get a single wallet
const wallet = await client.wallets.get(walletId);

// Get balances — returns the full WalletBalances envelope from the
// platform: { wallet_id, address, balances, total_amount_usd }.
const { address, total_amount_usd, balances } =
  await client.wallets.getBalances(walletId);
console.log(`${address} → $${total_amount_usd}`);
for (const b of balances) {
  console.log(b.asset.id, b.amount_usd);
}

// Get policies attached to a wallet
const attachedPolicies = await client.wallets.getPolicies(walletId);
for (const policy of attachedPolicies) {
  console.log(policy.id, policy.name);
}

// Send a transaction from a wallet — requires an EndorsedRequest
// envelope (`{ signatures, intent }`). Build the SendTransactionIntent,
// canonicalize per RFC 8785, sign with the wallet's signer-group ECDSA
// P-256 key, base64-encode the DER signature, then post the envelope.
import canonicalize from 'canonicalize';
import { createSign, createPrivateKey, randomUUID } from 'node:crypto';

const intent = {
  wallet_id: walletId,
  caip2: 'eip155:1',                 // 11155111 for sepolia
  operation: {
    kind: 'transfer',
    from: wallet.address,
    to: '0x...',
    amount: '100.00',
    asset_id: 'USDC',
  },
  idempotency_key: randomUUID(),
};
const canonical = canonicalize(intent)!;
const sig = createSign('SHA256').update(canonical).sign({
  key: createPrivateKey({ key: privateKeyDer, format: 'der', type: 'pkcs8' }),
  dsaEncoding: 'der',
});
const tx = await client.wallets.createTransaction(walletId, {
  signatures: [sig.toString('base64')],
  intent,
});
```

### Events

```typescript
// List events
for await (const event of client.events.list()) {
  console.log(event.type, event.data);
}

// Filter by type
const customerEvents = client.events.list({ event_type: 'customer.created' });

// Get event
const event = await client.events.get(eventId);
```

### Applications (KYB)

```typescript
// List applications
for await (const app of client.applications.list()) {
  console.log(app);
}

// Get application
const app = await client.applications.get(applicationId);

// Submit for review
const submitted = await client.applications.submit(applicationId);

// Add associated individual
const individual = await client.applications.addIndividual(applicationId, {
  first_name: 'John',
  last_name: 'Doe',
  email: 'john@example.com',
  role: 'beneficial_owner',
});

// List individuals
for await (const ind of client.applications.listIndividuals(applicationId)) {
  console.log(ind);
}

// Update business details
await client.applications.updateBusinessDetails(applicationId, {
  business_name: 'Acme Corp',
  // ... other fields
});

// Get document upload URL
const { upload_url, document_id } = await client.applications.getDocumentUploadUrl(
  applicationId,
  { document_type: 'articles_of_incorporation', file_name: 'articles.pdf' }
);
```

### Policies

```typescript
// Create policy
const policy = await client.policies.create({
  name: 'Daily Limit',
  description: 'Limits daily transfers',
});

// List policies
for await (const policy of client.policies.list()) {
  console.log(policy);
}

// Get policy
const policy = await client.policies.get(policyId);

// Delete policy
await client.policies.delete(policyId);

// Add rule
const rule = await client.policies.addRule(policyId, {
  type: 'daily_limit',
  limit: '10000.00',
});

// Attach to wallet
await client.policies.attachToWallet(policyId, walletId);

// Detach from wallet
await client.policies.detachFromWallet(policyId, walletId);

// List wallets attached to this policy
const policyWallets = await client.policies.getWallets(policyId);
for (const w of policyWallets) {
  console.log(w.id, w.name, w.family);
}
```

### Signer Groups

```typescript
// Create signer group
const group = await client.signerGroups.create({
  name: 'Approvers',
  threshold: 2,
});

// List signer groups
for await (const group of client.signerGroups.list()) {
  console.log(group);
}

// Add signer
const signer = await client.signerGroups.addSigner(groupId, {
  public_key: '0x...',
  name: 'Alice',
});

// Attach to wallet
await client.signerGroups.attachToWallet(walletId, groupId);

// Detach from wallet
await client.signerGroups.detachFromWallet(walletId, groupId);

// List wallets attached to this signer group
const groupWallets = await client.signerGroups.getWallets(groupId);
for (const w of groupWallets) {
  console.log(w.id, w.name, w.family);
}

// Get a group including the signers that were REMOVED from it
const withHistory = await client.signerGroups.get(groupId, { include_removed: true });
for (const s of withHistory.removed_members ?? []) {
  console.log(s.name, 'removed at', s.removed_at);
}

// Remove a signer from a group — takes the KSUID `signer_id`, NOT the
// public key (client.signers.delete() is the one that takes a public key).
await client.signerGroups.removeSigner(groupId, signerId);
```

### Signers

```typescript
// List all signers
for await (const signer of client.signers.list()) {
  console.log(signer.public_key);
}

// Get signer by public key
const signer = await client.signers.getByPublicKey(publicKey);

// Delete signer by public key
await client.signers.delete(publicKey);
```

### API Keys

```typescript
// Create API key
const { id, secret } = await client.apiKeys.create({
  name: 'Production Key',
});
// secret is only shown once!

// List API keys
for await (const key of client.apiKeys.list()) {
  console.log(key.name, key.created_at);
}

// Delete API key
await client.apiKeys.delete(keyId);
```

### Users

```typescript
// Create user
const user = await client.users.create({
  email: 'user@example.com',
  role: 'admin',
});

// List users
for await (const user of client.users.list()) {
  console.log(user.email);
}

// Get user
const user = await client.users.get(userId);

// Update user
const updated = await client.users.update(userId, { role: 'viewer' });

// Delete user
await client.users.delete(userId);
```

### Webhooks

```typescript
// Create webhook target
const target = await client.webhooks.createTarget({
  url: 'https://example.com/webhooks',
  events: ['customer.created', 'transaction.*'],
});

// List targets
for await (const target of client.webhooks.listTargets()) {
  console.log(target.url);
}

// Update target
const updated = await client.webhooks.updateTarget(targetId, {
  events: ['*'],
});

// Delete target
await client.webhooks.deleteTarget(targetId);

// List webhook events
for await (const event of client.webhooks.listEvents()) {
  console.log(event);
}

// Replay event
await client.webhooks.replayEvent(eventId);
```

### Info (Capabilities)

```typescript
// Get supported countries
const countries = await client.info.getCountries();

// Get supported networks
const networks = await client.info.getNetworks();
for (const network of networks) {
  console.log(network.id, network.name);
}
```

### Sandbox (Testing)

```typescript
// Simulate inbound deposit
const result = await client.sandbox.simulateInbound({
  account_id: accountId,
  amount: '1000.00',
});

// Simulate KYB approval (requires application_id from customer creation)
const result = await client.sandbox.simulateOnboarding({
  type: 'kyb_approve',        // or 'kyb_reject', 'applicant_activate'
  applicant_id: applicationId,
  simulation_id: 'sim_' + Date.now(),
});

// Get simulation
const sim = await client.sandbox.getSimulation(simulationId);

// Advance simulation
const advanced = await client.sandbox.advanceSimulation(simulationId);

// List scenarios
for await (const scenario of client.sandbox.listScenarios()) {
  console.log(scenario);
}
```

### Agentic Payments (Alpha)

> `x-alpha`, flag-gated: endpoints 404 unless enabled for your key. May change without a major-version bump.

```typescript
// Provision a hosted agent and endorse it onto a wallet.
const agent = await client.paymentAgents.create({
  customer_id: customerId,
  name: 'Bill Pay',
  hosted: true,
});
await client.attachUserToWallet(walletId, agent.signer_public_key!, spendingGroupId);
// Inverse (revoke spend permission from the one group you attached):
await client.detachUserFromWallet(walletId, agent.signer_public_key!, spendingGroupId);
// Both accept { idempotencyKey } as a final options arg for durable retries.

// Draft payments from natural language (stateless multi-turn chat).
// Send `timezone` on EVERY turn (the server is stateless) so "tomorrow" and
// "10 am" resolve in the customer's local time rather than UTC.
//
// Turns default to a 180s deadline, not the client's ordinary 15s: a turn is
// a sequence of model calls, so a multi-payee request runs minutes. Pass
// `{ timeout }` for longer turns — and note that an explicit client-wide
// `timeout` WINS over this default, so a client built with a short global
// timeout must raise it here or turns will be cut off.
const conv = client.newAgentConversation(agent.id!, {
  timezone: 'America/Los_Angeles',
});

// A multi-payee turn legitimately runs minutes. Poll for a progress line to
// show under the spinner — advisory display ONLY, never gate behaviour on it.
const poll = setInterval(async () => {
  const p = await client.paymentAgents.getProposalsProgress(agent.id!);
  if (p.active) console.log(`${p.phase}: ${p.detail}`);
}, 3000);

const turn = await conv
  .send('Pay Alice 100 USDC on base-mainnet every month')
  .finally(() => clearInterval(poll));

// BLOCKERS are for your APPLICATION; `reply` is for the customer. They
// ACCOMPANY proposals rather than replacing them — the common case is a
// payee who does not exist yet, where the turn proposes creating them AND
// reports that the limit will not reach them. You have to do both, in that
// order: accept the proposal so the payee gets an id, then amend the limit.
for (const b of turn.blockers) {
  switch (b.code) {
    case 'mandate_does_not_cover_payee':
      // Actionable: amend the limit to ADD b.payee_name as a target. That
      // changes nothing else, so it can never raise the limit.
      openLimitEditor(b.mandate_id, b.payee_name);
      break;
    case 'no_mandate':
      // Nothing to amend — the customer must establish a limit first.
      openLimitCreation();
      break;
    default:
      break; // Ignore codes you don't know; new ones are added over time.
  }
}
if (turn.hasProposals) {
  // Accept proposals -> persisted instructions (+ drafted mandates to sign).
  const result = await client.instructions.create({
    payment_agent_id: agent.id!,
    proposals: turn.proposals,
  });

  // Sign + approve each drafted mandate (§8). The SDK never holds keys.
  const signer = P256MandateSigner.generate(); // HSM/KMS in production
  for (const mandate of result.mandates ?? []) {
    await client.mandates.approve(mandate.id!, {
      approver_public_key: signer.publicKeyBase64(),
      signature: signer.sign(mandateSignPayload(mandate, 'approve')),
    });
  }
}

// Inspect schedules; cancel one.
for await (const sp of client.scheduledPayments.list({ customer_id: customerId })) {
  console.log(sp.status, sp.amount, sp.asset);
  // Audit stamp: mandate_id alone no longer identifies the caps the payment
  // was judged against — a mandate's rule can be amended — so mandate_version
  // rides along. Resolve it via mandates.listVersions().
  console.log(sp.mandate_id, sp.mandate_version);
}

// BEFORE scheduling: how much of the standing limit is actually left?
// Without this, an over-budget payment is only discovered when the gate
// denies it at its due date — days later, with the payee unpaid.
const budget = await client.mandates.getBudget(mandateId);
for (const line of [...budget.per_target, ...budget.aggregate]) {
  // ABSENT remaining_* means "not capped", never "nothing left".
  // remaining_amount === '?' means the figure could not be summed and MUST
  // be treated as NO headroom — the gate fails closed on the same data.
  console.log(line.target || '(all payees)', line.bucket, line.remaining_amount ?? 'uncapped');
}

// Amend a mandate: append a NEW signed version WITHOUT resetting the spend
// already made in the current window. Usage accrues to the MANDATE, so an
// agent that has spent 9,000 of a 10,000 monthly cap and is amended to
// 20,000 has 11,000 left — not 20,000. (Cancel-then-create silently gave a
// fresh budget; this is why amend exists.)
//
// The rule is stored and verified VERBATIM — the endpoint never normalizes
// it. It must already be canonical: `window` present (send 'NONE' for a
// lifetime window), `targets` as recipient ids, `asset` uppercase. And
// target_type/window/asset/network_id must match the current version — only
// the amount fields and targets may differ.
const m = await client.mandates.get(mandateId);
const nextVersion = (m.version ?? 1) + 1;
const newRule = { ...m.rule!, max_amount_in_window: '20000' };
await client.mandates.amend(mandateId, {
  signer_public_key: signer.publicKeyBase64(),
  // Commits to the VERSION, so a v2 signature can never be replayed as v3.
  signature: signer.sign(mandateAmendSignPayload(m, nextVersion, newRule)),
  rule: newRule,
});

// Append-only version history — what makes a payment's mandate_version legible.
for (const v of await client.mandates.listVersions(mandateId)) {
  console.log(v.version, v.approved_by_signer_id, v.rule?.max_amount_in_window);
}

// Register the vocabulary the agent speaks for YOUR product — once, not per
// request. Without it the agent narrates in platform nouns ("destination",
// "mandate"). Passing `clientPolicy` per conversation also works but is a
// development override: forget it and it fails SILENTLY.
await client.agenticPolicy.set({
  payee_model: 'flat', // one entry per payout method, not one payee with N methods
  payout_assets: ['USDC', 'USDT'], // what a PAYEE may receive — state it when
  // your funding asset is never a payout
  labels: { limit: 'spending limit', payee: 'recipient', limit_unit: 'USD' },
  payout_route: 'conversion_account_only', // every payment funds a conversion account
  mandate_strategy: 'external_only', // limits live in YOUR editor; the agent never drafts one
});
// Full replace, not a merge — `{}` clears the registration. Validation is
// strict, so an unknown key or an unimplemented label concept is a 400 HERE
// rather than a surprise on a customer's first conversation.

// Declare your developer fee PER PAYOUT TYPE when accepting proposals. The
// two rates are independent — omit one and that payout type carries no fee,
// and the agent is told nothing about a fee it could mention.
await client.instructions.create({
  payment_agent_id: agent.id!,
  proposals: turn.proposals,
  developer_fee: { swap_bps: 50, offramp_bps: 25 },
});

// Read-only account insights.
const report = await client.insights.get(customerId);
```

Failures of scheduled payments surface as the `scheduled_payment.failed` webhook (`ScheduledPaymentFailedData`); successful fires emit the standard `wallet.transaction.created`.

## Webhook Handling

```typescript
import { WebhookHandler, WebhookEventType } from '@dakota-xyz/ts-sdk/webhook';

const handler = new WebhookHandler({
  publicKey: process.env.WEBHOOK_PUBLIC_KEY!,
  timestampTolerance: 300, // 5 minutes (default)
});

// Register handlers
handler.on(WebhookEventType.CustomerCreated, async (event) => {
  console.log('Customer created:', event.data.object);
});

handler.on('transaction.*', async (event) => {
  console.log('Transaction event:', event.type, event.data.object);
});

handler.onDefault(async (event) => {
  console.log('Unhandled event:', event.type);
});

// Express middleware
import express from 'express';
const app = express();

app.post(
  '/webhooks/dakota',
  express.raw({ type: 'application/json' }),
  handler.expressMiddleware()
);

// Or manual handling
app.post('/webhooks', async (req, res) => {
  try {
    const event = await handler.handleRequest(req.body, req.headers);
    res.status(200).send('OK');
  } catch (error) {
    res.status(400).send(error.message);
  }
});
```

## Error Handling

```typescript
import { DakotaClient, APIError, TransportError } from '@dakota-xyz/ts-sdk';

try {
  await client.customers.get('invalid');
} catch (error) {
  if (error instanceof APIError) {
    console.log('Status:', error.statusCode);
    console.log('Code:', error.code);
    console.log('Message:', error.message);
    console.log('Request ID:', error.requestId);
    console.log('Retryable:', error.retryable);
    console.log('Details:', error.details);
  }
  if (error instanceof TransportError) {
    console.log('Transport error:', error.message);
    console.log('Cause:', error.cause);
  }
}
```

## Environments

| Environment | URL | Use Case |
|-------------|-----|----------|
| Sandbox (default) | `https://api.platform.sandbox.dakota.xyz` | Testing |
| Production | `https://api.platform.dakota.xyz` | Live transactions |

## Networks

| Network | Production ID | Sandbox ID |
|---------|---------------|------------|
| Ethereum | `ethereum-mainnet` | `ethereum-sepolia` |
| Polygon | `polygon-mainnet` | `polygon-amoy` |
| Arbitrum | `arbitrum-mainnet` | `arbitrum-sepolia` |
| Base | `base-mainnet` | `base-sepolia` |
| Optimism | `optimism-mainnet` | - |
| Solana | `solana-mainnet` | `solana-devnet` |

## Retryable Status Codes

| Code | Meaning | Retryable |
|------|---------|-----------|
| 429 | Rate Limited | Yes |
| 500 | Internal Error | Yes |
| 502 | Bad Gateway | Yes |
| 503 | Service Unavailable | Yes |
| 504 | Gateway Timeout | Yes |
| 400 | Bad Request | No |
| 401 | Unauthorized | No |
| 403 | Forbidden | No |
| 404 | Not Found | No |

## Transaction Tracking Patterns

When a user sends crypto to a Dakota off-ramp address, Dakota detects the deposit and creates a transaction. There are two ways to track transactions:

### Pattern 1: Webhooks (Recommended)

Dakota sends webhooks when transactions are created/updated. Set up a webhook endpoint:

```typescript
import { WebhookHandler } from '@dakota-xyz/ts-sdk/webhook';

const handler = new WebhookHandler({
  publicKey: process.env.DAKOTA_WEBHOOK_PUBLIC_KEY!,
});

// Transaction created (deposit detected)
handler.on('auto_transaction.created', async (event) => {
  const tx = event.data.object;
  await db.transactions.create({
    dakota_tx_id: tx.id,
    account_id: tx.account_id,
    amount: tx.source_amount,
    status: tx.status, // 'pending'
  });
});

// Transaction updated (status changed)
handler.on('auto_transaction.updated', async (event) => {
  const tx = event.data.object;
  await db.transactions.update({
    where: { dakota_tx_id: tx.id },
    data: { status: tx.status }, // 'processing' -> 'completed'
  });
});

// Express endpoint
app.post('/webhooks/dakota', express.raw({ type: 'application/json' }), handler.expressMiddleware());
```

Register your webhook URL with Dakota:

```typescript
await client.webhooks.createTarget({
  url: 'https://your-app.com/webhooks/dakota',
  events: ['auto_transaction.*'],
});
```

### Pattern 2: Polling

Poll the API periodically to check for new/updated transactions:

```typescript
async function syncTransactions(accountId: string) {
  const txs = await client.transactions.list({ account_id: accountId }).toArray();

  for (const tx of txs) {
    await db.transactions.upsert({
      where: { dakota_tx_id: tx.id },
      create: {
        dakota_tx_id: tx.id,
        account_id: tx.account_id,
        amount: tx.amount,
        status: tx.status,
      },
      update: { status: tx.status },
    });
  }
}

// Poll every 30 seconds
setInterval(() => syncTransactions('acc_xxx'), 30000);
```

### Transaction Status Flow

```
pending → processing → completed
                    → failed
```

| Status | Meaning |
|--------|---------|
| `pending` | Deposit detected, awaiting confirmation |
| `processing` | Converting crypto → fiat, initiating bank transfer |
| `completed` | Funds sent to bank account |
| `failed` | Transaction failed |

### Environment Differences

| Environment | How Deposits Work |
|-------------|-------------------|
| **Production** | Dakota monitors blockchain, detects deposits in 2-10 minutes |
| **Sandbox** | No blockchain monitoring. Use simulation API (see below) |

### Sandbox: Simulating Transactions

Sandbox does NOT monitor testnet blockchains. Use the simulation API instead:

```typescript
// For on-ramp accounts (USD → crypto): simulate ACH deposit
await client.sandbox.simulateInbound({
  type: 'ach_inbound',
  account_id: onrampAccountId,
  amount: '1000.00',
  simulation_id: `sim_${Date.now()}`,
});

// For one-off transactions: simulate settlement
await client.sandbox.simulateInbound({
  type: 'ach_outbound_settled',
  movement_id: transactionId,
  simulation_id: `sim_${Date.now()}`,
});
```

**Note:** Off-ramp account crypto deposit simulation is not yet available. Use one-off transactions for testing off-ramp flows in sandbox.
