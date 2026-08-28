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
│       ├── signer-groups.ts # Signer Groups API (includes Signers)
│       ├── api-keys.ts      # API Keys API
│       ├── users.ts         # Users API
│       ├── webhooks.ts      # Webhooks API
│       ├── info.ts          # Capabilities Info API
│       ├── legal.ts         # Legal documents (unauthenticated)
│       ├── rd-marketing-fee.ts # Reserve-management fee statements
│       ├── fee-payout-destination.ts # Developer-fee payout destination
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
Most resources follow this pattern (but not all methods exist on every resource):
```typescript
client.{resource}.list(params?)        // Returns PaginatedIterator
client.{resource}.get(id)              // Returns single item
client.{resource}.create(data)         // Creates new item
client.{resource}.update(id, data)     // Updates item (not all resources)
client.{resource}.delete(id)           // Deletes item (not all resources)
```

**Resources WITHOUT update():** policies, signerGroups, destinations, apiKeys, autoTransactions, signers
**Resources WITHOUT delete():** transactions, autoTransactions
**Read-only resources:** autoTransactions (list + get only), info (getCountries + getNetworks only), legal, rdMarketingFee

`transactions.list()` is not a plain list: `GET /transactions` serves three
resource families from one path, and the family decides the row shape. The SDK
always names the family on the wire (defaulting to `one_off`) because the
server otherwise INFERS it from the other filters — `customer_id` alone infers
`auto_account`. The element type follows `transaction_type`.

### Additional Resources
- `client.autoTransactions` - List and get automated transactions (created from accounts)
- `client.signers` - Manage individual signers (create, delete)
- `client.selfServe` - Self-serve credits (purchaseCredits, getBalance, listLedger, listTiers)
- `client.feePayoutDestination` - Developer-fee payout destination (get, set, delete). One per
  organization, crypto-only (USDC wallet)
- `client.customers` also carries the onboarding-adjacent surface: `getCapabilities`, `reEngage`,
  `bulkImportFromSumsubTokens` (synchronous) and `importPersonaTokens` /
  `listPersonaImportJobs` / `getPersonaImportJob` (asynchronous job)
- `client.mandates` (BETA) carries `amend` / `listVersions` / `getBudget` alongside
  approve/cancel — see `mandateAmendSignPayload` for the amend signing bytes
- `client.legal` - The published terms customers accept (`list`, `get`).
  UNAUTHENTICATED, so it is callable before a customer relationship exists.
  Pair with `applications.getLegalAcceptance(id)`, which returns just what an
  accept-agreements page needs rather than the whole KYB record
- `client.rdMarketingFee` - Reserve-management statements for the calling
  client (`listMonths`, `getStatement`). No id to pass; the client comes from
  the session
- `client.customers.listPage()` returns one page PLUS `status_counts`, which
  `list()` cannot reach because it iterates rows and drops the envelope

### For Environment Questions
- Default: Sandbox (`https://api.platform.sandbox.dakota.xyz`)
- Production: Set `environment: Environment.Production`

### For Error Handling
Always catch `APIError` and `TransportError`. When relaying an error to a
PERSON, show `error.userMessage ?? error.message` — `message` names request
fields so a machine caller can self-correct, `userMessage` says it without API
vocabulary — and offer `error.resolutionUrl` when present (a token-gated link
that clears the problem):
```typescript
import { DakotaClient, APIError, TransportError } from '@dakota-xyz/ts-sdk';

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

`npm run generate` merges the base spec (`openapi.yaml`) with SDK-owned
overlays (`openapi.agentic.yaml`) into a gitignored `openapi.merged.yaml`,
then runs `openapi-typescript` against the merged output.

### Syncing from the platform — the public spec can be stale

`openapi.yaml` is synced from the platform's `openapi.public.yaml`, which
the platform GENERATES from its internal `openapi.yaml`
(`make openapi-public`). That generation is a manual step, so the public
file can lag the routes the server actually serves — the internal
`openapi.yaml` is what `internal/api/oapi/routes.go` is generated from,
and therefore what is authoritative.

This has bitten once: SDK 2.2.0 shipped
`/clients/{client_id}/agentic-policy` from a stale public spec while the
server served `/agentic-policy`, so every `agenticPolicy` call 404'd.

**After any sync, if a path looks wrong, check the platform's internal
`openapi.yaml` (and `routes.go`) before trusting the public file.**
Deliberate deviations from upstream are pinned by
`tests/client/spec-guards.test.ts`, which fails if a sync reintroduces a
shape we already corrected. Add a guard there whenever you hand-correct
the spec.

### Why the overlay exists

The overlay pins the beta surface the SDK opts into (`x-beta: true` —
today the agentic-payments surface `/payment-agents`, `/instructions`,
`/mandates`, `/scheduled-payments`, plus the customer Insights
endpoints). Historically the platform sync STRIPPED the pre-release paths
from `openapi.yaml`; since ENG-2756 the platform's published public spec
keeps them (annotated with the maturity marker + a banner), so the overlay
now mainly guards against a sync regression and gives the SDK an explicit,
reviewable manifest of its beta surface. The merge is idempotent — when
the base already carries the beta content, the overlay redefines the
same content harmlessly.

The marker is spelled into the extension NAME, so each promotion renames it
(ENG-3168 moved `x-alpha` -> `x-beta`). If it changes again, both
`scripts/extract-agentic.mjs` and `tests/client/spec-guards.test.ts` select
on it and must move together — a stale selector yields an EMPTY overlay, and
the guard that would catch that is the one you just made stale.

- `npm run openapi:check` — CI guard; fails if the base `openapi.yaml`
  is missing paths/schemas the overlay expects. (Useful defense in depth
  even though the merge is idempotent.)
- `npm run openapi:extract-agentic` — regenerate the overlay from the
  base spec (run once after adding new agentic content upstream).

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
import { WebhookHandler } from '@dakota-xyz/ts-sdk/webhook';

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
