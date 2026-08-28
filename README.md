# Dakota TypeScript SDK

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://img.shields.io/npm/v/@dakota-xyz/ts-sdk)](https://www.npmjs.com/package/@dakota-xyz/ts-sdk)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)

Official TypeScript SDK for the [Dakota Platform](https://dakota.xyz) - infrastructure for stablecoin payments, on/off-ramps, and non-custodial wallets.

## What is Dakota?

Dakota provides APIs to:

- **On-ramp**: Accept USD bank transfers and deliver stablecoins (USDC/USDT) to blockchain wallets
- **Off-ramp**: Convert stablecoins to USD and deposit to bank accounts via ACH/Wire
- **Swap**: Exchange stablecoins across networks (e.g., USDC on Ethereum → USDT on Polygon)
- **Wallets**: Create non-custodial multi-sig wallets with policy controls

## Install

```bash
npm install @dakota-xyz/ts-sdk
# or
yarn add @dakota-xyz/ts-sdk
# or
pnpm add @dakota-xyz/ts-sdk
```

## Quick Start

```typescript
import { DakotaClient, Environment } from '@dakota-xyz/ts-sdk';

const client = new DakotaClient({
  apiKey: 'your_api_key',
  // Sandbox by default. For production:
  // environment: Environment.Production,
});

// List your customers
for await (const customer of client.customers.list()) {
  console.log(`Customer: ${customer.name} (KYB: ${customer.kyb_status})`);
}
```

## Complete Flow: Off-Ramp (Crypto → USD)

This example shows a complete off-ramp flow where a customer sends USDC and receives USD in their bank account.

```typescript
import { DakotaClient } from '@dakota-xyz/ts-sdk';

const client = new DakotaClient({ apiKey: 'your_api_key' });

// Step 1: Create a customer (triggers KYB onboarding)
const customerResp = await client.customers.create({
  name: 'Acme Corporation',
  customer_type: 'business',
  external_id: 'acme-123', // Your internal ID
});

const customerId = customerResp.id;
console.log(`Created customer: ${customerId}`);
console.log(`KYB onboarding URL: ${customerResp.application_url}`);

// Customer completes KYB at the onboarding URL...
// You'll receive webhooks as status changes.
// Wait until kyb_status becomes "active" before proceeding.

// Step 2: Create a recipient (the entity receiving USD)
const recipient = await client.recipients.create(customerId, {
  name: 'Acme Treasury',
});

const recipientId = recipient.id;
console.log(`Created recipient: ${recipientId}`);

// Step 3: Create a bank destination (where USD will be sent)
const bankDest = await client.destinations.create(recipientId, {
  destination_type: 'fiat_us',
  name: 'Primary Bank Account',
  bank_name: 'Chase Bank',
  account_holder_name: 'Acme Corporation',
  account_number: '123456789',
  aba_routing_number: '021000021',
  account_type: 'checking',
});

console.log(`Created bank destination: ${bankDest.id}`);

// Step 4: Create an off-ramp account
// Dakota returns a crypto address where customer sends USDC
const account = await client.accounts.create({
  account_type: 'offramp',
  customer_id: customerId,
  fiat_destination_id: bankDest.id,
  asset: 'USDC',
  network_id: 'ethereum-mainnet',
  rail: 'ach',
  capabilities: ['ach'],
});

console.log('Off-ramp account created!');
console.log(`Send USDC to: ${account.crypto_address}`);

// When customer sends USDC to this address:
// 1. Dakota detects the deposit
// 2. Converts USDC to USD
// 3. Initiates ACH transfer to the bank account
// 4. You receive webhook notifications at each step
```

## Complete Flow: On-Ramp (USD → Crypto)

Accept USD bank transfers and deliver stablecoins to customer wallets.

```typescript
// Step 1: Create customer (same as off-ramp)
// Step 2: Create recipient

// Step 3: Create a crypto destination (where stablecoins will be sent)
const cryptoDest = await client.destinations.create(recipientId, {
  destination_type: 'crypto',
  name: 'Crypto Wallet',
  address: '0x742d35Cc6634C0532925a3b844Bc9e7595f...',
  network_id: 'ethereum-mainnet',
});

// Step 4: Create an on-ramp account
// Dakota returns bank details where customer sends USD
const onramp = await client.accounts.create({
  account_type: 'onramp',
  customer_id: customerId,
  crypto_destination_id: cryptoDest.id,
  asset: 'USDC',
  network_id: 'ethereum-mainnet',
  rail: 'ach',
  capabilities: ['ach'],
});

console.log('Send USD to:');
console.log(`  Bank: ${onramp.bank_account.bank_name}`);
console.log(`  Routing: ${onramp.bank_account.aba_routing_number}`);
console.log(`  Account: ${onramp.bank_account.account_number}`);

// When customer sends USD:
// 1. Dakota receives the bank transfer
// 2. Converts USD to USDC
// 3. Sends USDC to the customer's wallet address
```

## One-Off Transactions

For single transactions without creating accounts:

```typescript
const tx = await client.transactions.create({
  customer_id: customerId,
  amount: '1000.00',
  source_asset: 'USDC',
  source_network_id: 'ethereum-mainnet',
  destination_id: destinationId,
  destination_asset: 'USD',
  destination_payment_rail: 'ach',
  payment_reference: 'Invoice #12345',
});

console.log(`Transaction created: ${tx.id}`);
console.log(`Send ${tx.send_amount} USDC to: ${tx.crypto_address}`);
console.log(`Status: ${tx.status}`);
```

## Agentic Payments (Beta)

> ⚠️ **Beta.** The hosted payment-agent surface is `x-beta` and flag-gated on the platform (endpoints return `404` unless enabled for your key). The SDK helpers below may change — or be removed — without a major-version bump. Not recommended for production.

A **payment agent** is a named, customer-scoped signer Dakota can drive: you provision it, endorse it onto a wallet, then it drafts and — once a **mandate** is signed — fires payments, bounded by that customer-approved mandate.

### 1. Provision an agent and endorse it onto a wallet

```typescript
// Create a hosted payment agent (Dakota custodies its signing key).
const agent = await client.paymentAgents.create({
  customer_id: customerId,
  name: 'Bill Pay',
  hosted: true,
});

// Grant it spend permission on a wallet by adding its signer to the wallet's
// spending group (idempotent) — the customer-endorsed attach. Pass an
// options.idempotencyKey to make the whole helper safely retryable.
await client.attachUserToWallet(walletId, agent.signer_public_key!, spendingGroupId);
```

### 2. Draft payments from natural language

```typescript
const conv = client.newAgentConversation(agent.id!);
const turn = await conv.send('Pay Alice 100 USDC on base-mainnet every month until December');

if (turn.hasProposals) {
  // Review turn.proposals, then accept them through the instructions flow.
  console.log(`agent drafted ${turn.proposals.length} proposal(s)`);
} else {
  console.log('agent needs more detail:', turn.reply);
}
```

### 3. Sign and approve a mandate (§8)

The caller holds the keys; the SDK never does. `P256MandateSigner` is a ready in-memory signer for sandbox/tests — implement the `MandateSigner` interface over your HSM/KMS in production.

```typescript
import { P256MandateSigner, mandateSignPayload } from '@dakota-xyz/ts-sdk';

const signer = P256MandateSigner.generate(); // or P256MandateSigner.fromPrivateKey(yourKey)

// `mandate` comes from client.mandates.get / client.mandates.list.
const payload = mandateSignPayload(mandate, 'approve');
const signature = signer.sign(payload);

await client.mandates.approve(mandate.id!, {
  approver_public_key: signer.publicKeyBase64(),
  signature,
});
```

### 4. Account insights (read-only)

```typescript
// Deterministic report: balances, upcoming payments, mandate headroom, risks.
const report = await client.insights.get(customerId);
```

The full agentic surface is reachable via `client.paymentAgents`, `client.mandates`, `client.instructions`, `client.scheduledPayments`, and `client.insights`.

## Handling Webhooks

Dakota sends webhooks for all status changes. Set up a handler:

```typescript
import express from 'express';
import { WebhookHandler, WebhookEventType } from '@dakota-xyz/ts-sdk/webhook';

const app = express();

const handler = new WebhookHandler({
  publicKey: 'your_webhook_public_key_hex',
});

// Handle specific event types
handler.on(WebhookEventType.CustomerCreated, async (event) => {
  console.log('Customer created:', event.id);
});

handler.on(WebhookEventType.TransactionUpdated, async (event) => {
  console.log('Transaction updated:', event.id);
  // Check transaction status, update your records, notify user, etc.
});

// Wildcard patterns
handler.on('transaction.*', async (event) => {
  console.log('Transaction event:', event.type);
});

// Catch-all for other events
handler.onDefault(async (event) => {
  console.log(`Event: ${event.id} (type: ${event.type})`);
});

app.post(
  '/webhooks/dakota',
  express.raw({ type: 'application/json' }),
  handler.expressMiddleware()
);

app.listen(8080);
```

## Pagination

Iterate through large collections:

```typescript
// Async iteration
for await (const customer of client.customers.list()) {
  console.log(`${customer.id}: ${customer.name}`);
}

// Collect all to array
const allCustomers = await client.customers.list().toArray();

// Get first item only
const firstCustomer = await client.customers.list().first();

// With filters
const activeCustomers = client.customers.list({ kyb_status: 'active' });

// Iterate transactions with filters. The SDK always names the transaction
// family on the wire, so this is that customer's ONE-OFF transactions — a
// raw GET /transactions?customer_id=... would infer the auto_account family
// and return those instead.
const completedTxs = client.transactions.list({
  customer_id: customerId,
  status: 'completed',
});
```

## Error Handling

```typescript
import { DakotaClient, APIError, TransportError } from '@dakota-xyz/ts-sdk';

try {
  const customer = await client.customers.get('invalid_id');
} catch (error) {
  if (error instanceof APIError) {
    console.log(`API Error: ${error.message} (HTTP ${error.statusCode})`);
    console.log(`Error Code: ${error.code}`);
    console.log(`Request ID: ${error.requestId}`); // Include in support tickets

    if (error.retryable) {
      // Safe to retry (429, 503, etc.)
    }

    // Showing the error to a PERSON? `message` names request fields and
    // actions so a machine caller can self-correct. `userMessage` says the
    // same thing without API vocabulary, when the problem carries one.
    showToCustomer(error.userMessage ?? error.message);

    // Some problems carry a link that CLEARS them — today `terms-not-accepted`
    // points at the hosted flow where the agreement can be signed. It is
    // token-gated and usable as-is.
    if (error.resolutionUrl) {
      offerLink(error.resolutionUrl);
    }
  }

  if (error instanceof TransportError) {
    console.log(`Network Error: ${error.message}`);
    console.log(`Cause: ${error.cause}`);
  }
}
```

## Environments

The SDK supports two main environments. **Sandbox is the default** for safe testing.

| Environment | URL | Use Case |
|-------------|-----|----------|
| **Sandbox** (default) | `https://api.platform.sandbox.dakota.xyz` | Testing & development |
| **Production** | `https://api.platform.dakota.xyz` | Live transactions with real money |

```typescript
// Sandbox (default) - safe for testing, no real money moves
const client = new DakotaClient({
  apiKey: 'your_sandbox_api_key',
});

// Production - real money, real transactions
const client = new DakotaClient({
  apiKey: 'your_production_api_key',
  environment: Environment.Production,
});
```

> **Note**: Sandbox and Production use different API keys. Make sure you're using the correct key for each environment.

## Configuration Options

```typescript
import { DakotaClient, Environment, AuthMode } from '@dakota-xyz/ts-sdk';

const client = new DakotaClient({
  // Required: Authentication (at least one)
  apiKey: 'your_api_key',
  applicationToken: 'your_app_token', // For /applications endpoints

  // Environment (default: Sandbox)
  environment: Environment.Production,

  // Or override with custom URL
  baseURL: 'https://custom.api.url',

  // Auth mode (default: Auto)
  authMode: AuthMode.Auto, // Auto, APIKey, or ApplicationToken

  // Custom timeout (default: 15000ms).
  // Setting this applies it to EVERY request, including the model-backed
  // agentic endpoints that otherwise get 180000ms — see "Timeouts" below.
  timeout: 30000,

  // Custom retry policy
  retryPolicy: {
    maxAttempts: 5,
    initialBackoffMs: 100,
    maxBackoffMs: 5000,
  },

  // Automatic idempotency keys for POST (default: true)
  automaticIdempotency: true,

  // Custom idempotency key generator
  idempotencyKeyGenerator: () => crypto.randomUUID(),

  // Structured logging
  logger: console, // or custom logger
});
```

## Timeouts

Requests default to **15s**, which suits ordinary reads and writes. The
agentic endpoints that call a model default to **180s** instead:

| Endpoint | Default |
|---|---|
| Everything else | 15s |
| `paymentAgents.createProposals` / `AgentConversation.send` | 180s |

A drafting turn is a sequence of model calls — read the payees, check
balances, draft, revise — so "pay these nine vendors every Friday"
legitimately runs minutes while "what can you do?" returns at once. Under a
15s deadline the simple turns pass and the complex ones abort client-side,
which looks like flakiness rather than a deadline.

Override it at whichever level fits, most specific first:

```typescript
// Per request — one slow call, everything else untouched. Available on
// every method that takes request options (the mutating ones).
await client.paymentAgents.createProposals(agentId, { prompt }, { timeout: 240_000 });

// Per conversation — every turn of this chat
const conv = client.newAgentConversation(agentId, { timeout: 240_000 });

// Client-wide — applies to EVERYTHING, agentic endpoints included
const client = new DakotaClient({ apiKey, timeout: 30_000 });
```

Precedence is: per-request `timeout` → explicit client `timeout` → endpoint
default → 15s. Note the third row: **an explicit client-wide `timeout` wins
over the long agentic default**, because a deadline you configured is a
choice the SDK should not overrule. If you set a short global timeout and
also use agent conversations, raise it per conversation.

Two more things worth knowing:

- The deadline is **per attempt**, not per call. A timing-out request is
  retried per `retryPolicy`, so budget roughly `timeout × maxAttempts`.
- A timeout raises `TransportError` naming the elapsed deadline and how to
  change it. It is a client-side abort, not a server error — the server may
  well still be completing the work.
- Per-request `timeout` rides on `RequestOptions`, so it is available on the
  methods that accept them. Plain `get` / `list` reads do not take options
  yet; use the client-wide setting for those.

## Idempotency Keys

Dakota requires idempotency keys (**must be valid UUIDs**) for all `POST`, `PUT`, and `PATCH` requests to ensure safe retries. By default, the SDK auto-generates UUID keys for you, but you can provide your own for deterministic API calls:

```typescript
import { v4 as uuid, v5 as uuidv5 } from 'uuid';

// Auto-generated idempotency key (default behavior)
const customer = await client.customers.create({
  name: 'Acme Corp',
  customer_type: 'business',
});

// Custom UUID idempotency key
const customer = await client.customers.create(
  { name: 'Acme Corp', customer_type: 'business' },
  { idempotencyKey: uuid() }
);

// Deterministic UUID from business key (recommended for replay safety)
const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // Your app's namespace
const invoiceId = 'INV-12345';
const txKey = uuidv5(`invoice-${invoiceId}-payment`, NAMESPACE); // Always same UUID for same invoice

const tx = await client.transactions.create(
  {
    customer_id: customerId,
    amount: '1000.00',
    source_asset: 'USDC',
    source_network_id: 'ethereum-mainnet',
    destination_id: destinationId,
    destination_asset: 'USD',
    destination_payment_rail: 'ach',
  },
  { idempotencyKey: txKey }
);

// Retrying with the same key returns the original response
const txRetry = await client.transactions.create(
  { /* same data */ },
  { idempotencyKey: txKey } // Returns cached response, no duplicate created
);
```

### When to Use Custom Idempotency Keys

- **Retry safety**: Use deterministic UUIDs derived from business keys (e.g., `uuidv5('invoice-123', NAMESPACE)`)
- **Distributed systems**: When requests may be retried across different processes
- **Exactly-once semantics**: When you need to guarantee no duplicate side effects

> **Note**: Idempotency keys must be valid UUIDs. Use `uuid` v5 to generate deterministic UUIDs from your business identifiers.

### Disable Auto-Generated Keys

```typescript
const client = new DakotaClient({
  apiKey: 'your_api_key',
  automaticIdempotency: false, // You must provide keys manually
});
```

## Supported Networks

| Network | Production | Sandbox |
|---------|------------|---------|
| Ethereum | `ethereum-mainnet` | `ethereum-sepolia` |
| Polygon | `polygon-mainnet` | `polygon-amoy` |
| Arbitrum | `arbitrum-mainnet` | `arbitrum-sepolia` |
| Base | `base-mainnet` | `base-sepolia` |
| Optimism | `optimism-mainnet` | - |
| Solana | `solana-mainnet` | `solana-devnet` |

---

## API Reference

### Customers

Manage customer entities representing businesses and organizations.

| Method | Description |
|--------|-------------|
| `customers.create(data)` | Create a customer (triggers KYB) |
| `customers.list(params?)` | List all customers (paginated) |
| `customers.listPage(params?)` | One page + `status_counts` for a status header |
| `customers.get(id)` | Get customer by ID |
| `customers.delete(id)` | Soft-delete a customer (blocked if it has accounts) |
| `customers.getCapabilities(id)` | Capabilities + outstanding requirements to unlock each |
| `customers.reEngage(id)` | Mint a fresh application link for an approved customer |
| `customers.bulkImportFromSumsubTokens(data)` | Import from Sumsub share tokens (synchronous) |
| `customers.importPersonaTokens(data)` | Import from Persona Connect share tokens (async job) |
| `customers.listPersonaImportJobs(params?)` | List Persona import jobs, newest first |
| `customers.getPersonaImportJob(jobId, params?)` | Job status + per-token results |

`Customer.status` is the single client-facing status — one value collapsing the
frozen state, the application decision, and the application lifecycle. Filter on
it with `status`, which takes a **comma-separated string**, not an array:

```typescript
const needsAttention = client.customers.list({ status: 'info_requested,frozen' });

// `list()` iterates rows and drops the envelope, so the per-status counts a
// dashboard header renders come from `listPage()` instead. They are computed
// ignoring the `status` selection, so every chip keeps its count while one of
// them is the active filter.
const page = await client.customers.listPage({ limit: 25 });
console.log(page.status_counts?.info_requested ?? 0);
```

`kyb_statuses`, `kyc_statuses` and `application_statuses` take the same
comma-separated form, and `sort_by` / `sort_dir` / `created_at_from` /
`created_at_to` are also accepted.

### Recipients

Manage recipient entities for payouts and transfers.

| Method | Description |
|--------|-------------|
| `recipients.create(customerId, data)` | Create a recipient |
| `recipients.list(customerId, params?)` | List recipients for customer |
| `recipients.get(id)` | Get recipient by ID |
| `recipients.update(id, data)` | Update recipient |

### Destinations

Manage bank accounts and crypto wallet destinations.

| Method | Description |
|--------|-------------|
| `destinations.create(recipientId, data)` | Create destination (bank or crypto) |
| `destinations.list(recipientId, params?)` | List destinations for recipient |

### Accounts

Manage on-ramp, off-ramp, and swap accounts.

| Method | Description |
|--------|-------------|
| `accounts.create(data)` | Create account (onramp/offramp/swap) |
| `accounts.list(params?)` | List accounts |
| `accounts.get(id)` | Get account by ID |
| `accounts.update(id, data)` | Update account |

### Transactions

Create and manage one-off transactions.

| Method | Description |
|--------|-------------|
| `transactions.create(data)` | Create one-off transaction |
| `transactions.list(params?)` | List transactions (see the family table below) |
| `transactions.get(id)` | Get transaction by ID |
| `transactions.cancel(id)` | Cancel pending transaction |

`GET /transactions` serves three resource families from one path, and the
family decides the row shape. `list()` names the family on the wire and types
its rows to match:

| `transaction_type` | Yields | Notes |
|--------------------|--------|-------|
| omitted or `'one_off'` | `OneOffTransaction` | The default |
| `'wallet'` | `WalletTransaction` | Required for the `wallet_id` / `direction` filters |
| `'auto_account'` | `AutoTransaction` | Requires `customer_id` |

Left to the server the family is **inferred** from the other filters, and
`customer_id` on its own infers `auto_account` — so name it, or let the SDK
name `one_off` for you. If a response reports a family other than the one
requested, the iterator throws rather than yielding rows of the wrong shape.

### Auto Transactions

View automated transaction configurations.

| Method | Description |
|--------|-------------|
| `autoTransactions.list(params?)` | List auto transactions |
| `autoTransactions.get(id)` | Get auto transaction by ID |

### Wallets

Manage non-custodial multi-sig wallets.

| Method | Description |
|--------|-------------|
| `wallets.create(data)` | Create wallet |
| `wallets.getBalances(id)` | Get wallet balances |
| `wallets.createTransaction(id, data)` | Create wallet transaction |

### Events

Query platform events for audit trails.

| Method | Description |
|--------|-------------|
| `events.list(params?)` | List events |
| `events.get(id)` | Get event by ID |

### Applications (KYB)

Manage KYB onboarding applications.

| Method | Description |
|--------|-------------|
| `applications.list(params?)` | List applications |
| `applications.get(id)` | Get application by ID |
| `applications.submit(id, data?)` | Submit for review |
| `applications.listIndividuals(id, params?)` | List associated individuals |
| `applications.addIndividual(id, data)` | Add individual |
| `applications.getIndividual(appId, indId)` | Get individual |
| `applications.updateIndividual(appId, indId, data)` | Update individual |
| `applications.deleteIndividual(appId, indId)` | Delete individual |
| `applications.updateBusinessDetails(id, data)` | Update business details |
| `applications.getDocumentUploadUrl(id, data)` | Get document upload URL |

### Policies

Manage transaction policies and rules.

| Method | Description |
|--------|-------------|
| `policies.create(data)` | Create policy |
| `policies.list(params?)` | List policies |
| `policies.get(id)` | Get policy by ID |
| `policies.delete(id)` | Delete policy |
| `policies.addRule(policyId, data)` | Add rule to policy |
| `policies.updateRule(policyId, ruleId, data)` | Update rule |
| `policies.deleteRule(policyId, ruleId)` | Delete rule |
| `policies.attachToWallet(policyId, walletId)` | Attach to wallet |
| `policies.detachFromWallet(policyId, walletId)` | Detach from wallet |

### Signer Groups

Manage multi-party authorization.

| Method | Description |
|--------|-------------|
| `signerGroups.create(data)` | Create signer group |
| `signerGroups.list(params?)` | List signer groups |
| `signerGroups.get(id, params?)` | Get signer group by ID (`{ include_removed: true }` adds `removed_members`) |
| `signerGroups.addSigner(groupId, data)` | Add signer to group |
| `signerGroups.removeSigner(groupId, signerId)` | Remove signer (by KSUID `signer_id`, not public key) |
| `signerGroups.attachToWallet(walletId, groupId)` | Attach to wallet |
| `signerGroups.detachFromWallet(walletId, groupId)` | Detach from wallet |

### Signers

Manage individual signers.

| Method | Description |
|--------|-------------|
| `signers.list(params?)` | List all signers |
| `signers.getByPublicKey(publicKey)` | Get signer by public key |
| `signers.delete(publicKey)` | Delete signer by public key |

### API Keys

Manage API key credentials.

| Method | Description |
|--------|-------------|
| `apiKeys.create(data)` | Create API key (secret shown once) |
| `apiKeys.list(params?)` | List API keys |
| `apiKeys.delete(id)` | Delete API key |

### Users

Manage platform users.

| Method | Description |
|--------|-------------|
| `users.create(data)` | Create user |
| `users.list(params?)` | List users |
| `users.get(id)` | Get user by ID |
| `users.update(id, data)` | Update user |
| `users.delete(id)` | Delete user |

### Webhooks

Manage webhook targets and events.

| Method | Description |
|--------|-------------|
| `webhooks.createTarget(data)` | Create webhook target |
| `webhooks.listTargets(params?)` | List webhook targets |
| `webhooks.getTarget(id)` | Get webhook target by ID |
| `webhooks.updateTarget(id, data)` | Update webhook target |
| `webhooks.deleteTarget(id)` | Delete webhook target |
| `webhooks.listEvents(params?)` | List webhook events |
| `webhooks.getEvent(id)` | Get webhook event by ID |
| `webhooks.replayEvent(id)` | Replay webhook event |

### Info

Query platform capabilities.

| Method | Description |
|--------|-------------|
| `info.getCountries()` | Get supported countries |
| `info.getNetworks()` | Get supported networks |

### Legal Documents

The published terms a customer accepts during onboarding. **Unauthenticated** —
integrators need these before a customer relationship exists, so both calls are
safe from a signup page.

| Method | Description |
|--------|-------------|
| `legal.list()` | The in-force revision of every document, WITHOUT the text |
| `legal.get(key, version?)` | One document's text — the in-force revision, or a specific one |

```typescript
const tos = await client.legal.get('dakota_tos');
render(tos.content);

// Record what the customer actually saw, not whichever revision was current
// when the request landed.
await client.applications.submitAttestation(applicationId, {
  attestation_type: 'terms_of_service',
  legal_document_version: tos.version,
  // ...
});
```

A revision is immutable, so a fetched `(key, version)` can be cached forever.
`legal.list()` is not: it names whichever revision is in force *now*.

To render an acceptance page, `applications.getLegalAcceptance(applicationId)`
returns just what that page needs — the agreements still owed and the people
permitted to accept them — instead of the full KYB record `applications.get()`
would return. The link that reaches it is emailed, so its token is scoped to
this call and the attestation submission.

### RD Marketing Fee

Reserve-management statements for the calling client. The client comes from the
session, so there is no id to pass.

| Method | Description |
|--------|-------------|
| `rdMarketingFee.listMonths()` | The months with a statement, newest first |
| `rdMarketingFee.getStatement(month)` | One month, one row per calendar day |

```typescript
const months = await client.rdMarketingFee.listMonths();
const statement = await client.rdMarketingFee.getStatement(months[0]);

for (const day of statement.daily) {
  // Absent is not zero: absent means the day is not derived yet, '0' means
  // the client genuinely held no RD. Do not render them alike.
  console.log(day.date, day.balance_minor ?? 'not yet derived');
}
```

A client with no contract gets a **404**; an empty month list means the
contract is real but starts later. The running month is included, with its fee
figures absent rather than zero.

### Sandbox

Test simulations (sandbox environment only).

| Method | Description |
|--------|-------------|
| `sandbox.simulateInbound(data)` | Simulate inbound deposit |
| `sandbox.simulateOnboarding(data)` | Simulate KYB completion |
| `sandbox.getSimulation(id)` | Get simulation by ID |
| `sandbox.advanceSimulation(id)` | Advance simulation state |
| `sandbox.listScenarios(params?)` | List available scenarios |

### Fee Payout Destination

Where Dakota pays your accrued developer fees. Exactly one per organization,
and crypto-only — a USDC wallet on any supported chain.

| Method | Description |
|--------|-------------|
| `feePayoutDestination.get()` | Get the registered destination |
| `feePayoutDestination.set(data)` | Register or replace it (emits `fee_payout_destination.updated`) |
| `feePayoutDestination.delete()` | Remove it (emits `fee_payout_destination.deleted`) |

```typescript
await client.feePayoutDestination.set({
  usdc_wallet: {
    chain: 'eip155:8453', // CAIP-2 chain id — see client.info.getNetworks()
    address: '0x1234567890123456789012345678901234567890',
  },
});
```

### Payment Agents (Beta)

Hosted signing agents that draft payments (`x-beta`, flag-gated).

| Method | Description |
|--------|-------------|
| `paymentAgents.create(data)` | Create a payment agent (hosted or key-supplied) |
| `paymentAgents.get(id)` | Get payment agent by ID |
| `paymentAgents.revoke(id)` | Revoke the agent's key (kill switch) |
| `paymentAgents.createProposals(id, data)` | One-shot proposals turn (see `newAgentConversation`) |
| `paymentAgents.getProposalsProgress(id)` | Live progress of an in-flight drafting turn (advisory) |

### Agentic Policy (Beta)

How your product speaks, and what the agent may propose for it. Register it
once and every drafting turn narrates in your nouns instead of the platform's.

| Method | Description |
|--------|-------------|
| `agenticPolicy.get()` | Read your registered policy (404 = none, which is the default) |
| `agenticPolicy.set(policy)` | Register or fully replace it (`{}` clears it) |

```typescript
await client.agenticPolicy.set({
  payee_model: 'flat',
  payout_assets: ['USDC', 'USDT'],
  labels: { limit: 'spending limit', payee: 'recipient', limit_unit: 'USD' },
  payout_route: 'conversion_account_only',
});
```

It is a **full replace, not a merge** — an omitted field means you no longer
want it.

Your developer fee is separate, and belongs in **both** places:

```typescript
// The drafting turn — this is what lets the agent MENTION the fee.
const conv = client.newAgentConversation(agentId, {
  developerFee: { swap_bps: 50, offramp_bps: 25 },
});

// The accept — this is what CHARGES it.
await client.instructions.create({
  payment_agent_id: agentId,
  proposals: turn.proposals,
  developer_fee: { swap_bps: 50, offramp_bps: 25 },
});
```

Declare it only on the accept and the customer approves a summary that never
disclosed a fee, then gets charged it.

Registering is the **only** way to set a policy. It belongs to the client, not
to a request, so a drafting turn and the accept that follows it cannot be
judged by different rules. The per-conversation `clientPolicy` option is gone:
the platform stopped reading `client_policy` from request bodies, and
one sent there is ignored — the agent quietly goes back to saying "destination"
and "mandate" with nothing reporting the fallback.

### Mandates (Beta)

The §8 authorizations that arm scheduled payments.

| Method | Description |
|--------|-------------|
| `mandates.create(data)` | Draft a mandate from a direct user interaction |
| `mandates.list(params?)` | List mandates (filter by customer/signer/status) |
| `mandates.get(id)` | Get mandate by ID (full wire shape for signing) |
| `mandates.approve(id, data)` | Activate with a customer signature |
| `mandates.cancel(id, data)` | Cancel a mandate |
| `mandates.amend(id, data)` | Append a signed NEW version of the rule (keeps window spend) |
| `mandates.listVersions(id)` | Append-only version history, oldest first |
| `mandates.getBudget(id)` | Remaining budget: spent, earmarked, left (advisory) |

### Instructions (Beta)

Accept and inspect actuated proposals.

| Method | Description |
|--------|-------------|
| `instructions.create(data)` | Accept proposals — actuate into persisted instructions |
| `instructions.get(id)` | Get an instruction + its downstream artifacts |

### Scheduled Payments (Beta)

Schedule rows created from instructions (or directly).

| Method | Description |
|--------|-------------|
| `scheduledPayments.create(data)` | Create a schedule directly (signer-first) |
| `scheduledPayments.list(params?)` | List scheduled payments |
| `scheduledPayments.get(id)` | Get scheduled payment by ID |
| `scheduledPayments.cancel(id)` | Cancel an open scheduled payment |

### Insights (Beta)

Read-only advisory reporting over a customer's agentic activity.

| Method | Description |
|--------|-------------|
| `insights.get(customerId)` | Deterministic account insight report |

---

## Webhook Event Types

| Event Type | Description |
|------------|-------------|
| `customer.created` | Customer was created |
| `customer.updated` | Customer was updated |
| `customer.kyb_status_changed` | KYB status changed |
| `recipient.created` | Recipient was created |
| `recipient.updated` | Recipient was updated |
| `destination.created` | Destination was created |
| `account.created` | Account was created |
| `account.updated` | Account was updated |
| `transaction.created` | Transaction was created |
| `transaction.updated` | Transaction was updated |
| `transaction.completed` | Transaction completed |
| `transaction.failed` | Transaction failed |
| `transaction.cancelled` | Transaction was cancelled |
| `wallet.created` | Wallet was created |
| `application.created` | Application was created |
| `application.submitted` | Application was submitted |
| `application.approved` | Application was approved |
| `application.rejected` | Application was rejected |

---

## Regenerating Types

The SDK uses types generated from the OpenAPI spec. To regenerate:

```bash
npm run generate
```

## Testing

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage
```

## Building

```bash
npm run build    # Build ESM + CJS
npm run typecheck # Type check only
```

## Resources

- [Dakota Documentation](https://docs.dakota.xyz)
- [API Reference](https://docs.dakota.xyz/api-reference)
- [Common Flows](https://docs.dakota.xyz/documentation/common-flows)

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details on:

- Reporting bugs and suggesting features
- Development setup and workflow
- Code style and commit conventions
- Pull request process

## License

This project is licensed under the [MIT License](LICENSE).
