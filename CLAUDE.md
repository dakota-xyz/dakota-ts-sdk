# Claude Code Instructions for Dakota TypeScript SDK

## Project Overview

This is the official TypeScript SDK for Dakota Platform - a stablecoin payments infrastructure.

**Main capabilities:**
- On-ramp (USD → crypto)
- Off-ramp (crypto → USD)
- Swap (crypto ↔ crypto)
- Non-custodial wallets

## Code Organization

```
src/
├── index.ts                 # Main exports
├── client/
│   ├── client.ts            # DakotaClient class
│   ├── config.ts            # Configuration & validation
│   ├── environment.ts       # Sandbox/Production URLs
│   ├── errors.ts            # APIError, TransportError, ConfigurationError
│   ├── pagination.ts        # PaginatedIterator, async iteration
│   ├── transport.ts         # HTTP transport (fetch wrapper, retry, auth)
│   ├── types.ts             # SDK-friendly type aliases
│   └── resources/           # API resource classes
│       ├── customers.ts     # Customers API
│       ├── recipients.ts    # Recipients API
│       ├── destinations.ts  # Destinations API
│       ├── accounts.ts      # Accounts API
│       ├── transactions.ts  # Transactions API
│       ├── wallets.ts       # Wallets API
│       ├── events.ts        # Events API
│       ├── applications.ts  # Applications/KYB API
│       ├── policies.ts      # Policies API
│       ├── signer-groups.ts # Signer Groups API
│       ├── api-keys.ts      # API Keys API
│       ├── users.ts         # Users API
│       ├── webhooks.ts      # Webhooks API
│       ├── info.ts          # Capabilities Info API
│       └── sandbox.ts       # Sandbox Simulation API
├── generated/
│   └── api.ts               # Generated from OpenAPI (don't edit manually)
├── webhook/
│   ├── handler.ts           # WebhookHandler class
│   ├── signature.ts         # Ed25519 signature verification
│   ├── events.ts            # Event types and parsing
│   └── idempotency.ts       # In-memory idempotency store
└── utils/
    └── index.ts             # Utility functions
```

## When Helping Users

### For Integration Questions
1. Read `README.md` for examples
2. Read `AGENTS.md` for API reference
3. Check `src/generated/api.ts` for available types

### For API Method Questions
All resources follow the pattern:
```typescript
client.{resource}.list(params?)        // Returns PaginatedIterator
client.{resource}.get(id)              // Returns single item
client.{resource}.create(data)         // Creates new item
client.{resource}.update(id, data)     // Updates item
client.{resource}.delete(id)           // Deletes item
```

### For Environment Questions
- Default: Sandbox (`https://api.platform.sandbox.dakota.xyz`)
- Production: Set `environment: Environment.Production`

### For Error Handling
Always catch `APIError` and `TransportError`:
```typescript
import { DakotaClient, APIError, TransportError } from 'dakota-ts-sdk';

try {
  await client.customers.get(id);
} catch (error) {
  if (error instanceof APIError) {
    console.log(error.statusCode);  // HTTP status
    console.log(error.code);        // Machine-readable code
    console.log(error.message);     // Human-readable message
    console.log(error.requestId);   // For support tickets
    console.log(error.retryable);   // Safe to retry?
  }
  if (error instanceof TransportError) {
    console.log(error.message);     // Network error details
    console.log(error.cause);       // Underlying error
  }
}
```

## Resource Dependency Chain

```
Customer (needs KYB approval first)
  └── Recipient
      └── Destination (bank or crypto wallet)
          └── Account (onramp/offramp/swap)
```

## Regenerating Types

If OpenAPI spec changes:
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
npm run build         # Build ESM + CJS
npm run typecheck     # Type check only
```

## Key Patterns

### Pagination
```typescript
// Async iteration
for await (const customer of client.customers.list()) {
  console.log(customer);
}

// Collect all
const all = await client.customers.list().toArray();

// Get first
const first = await client.customers.list().first();
```

### Webhooks
```typescript
import { WebhookHandler } from 'dakota-ts-sdk/webhook';

const handler = new WebhookHandler({ publicKey: 'hex_key' });
handler.on('customer.created', async (event) => { /* ... */ });
handler.on('transaction.*', async (event) => { /* wildcard */ });
handler.onDefault(async (event) => { /* fallback */ });
```

### Configuration Options
```typescript
const client = new DakotaClient({
  apiKey: 'required',                    // API key
  applicationToken: 'optional',          // For /applications endpoints
  environment: Environment.Production,   // Sandbox by default
  timeout: 30000,                        // Request timeout (ms)
  retryPolicy: {
    maxAttempts: 5,
    initialBackoffMs: 100,
    maxBackoffMs: 5000,
  },
  automaticIdempotency: true,            // Auto-generate POST idempotency keys
  logger: console,                       // Optional logger
});
```
