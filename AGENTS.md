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

// List customers
for await (const customer of client.customers.list()) {
  console.log(customer.name, customer.kyb_status);
}

// List with filters
const active = client.customers.list({ kyb_status: 'active' });

// Collect all to array
const all = await client.customers.list().toArray();

// Get single customer
const customer = await client.customers.get('cust_abc123');
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

// Create crypto destination (for on-ramp)
const cryptoDest = await client.destinations.create(recipientId, {
  destination_type: 'crypto',
  name: 'Crypto Wallet',
  address: '0x742d35Cc6634C0532925a3b844Bc9e7595f...',
  network_id: 'ethereum-mainnet',
});

// List destinations
for await (const dest of client.destinations.list(recipientId)) {
  console.log(dest);
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

// Get balances
const balances = await client.wallets.getBalances(walletId);
for (const balance of balances) {
  console.log(balance.asset, balance.amount);
}

// Create wallet transaction
const tx = await client.wallets.createTransaction(walletId, {
  to: '0x...',
  amount: '100.00',
  asset: 'USDC',
  network_id: 'ethereum-mainnet',
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

## Webhook Handling

```typescript
import { WebhookHandler, WebhookEventType } from '@dakota-xyz/ts-sdk/webhook';

const handler = new WebhookHandler({
  publicKey: process.env.WEBHOOK_PUBLIC_KEY!,
  timestampTolerance: 300, // 5 minutes (default)
});

// Register handlers
handler.on(WebhookEventType.CustomerCreated, async (event) => {
  console.log('Customer created:', event.data);
});

handler.on('transaction.*', async (event) => {
  console.log('Transaction event:', event.type, event.data);
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
  const tx = event.data;
  await db.transactions.create({
    dakota_tx_id: tx.id,
    account_id: tx.account_id,
    amount: tx.source_amount,
    status: tx.status, // 'pending'
  });
});

// Transaction updated (status changed)
handler.on('auto_transaction.updated', async (event) => {
  const tx = event.data;
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
