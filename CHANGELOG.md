# Changelog

All notable changes to the Dakota TypeScript SDK are documented in this file.

## [1.3.1] - 2026-06-02

### Fixed

- **Packaging:** `package.json` `main`, `module`, and `exports` map referenced
  filenames (`index.cjs`, `index.d.cts`) that `tsup` does not produce. The
  actual build outputs are `dist/index.js` (CJS) and `dist/index.mjs` (ESM),
  with `dist/index.d.ts` / `dist/index.d.mts` for types respectively. This
  caused `require('@dakota-xyz/ts-sdk')` from Node/`tsx` to fail with
  `MODULE_NOT_FOUND` for `dist/index.cjs`, and ESM consumers were silently
  served the CJS file. Bundlers (Next.js/webpack/Vite) tolerated the mismatch,
  so the issue only surfaced for plain Node and CLI script runners.
- Updated all four `exports` entries (root + `./webhook`, both `import` and
  `require` conditions) plus `main`/`module` to point at the files that
  actually ship in the tarball.

## [1.3.0] - 2026-06-01

### Summary

Sync the SDK's OpenAPI spec to the latest from `platform/openapi.public.yaml`.
Adds 4 new endpoints (single-wallet GET and three "attached resources" lookups)
and 2 new schemas for slim relationship references.

### Added

#### Wallets
- `wallets.get(walletId)` — fetch a single wallet by ID
  (`GET /wallets/{wallet_id}`). Includes `customer_name` and `created_at`
  joined server-side.
- `wallets.getPolicies(walletId)` — list policies attached to a wallet
  (`GET /wallets/{wallet_id}/policies`). Returns `AttachedPolicy[]`
  (slim `id` + `name` references).

#### Policies
- `policies.getWallets(policyId)` — list wallets a policy is attached to
  (`GET /policies/{policy_id}/wallets`). Returns `AttachedWallet[]`
  (slim `id` + `name` + `family` references).

#### Signer Groups
- `signerGroups.getWallets(signerGroupId)` — list wallets a signer group is
  attached to (`GET /signer-groups/{signer_group_id}/wallets`). Returns
  `AttachedWallet[]`.

#### Types
- `AttachedPolicy` — slim reference (id + name).
- `AttachedWallet` — slim reference (id + name + family).

### Changed

- Regenerated `src/generated/api.ts` from the updated `openapi.yaml`
  (now sourced from `platform/openapi.public.yaml`).

## [1.2.0] - 2026-05-11

### Summary

Sync the SDK's OpenAPI spec to the latest Dakota Platform API docs
(`mintlify-docs`). Adds 2 new endpoints, 4 new schemas, and pulls in shape
updates for ~18 schemas / 16 operations that already existed.

### Added

#### Customers
- `customers.bulkImportFromSumsubTokens(data)` — bulk-import customers from
  one or more Sumsub share tokens (`POST /customers/bulk-import-sumsub-tokens`).
  Returns per-token results so partial successes are observable.
- `BulkImportSumsubTokensRequest`, `BulkImportSumsubTokensResponse`,
  `BulkImportSumsubTokensResult` types.

#### Self-Serve Credits
- `selfServe.getPricing()` — fetch the caller's `ClientPricingConfig`
  (fee schedule: ACH / wire / SEPA / SWIFT / KYC / KYB + monthly minimum)
  (`GET /self-serve/credits/pricing`). Self-serve clients only.
- `ClientPricingConfig`, `SelfServeCreditsPricingResponse` types.

### Changed

- Regenerated `src/generated/api.ts` from the latest `openapi.yaml`
  (mintlify-docs source of truth). Pulls in shape changes for `Application`,
  `AutoAccountTransaction`, `ClientUser`, `Customer`, `FiatIBANDestinationRequest`,
  `FiatIBANDestinationResponse`, `FiatUSDestinationRequest`, `KybLinkType`,
  `OneOffTransaction`, `OneOffTransactionRequest`, `OneOffTransactionStatus`,
  `PaymentCapability`, `Policy`, `SelfServeCreditsLedgerEntry`, `Signer`,
  `SignerCreateRequest`, `Transaction`, and `TransactionStatus`.
- New schemas now available on `components['schemas']`: `ClientPricingConfig`,
  `FiatUSDestinationAddress`, `InsufficientCreditsError`, `SenderDetails`.

## [1.1.0] - 2026-04-17

### Summary

Full SDK audit and sync against the OpenAPI public spec. This release adds 24 new endpoints, fixes 7 incorrect endpoint implementations, introduces the Self-Serve Credits resource, and removes 6 methods that were not backed by the public API specification.

### Added

#### Customers
- `customers.updateSubClient(customerId, data)` — associate or disassociate a customer with a sub-client (`PATCH /customers/{id}/sub-client`)
- `customers.getSubClientSummary()` — list all sub-clients with customer counts (`GET /customers/sub-client-summary`)
- `CustomerListParams` now supports `sub_client_id` and `is_sub_client` filters

#### Recipients & Destinations
- `recipients.delete(recipientId)` — soft-delete a recipient (`DELETE /recipients/{id}`)
- `destinations.delete(recipientId, destinationId)` — delete a destination (`DELETE /recipients/{id}/destinations/{id}`)

#### Accounts
- `accounts.delete(accountId)` — soft-delete an account (`DELETE /accounts/{id}`)
- `AccountListParams` now supports `source_network_id`, `destination_network_id`, `destination_asset`, `crypto_destination_id`, `fiat_destination_id`

#### Transactions
- `TransactionListParams` now supports `transaction_type`, `destination_id`, `source_network_id`, `source_asset`, `destination_asset`

#### Applications (Onboarding)
- `applications.updateIndividualDetails(applicationId, data)` — update individual (non-business) application details (`PUT /applications/{id}/individual-details`)
- `applications.submitAttestation(applicationId, data)` — submit e-sign, TOS, and other attestations (`POST /applications/{id}/attestations`)
- `applications.getEDD(applicationId)` — retrieve Enhanced Due Diligence record (`GET /applications/{id}/edd`)
- `applications.createOrUpdateEDD(applicationId, data)` — create or update EDD record (`PUT /applications/{id}/edd`)
- `applications.createDocument(applicationId, data)` — upload application document via base64 (`POST /applications/{id}/documents`)
- `applications.listDocuments(applicationId, params?)` — list uploaded documents (`GET /applications/{id}/documents`)
- `applications.getDocument(applicationId, documentId)` — download a document (`GET /applications/{id}/documents/{id}`)
- `applications.deleteDocument(applicationId, documentId)` — delete a document (`DELETE /applications/{id}/documents/{id}`)
- `applications.verifyDocument(applicationId, documentId)` — verify a presigned-URL upload (`POST /applications/{id}/documents/{id}/verifications`)
- `applications.uploadIndividualDocument(applicationId, individualId, data)` — upload identity/EDD doc for an individual (`POST /applications/{id}/associated-individuals/{id}/documents`)
- `applications.getIndividualDocumentUploadUrl(applicationId, individualId, data)` — get presigned upload URL for individual doc (`POST /applications/{id}/associated-individuals/{id}/document-uploads`)

#### Signer Groups & Signers
- `signers.create(data)` — create a new signer (`POST /signers`)
- `signerGroups.listForWallet(walletId)` — list signer groups attached to a wallet (`GET /wallets/{id}/signer-groups`)

#### API Keys
- `apiKeys.deleteAll()` — delete all API keys for incident response (`DELETE /api-keys`)
- `apiKeys.createForClient(data)` — create API key for a specific client, admin only (`POST /api-keys/admin`)

#### Self-Serve Credits (new resource)
- `selfServe.purchaseCredits(data)` — create Stripe checkout session (`POST /self-serve/credits/purchase`)
- `selfServe.getBalance()` — get current credit balance (`GET /self-serve/credits/balance`)
- `selfServe.listLedger(params?)` — list ledger entries with cursor pagination (`GET /self-serve/credits/ledger`)
- `selfServe.listTiers()` — list available purchase tiers (`GET /self-serve/credits/tiers`)

### Fixed

- **`applications.updateIndividual()`** — changed HTTP method from `PATCH` to `PUT` to match the spec; body type changed from `Partial<AssociatedIndividualRequest>` to `AssociatedIndividualRequest` (full replace semantics)
- **`applications.updateBusinessDetails()`** — changed HTTP method from `PATCH` to `PUT` to match the spec; body type changed from `Record<string, unknown>` to `BusinessApplicationCreateRequest`
- **`applications.getDocumentUploadUrl()`** — body and return types now use proper generated types (`ApplicationDocumentUploadUrlRequest` / `DocumentUploadUrlResponse`)
- **`apiKeys.create()`** — return type corrected from `ApiKey & { secret: string }` to `ApiKeyResponse` (fields: `id`, `key`)
- **`webhooks.listEvents()`** — changed from `PaginatedIterator` to direct `Promise<WebhookHistoryResponse>` because this endpoint uses cursor-based pagination (`cursor`/`has_more`), not the standard `starting_after`/`has_more_after` format
- **`webhooks.replayEvent()`** — return type corrected from `void` to `WebhookReplayResponse` (fields: `webhook_id`, `status`, `replayed_to_count`)
- **`users.update()`** — return type corrected from `Promise<User>` to `Promise<void>` (spec returns 204 No Content)

### Removed

These methods were not backed by the public OpenAPI specification and have been removed to ensure strict spec compliance:

- `events.get(eventId)` — no `GET /events/{id}` endpoint in the public spec
- `users.get(userId)` — no `GET /users/{id}` endpoint in the public spec
- `signers.list()` — no `GET /signers` endpoint in the public spec
- `signers.getByPublicKey(publicKey)` — no `GET /signers/{public_key}` endpoint in the public spec
- `applications.listIndividuals(applicationId)` — no `GET /applications/{id}/associated-individuals` endpoint in the public spec
- `applications.getIndividual(applicationId, individualId)` — no `GET /applications/{id}/associated-individuals/{id}` endpoint in the public spec

### Breaking Changes

1. **`AccountListParams.account_type`** is now required (was optional) — matches the spec where `account_type` is a required query parameter
2. **`TransactionListParams.account_id`** has been removed — this field was never in the spec
3. **`applications.updateIndividual()`** — HTTP method changed from PATCH to PUT; parameter type changed from `Partial<AssociatedIndividualRequest>` to `AssociatedIndividualRequest`
4. **`applications.updateBusinessDetails()`** — HTTP method changed from PATCH to PUT; parameter type changed from `Record<string, unknown>` to `BusinessApplicationCreateRequest`
5. **`apiKeys.create()`** — return type changed from `ApiKey & { secret: string }` to `ApiKeyResponse`
6. **`webhooks.listEvents()`** — return type changed from `PaginatedIterator<WebhookEvent>` to `Promise<WebhookHistoryResponse>`
7. **`webhooks.replayEvent()`** — return type changed from `Promise<void>` to `Promise<WebhookReplayResponse>`
8. **`users.update()`** — return type changed from `Promise<User>` to `Promise<void>`
9. Six methods removed (see Removed section above)

### Internal

- Synced `openapi.yaml` with the platform's `openapi.public.yaml`
- Regenerated `src/generated/api.ts` from the updated spec
- Added 30+ new type aliases in `src/client/types.ts`
- Version bumped from 1.0.17 to 1.1.0
