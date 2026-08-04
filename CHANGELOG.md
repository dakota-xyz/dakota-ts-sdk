# Changelog

All notable changes to the Dakota TypeScript SDK are documented in this file.

## [2.2.1] - 2026-08-04

### Fixed — `agenticPolicy` called a route that does not exist

Every `client.agenticPolicy` call in 2.2.0 404'd. The SDK addressed
`/clients/{client_id}/agentic-policy`, but the platform serves
`/agentic-policy` and resolves the client from the API key — there is no
id to pass, and no other client's policy to address even to be refused.

The stale path came from the platform's published `openapi.public.yaml`,
which still describes the older client-scoped shape: it was not
regenerated when the route was simplified, so it disagrees with the
`openapi.yaml` the router is generated from. The SDK now carries the
corrected path by hand, with a guard test (`tests/client/spec-guards`)
so a future spec sync cannot quietly reintroduce it.

**The method signatures lost their `clientId` argument:**

```typescript
// before (always 404'd)          // after
agenticPolicy.get(clientId)       agenticPolicy.get()
agenticPolicy.set(clientId, pol)  agenticPolicy.set(pol)
```

This is a compile-time break, deliberately: it only affects code that
was already failing at runtime, and a TypeScript error is a better way
to learn that than a 404. Nothing else in 2.2.0 is affected — blockers,
`developer_fee`, and per-payment network selection all work.

## [2.2.0] - 2026-08-04

Spec sync with platform `main`. No breaking changes.

### Added — agentic client policy (ALPHA)

`client.agenticPolicy` (`get` / `set`) registers how YOUR product speaks
and what the agent may propose for it — payee shape, allowed payout
assets, the nouns your customers use (`limit`, `payee`, `limit_unit`),
whether limits live in your own editor, and how money may leave. It
reshapes what the drafting model sees, so the agent narrates in your
nouns instead of the platform's.

The policy is per CLIENT, not per API key (keys are N:1 to clients, so a
per-key policy would fragment across deployments). Registration is a
FULL REPLACE — an omitted field means you no longer want it, and `{}`
clears it back to platform defaults. Validation is strict: an unknown
key, an unknown value, or a label for an unimplemented concept is a 400
at registration rather than a surprise mid-conversation.

`AgentConversationOptions.clientPolicy` and
`CreateProposalsRequest.client_policy` still work and still win, but they
are DEVELOPMENT overrides — forgetting to send one fails silently, with
the agent simply going back to platform nouns and nothing erroring.
Prefer the registration.

### Added — blockers on a drafting turn (ALPHA)

`ConversationTurn.blockers` / `hasBlockers` (and
`AgenticProposalsResult.blockers`) give machine-actionable reasons a turn
could not complete, for your APPLICATION rather than the customer.
`reply` says the same thing in prose, which software cannot branch on.

They **accompany proposals rather than replacing them**, and routinely
do: the common case is a payee who does not exist yet, where the turn
proposes creating them *and* reports that the limit will not reach them —
you need both, in that order. Codes today are
`mandate_does_not_cover_payee` (actionable: amend the limit to add the
payee as a target) and `no_mandate` (nothing to amend). Switch on `code`
and ignore ones you do not recognize.

### Added — developer fee per payout type (ALPHA)

`CreateInstructionsRequest.developer_fee` declares `swap_bps` for a
crypto payout and `offramp_bps` for a bank payout. The two are
independent, so one conversation can charge a swap and stay silent about
a bank payout in the same turn. Both are defaults for the auto-accounts
the request creates; an action-level `fee_bps` still wins.

### Added — per-payment network selection (ALPHA)

`CreateScheduledPaymentsAction.network_id` and
`CreateAutoAccountAction.output_network_id` pick the chain for THIS
payment. The network belongs to the payment, not the payee: an address
receives on every chain in its family, so a destination's saved network
records what a previous payment did rather than restricting this one.
Crossing chain FAMILIES is still refused.

### Changed — `max_transactions` on an account

Reaching the cap **refuses further deposits; it does not turn the deposit
details off**, and refused funds are *not* returned — they arrive and are
then held pending manual intervention, with nothing converted, nothing
forwarded, and no transaction recorded. Stop sending to the deposit
details once the cap is reached. Documented on `accounts.create`; the
platform behaviour changed, not the SDK.

## [2.1.1] - 2026-08-01

### Fixed — the default timeout aborted agent conversations

Agent turns ran under the ordinary 15s deadline. A turn is a sequence of
model calls, so "what can you do?" answered in time while "schedule 0.4
USDC to KADOTA every Friday" did not — the same conversation failing
intermittently, reported as flakiness rather than as a deadline. The
deadline was also client-wide and unoverridable, so the only workaround
was a second `DakotaClient` differing by one number.

- `paymentAgents.createProposals`, `AgentConversation.send` and
  `insights.chat` now default to **180s** (`AGENTIC_MODEL_TIMEOUT_MS`)
  instead of 15s.
- `RequestOptions.timeout` sets a deadline for a single call, on every
  method that takes request options.
- `AgentConversationOptions.timeout` sets it for every turn of one
  conversation.
- Precedence: per-request → explicit client-wide → endpoint default →
  15s. An explicit client `timeout` still wins over the agentic default,
  so a deliberately-chosen deadline is never overruled — which also means
  a short global timeout must be raised per conversation.
- The timeout error now names the elapsed deadline and how to change it,
  instead of a bare `Request timed out`.

### Fixed — `mandates.list()` silently returned nothing

`GET /mandates` answers with a bare array while most list endpoints
return `{data, meta}`. The paginator read `response.data`, got
`undefined`, and yielded an empty page — zero results, no error, for
mandates that exist and that `mandates.get(id)` returns fine. The
paginator now treats an array response as one complete page.

This also fixes `signerGroups.listForWallet()`, which hits
`GET /wallets/{id}/signer-groups` and had the same silent-empty bug.

### Fixed — a caller's `AbortSignal` was reported as a timeout

Aborting a request through your own signal raised `Request timed out`
and was then retried. It now raises `Request aborted by caller` and is
terminal.

## [2.1.0] - 2026-07-31

Spec sync with platform `main` (`openapi.public.yaml`). No breaking
changes to the SDK surface.

### Added — onboarding

- **Persona Connect imports.** `customers.importPersonaTokens(data)`
  redeems `cnst_...` share tokens (up to 5,000 per request). Unlike the
  Sumsub import, Persona redemption is asynchronous on Persona's side,
  so this returns a JOB (HTTP 202) rather than per-token results —
  poll it with `customers.getPersonaImportJob(jobId, params?)`, and list
  past runs with `customers.listPersonaImportJobs(params?)`. A `skipped`
  entry is about the token STRING (malformed, duplicated in the batch,
  already imported), never a compliance decision about a person.
- `customers.getCapabilities(id)` — the customer's rails and the
  OUTSTANDING requirements gating each. Partner-agnostic: keyed by an
  opaque terms id or document type, never a provider name.
- `customers.reEngage(id)` — mint a fresh `application_url` for an
  approved customer whose onboarding token expired.
- `customers.delete(id)` — soft delete; blocked while the customer has
  accounts or is referenced as a sub-client.
- `applications.submitAttestation` accepts `disclosure_id` +
  `disclosure_version` to record a partner-disclosure acknowledgment.

### Added — fees

- `client.feePayoutDestination` (`get` / `set` / `delete`) — where
  Dakota pays your accrued developer fees. One per organization, and
  crypto-only (a USDC wallet, CAIP-2 chain id). Emits
  `fee_payout_destination.updated` / `.deleted`.

### Added — agentic payments (ALPHA)

- **Mandate versions.** `mandates.amend(id, data)` appends a NEW signed
  version of the rule WITHOUT resetting the spend already made in the
  current window — usage accrues to the mandate, so an agent that has
  spent 9,000 of a 10,000 monthly cap and is amended to 20,000 has
  11,000 left. `mandates.listVersions(id)` returns the append-only
  history. Sign with the new `mandateAmendSignPayload(mandate, version,
  rule)`, which commits to the version being created so a v2 signature
  can never be replayed as v3. The amend endpoint does NOT normalize the
  rule — it must already be canonical.
- `mandates.getBudget(id)` — what has been spent, what scheduled
  payments have earmarked, and what is left. Advisory. An absent
  `remaining_*` means "not capped"; a `remaining_amount` of `'?'` means
  the figure could not be summed and must be treated as no headroom.
- `paymentAgents.getProposalsProgress(id)` — a coarse, customer-safe
  progress snapshot to show while a multi-payee drafting turn runs.
  Advisory display only; never gate behaviour on it.
- `AgentConversation` takes `{ timezone }` (IANA), resent on every turn
  since the endpoint is stateless, so "tomorrow" and "10 am" resolve in
  the customer's local time rather than UTC. Pass it to
  `newAgentConversation` / `resumeAgentConversation`.
- `MandateRule` gains a `DAILY` window plus the AGGREGATE caps
  `max_amount_in_window` / `max_count_in_window` — the ceiling across ALL
  targets. A per-target cap alone multiplies by the number of payees.
- `ScheduledPayment` carries `mandate_version`, the audit stamp naming
  which version authorized the payment.
- `conversation_status` gains `rejected_input` — the message was refused
  wholesale and should NOT be added to the conversation history.

### Added — core

- `signerGroups.get(id, { include_removed: true })` returns a
  `removed_members` array, each entry carrying its `removed_at`.
- `accounts.create` accepts `max_transactions` (cap the number of
  sweeps; `1` makes a one-off account) and an account-level
  `payment_reference` carried on every outbound fiat sweep.
- `fednow` joins the `PaymentCapability` rails, and `fednow_inbound`
  the sandbox inbound simulations.
- `Customer` exposes `external_id` and `rd_allowed`.

### Changed

- `signerGroups.removeSigner(groupId, signerId)` takes the KSUID
  `signer_id` — `client.signers.delete()` is the one that takes a public
  key. (Documentation only; the call was already correct.)
- `customers.updateSubClient` is deprecated: the sub-client association
  can only be set at creation and now 400s.
- ACH `payment_reference` limit is 18 characters, not 10.
- WebAuthn signer keys are restricted to ES256 (COSE `-7`) and RS256
  (COSE `-257`).

## [2.0.0] - 2026-07-17

### ⚠️ Breaking — webhook envelope

`WebhookEvent<T>` now mirrors the platform's real outbound envelope
(`core.PublicEvent`): the resource lives under `data.object` (with
optional `data.previous_attributes`), and the envelope carries `request`
and `metadata`. Previously the SDK typed the payload flat under `data`,
a shape the platform never sent — real deliveries could not be decoded
as typed.

Migration: read `event.data.object` where you read `event.data`.

```typescript
// before                       // after
handler.on('customer.created',  handler.on('customer.created',
  (e) => use(e.data));            (e) => use(e.data.object));
```

Also corrected to match the wire (verified against the platform event
builders): `KybApplicationSubmittedData` (`type` → `application_type`,
added `application_id`) and `KybLinkData` (added `link_type`, `status`;
`expires_at` optional).

### Added — webhooks

- New event types + typed payloads: `scheduled_payment.failed`
  (`ScheduledPaymentFailedData`), `customer.deleted`,
  `customer.capability_status.updated` (+ `CapabilityRequirement`),
  `fee_payout_destination.updated` / `.deleted`.
- `parseEvent` treats an absent `data` / `data.object` as an empty object
  instead of throwing.

### Added

- **Agentic payments (ALPHA)** — the `x-alpha`, flag-gated hosted
  payment-agent surface (TypeScript port of go-sdk#9): resources
  `paymentAgents`, `instructions`, `mandates`, `scheduledPayments`; the
  multi-turn `AgentConversation` proposals chat
  (`client.newAgentConversation`); wallet membership helpers
  `client.attachUserToWallet` / `client.detachUserFromWallet` (both accept
  an optional caller-supplied `idempotencyKey` for durable retries); §8
  mandate signing (`mandateSignPayload`, `P256MandateSigner`,
  `verifyMandateSignature`) with JCS/RFC 8785 canonicalization pinned
  byte-for-byte against the platform. Endpoints 404 unless the flag is
  enabled for your key; the surface may change without a major-version
  bump.
- **Insights (ALPHA)** — `client.insights.get(customerId)` (deterministic
  account report) and `client.insights.chat(customerId, …)` (stateless
  advisory chat). Read-only; never moves money.
- `signerGroups.removeSigner` now accepts `options` (e.g. an explicit
  `idempotencyKey` — the platform requires one on this DELETE).
- Transport auto-injects `x-idempotency-key` on DELETE requests (mirror of
  go-sdk 619b62e).

### Fixed

- `signerGroups.addSigner` was typed as `SignerCreateRequest`
  (name/public_key/key_type) but the endpoint takes `{ member_key }` —
  retyped to `SignerGroupSignerAddRequest`.

### OpenAPI

- Alpha paths + schemas live in the SDK-owned `openapi.agentic.yaml`
  overlay, deep-merged on `npm run generate`; `npm run openapi:check`
  guards drift. Synced with the platform's published public spec
  (ENG-2756), including the Insights endpoints and the
  `scheduled_payment.failed`, `customer.capability_status.updated`, and
  `fee_payout_destination.*` event-type enum values.

## [1.6.0] - 2026-06-23

### Summary

Fix `wallets.getBalances` to return the full `WalletBalances` envelope the
platform sends, instead of just the per-asset array. Surfaced while wiring
a public demo: a clean curl to `GET /wallets/{id}/balances` returned
`{wallet_id, address, balances, total_amount_usd}`, but the SDK was
dropping every wrapper field on the floor.

### Fixed

- **`wallets.getBalances`** now returns `Promise<WalletBalances>` (the
  full `{ wallet_id, address, balances, total_amount_usd }` envelope)
  instead of `Promise<WalletBalance[]>`. The previous shape forced
  callers to do a second `wallets.get()` to recover the address and to
  sum balance entries by hand to recover the total — both of which the
  platform was already sending in the same response.

  History: 1.3.x's impl read `response.data` and silently returned
  `undefined` (no `.data` envelope exists for this endpoint). 1.4.x and
  1.5.x correctly read `response.balances` but discarded the wrapper.
  This release returns what the platform actually sends.

  **Breaking** for callers that iterated the return as an array:

  ```ts
  // before (1.4.x / 1.5.x)
  const balances = await client.wallets.getBalances(id);
  for (const b of balances) { ... }

  // after (1.6.0)
  const { balances } = await client.wallets.getBalances(id);
  for (const b of balances) { ... }
  ```

  Any 1.3.x integration on this method was already broken at runtime —
  it was receiving `undefined` and crashing on the first iteration. The
  1.4.x → 1.6.0 migration is the one-line destructure above.

## [1.5.0] - 2026-06-17

### Summary

Sync against platform OpenAPI spec — three commits since the 1.4.0 sync:

- **ENG-2454** — `customers.create` now accepts `is_sub_client: boolean` to
  designate a customer as a sub-client at creation. A regular customer
  cannot be promoted afterwards; cannot be combined with `sub_client_id`.
- **ENG-2368** — `transactions.list` now accepts `wallet_id` and
  `direction` (`'in' | 'out'`) when `transaction_type: 'wallet'`. New
  `PaginatedWalletTransactionResponse` shape. `WalletTransaction` gains
  `created_at` and `confirmed_at` (Unix seconds).
- **ENG-2064** — Wallet balance descriptions clarified: `total_amount_usd`
  and `amount_usd` are rounded DOWN to cents (truncated toward zero), so
  they never exceed the holder's spendable balance. No schema change.

### Added

- `CustomerCreateRequest.is_sub_client?: boolean` — re-exported as
  optional. The generated type marks it required because of the
  `default: false`, but the spec's `required:` list excludes it.
- `TransactionListParams.wallet_id?: string`
- `TransactionListParams.direction?: 'in' | 'out'`

### Changed

- `WalletTransaction.created_at?: number`, `WalletTransaction.confirmed_at?: number`
  surfaced through the regenerated types.
- JSDoc examples on `customers.create` and `transactions.list` updated to
  show the new fields.
- `AGENTS.md` updated for both.

### Fixed

Two SDK-vs-platform type drifts surfaced by validating the agentic-build
prompt pack against the live sandbox. Each fix verified against
`platform/openapi.public.yaml` and the platform handler code.

- **`WalletTransactionRequest`** was typed as `SendTransactionIntent`
  (a bare intent). `POST /wallets/{id}/transactions` actually accepts
  an `EndorsedRequest` envelope (`{signatures, intent}`) — confirmed at
  `platform/openapi.public.yaml:1031` and `platform/internal/api/server_wallets.go:148`
  (`request.Body.Intent.AsSendTransactionIntent()` extracts intent FROM
  the envelope). Type is now `EndorsedRequest`; the bare intent is
  re-exported as `SendTransactionIntent` for callers that build + sign
  locally before wrapping. JSDoc example on `wallets.createTransaction`
  now shows the full RFC 8785 → SHA-256 → ECDSA P-256 DER → base64 flow.

  **Breaking** for any caller passing a bare intent — those calls were
  already failing at runtime (platform rejects bodies missing
  `signatures`), so no working integration depended on the old shape.

- **`destinations.create` return type** was `Destination`
  (`DestinationResponseUnion`, with `destination_id`). Platform returns
  only `{id}` per `IDResponse` — confirmed at
  `platform/openapi.public.yaml:2484` and
  `platform/internal/api/server_recipients.go:1120`
  (`CreateDestination201JSONResponse{Id: ...}`). New
  `DestinationCreateResponse` alias = `IDResponse`. `destinations.list`
  is unchanged — GET endpoints really do return the full union with
  `destination_id`.

  **Breaking** for any caller that read `.destination_id` on the create
  response — that field was always `undefined` at runtime, so this
  unbreaks type-level access to the real `.id` field.

## [1.4.0] - 2026-06-10

### Summary

Five correctness fixes aligning the SDK with the canonical server behavior:
transport-level idempotency on PUT/PATCH, endorsed-body forwarding on six
policy / signer-group methods, a `response.data` audit that uncovered three
methods silently returning `undefined`, webhook signature canonicalization,
and a webhook event type field rename. Includes type-level changes to two
public fields, but no consumer could meaningfully depend on the old shapes
(both returned `undefined` at runtime), so this ships as a minor bump.

### Fixed

- **Transport (idempotency on PUT/PATCH).** `Transport.buildHeaders` only
  attached `x-idempotency-key` when `method === 'POST'`. Dakota's
  `IdempotencyKeyHeader` is required on every mutating endpoint, so every
  PUT and PATCH call from earlier SDKs was being sent without an
  idempotency key. The predicate now covers POST, PUT, and PATCH (DELETE
  stays excluded — naturally idempotent). The retry guards for "POST with
  idempotency key" were widened to the same set.
- **Policies / SignerGroups (endorsed body forwarding).** Six methods that
  call endorsed PUT/DELETE endpoints had no `body` slot in their typed
  wrappers, so the `EndorsedRequest` envelope (`{ signatures, intent }`)
  never reached the wire — the policy engine was effectively verifying
  nothing for SDK consumers. `RequestOptions` now carries a typed
  `endorsement?: EndorsedRequest` field that is forwarded as the request
  body on: `policies.delete`, `policies.deleteRule`,
  `policies.attachToWallet`, `policies.detachFromWallet`,
  `signerGroups.attachToWallet`, `signerGroups.detachFromWallet`. For
  `policies.addRule` / `policies.updateRule` (which already accept a typed
  `data` arg), `options.endorsement` takes precedence over `data` so you
  can swap a bare data shape for an endorsed envelope at the call site
  without breaking the typed signature.
- **`wallets.getBalances` returned `undefined`.** The endpoint returns
  `WalletBalances` directly (`{ wallet_id, address, balances,
  total_amount_usd }`), not the paginated `{ data, meta }` envelope.
  Earlier versions read `response.data` and returned `undefined`, which
  crashed any caller that chained `.map()` on the result. Now reads
  `response.balances`.
- **`info.getCountries` returned `undefined`.** Same `response.data`
  bug — the endpoint returns `Country[]` directly. Now returns the
  response.
- **`info.getNetworks` returned `undefined`.** Same `response.data` bug —
  the endpoint returns `string[]` directly. Return type tightened from
  `Network[]` to `string[]` to match the spec.
- **Webhook signature canonicalization.** `webhook/signature.ts`
  `buildSignedMessage` was building `timestamp + '.' + payload`, but the
  platform signer concatenates `timestamp || payload` with no separator.
  Every webhook was failing Ed25519 verification via the SDK helper
  (`WebhookHandler`, `verifySignature`, `verifySignatureSync`). Dropped
  the period.
- **`WebhookEvent.created_at` was always `undefined`.** Wire field is
  `created` (matches OpenAPI event-stream examples and the platform event
  builder). Renamed the typed field to match.

### Changed

- `RequestOptions` extended with `endorsement?: EndorsedRequest` (re-exported
  from `client/types.ts`).
- `info.getNetworks(): Promise<string[]>` (was `Promise<Network[]>`).
- `WebhookEvent.created: number` (was `created_at: number`).

### Added

- 4 new transport tests covering idempotency on PUT (auto-key), PUT
  (custom key), PATCH, and DELETE (no key).

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
