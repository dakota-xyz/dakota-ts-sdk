# Dakota TypeScript SDK

Official TypeScript SDK for the [Dakota Platform](https://dakota.xyz) - infrastructure for stablecoin payments, on/off-ramps, and non-custodial wallets.

## What is Dakota?

Dakota provides APIs to:

- **On-ramp**: Accept USD bank transfers and deliver stablecoins (USDC/USDT) to blockchain wallets
- **Off-ramp**: Convert stablecoins to USD and deposit to bank accounts via ACH/Wire
- **Swap**: Exchange stablecoins across networks (e.g., USDC on Ethereum → USDT on Polygon)
- **Wallets**: Create non-custodial multi-sig wallets with policy controls

## Install

```bash
npm install dakota-ts-sdk
# or
yarn add dakota-ts-sdk
# or
pnpm add dakota-ts-sdk
```

## Quick Start

```typescript
import { DakotaClient, Environment } from 'dakota-ts-sdk';

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
import { DakotaClient } from 'dakota-ts-sdk';

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
  bank_name: 'Chase Bank',
  account_holder_name: 'Acme Corporation',
  account_number: '123456789',
  routing_number: '021000021',
  account_type: 'checking',
});

console.log(`Created bank destination: ${bankDest.id}`);

// Step 4: Create an off-ramp account
// Dakota returns a crypto address where customer sends USDC
const account = await client.accounts.create({
  account_type: 'offramp',
  customer_id: customerId,
  destination_id: bankDest.id,
  source_asset: 'USDC',
  source_network_id: 'ethereum-mainnet',
  destination_asset: 'USD',
  destination_rail: 'ach',
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
  crypto_address: '0x742d35Cc6634C0532925a3b844Bc9e7595f...',
  network_id: 'ethereum-mainnet',
});

// Step 4: Create an on-ramp account
// Dakota returns bank details where customer sends USD
const onramp = await client.accounts.create({
  account_type: 'onramp',
  customer_id: customerId,
  destination_id: cryptoDest.id,
  source_asset: 'USD',
  source_rail: 'ach',
  destination_asset: 'USDC',
  destination_network_id: 'ethereum-mainnet',
});

console.log('Send USD to:');
console.log(`  Bank: ${onramp.bank_name}`);
console.log(`  Routing: ${onramp.routing_number}`);
console.log(`  Account: ${onramp.account_number}`);

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

## Handling Webhooks

Dakota sends webhooks for all status changes. Set up a handler:

```typescript
import express from 'express';
import { WebhookHandler, WebhookEventType } from 'dakota-ts-sdk/webhook';

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

// Iterate transactions with filters
const completedTxs = client.transactions.list({
  customer_id: customerId,
  status: 'completed',
});
```

## Error Handling

```typescript
import { DakotaClient, APIError, TransportError } from 'dakota-ts-sdk';

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
import { DakotaClient, Environment, AuthMode } from 'dakota-ts-sdk';

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

  // Custom timeout (default: 15000ms)
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
| `customers.get(id)` | Get customer by ID |

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
| `transactions.list(params?)` | List transactions |
| `transactions.get(id)` | Get transaction by ID |
| `transactions.cancel(id)` | Cancel pending transaction |

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
| `policies.update(id, data)` | Update policy |
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
| `signerGroups.get(id)` | Get signer group by ID |
| `signerGroups.update(id, data)` | Update signer group |
| `signerGroups.addSigner(groupId, data)` | Add signer to group |
| `signerGroups.removeSigner(groupId, signerId)` | Remove signer |
| `signerGroups.attachToWallet(walletId, groupId)` | Attach to wallet |
| `signerGroups.detachFromWallet(walletId, groupId)` | Detach from wallet |

### Signers

Manage individual signers.

| Method | Description |
|--------|-------------|
| `signers.list(params?)` | List all signers |
| `signers.getByPublicKey(publicKey)` | Get signer by public key |

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

### Sandbox

Test simulations (sandbox environment only).

| Method | Description |
|--------|-------------|
| `sandbox.simulateInbound(data)` | Simulate inbound deposit |
| `sandbox.simulateOnboarding(data)` | Simulate KYB completion |
| `sandbox.getSimulation(id)` | Get simulation by ID |
| `sandbox.advanceSimulation(id)` | Advance simulation state |
| `sandbox.listScenarios(params?)` | List available scenarios |

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

## License

MIT
