# Changelog

All notable changes to the Dakota TypeScript SDK are documented in this file.

## [Unreleased]

### Changed — spec sync with platform main

The vendored `openapi.yaml` was three weeks behind platform main. It is now a
copy of platform `openapi.public.yaml` at `2ca79f60`, minus the one deviation
below, and byte-identical to the spec go-sdk carries at its own main. That is 5
new operations, 17 new schemas, and shape changes on 21 existing ones.

`src/generated/api.ts` is regenerated from it. Since the generated types are a
documented part of this SDK's surface, a few names moved:
`Paginated{OneOff,Wallet,Customer}TransactionResponse.meta` is now
`TransactionListMeta` (the same three pagination fields plus a required
`transaction_type` naming the family the page listed).

The overlay allowlist in `scripts/extract-agentic.mjs` had drifted ten schemas
behind the alpha paths, and still listed the three `InsightChat` schemas the
removal below deleted. Because the base spec currently carries the alpha
surface itself, the gap was invisible — it would have surfaced only on the sync
the overlay exists to survive, as dangling `$ref`s. The list is corrected, and
`tests/client/spec-guards.test.ts` now derives the required set from the spec
rather than trusting the list.

### Breaking

- **`AgentConversationOptions.clientPolicy` is gone.** platform `1f108a6a`
  dropped `client_policy` from the proposals and instructions request bodies
  deliberately: a policy belongs to the client, not to a request, and carrying
  one per request let a draft and its accept be judged by different rules.

  The SDK kept sending it. It was spread into the body rather than assigned, so
  TypeScript's excess-property check never fired and the field simply stopped
  doing anything — silently, since the agent just narrates in platform nouns
  again ("destination", "mandate") with no error anywhere. Deleting the option
  turns that silence into a compile error.

  Register once with `client.agenticPolicy.set(policy)` instead. `timezone` and
  `timeout` are unaffected. (go-sdk removed `WithClientPolicy` in the same
  cycle.)

- **`TransactionListParams` is now a union discriminated on
  `transaction_type`.** The wallet-only filters (`wallet_id`, `direction`) can
  no longer be written without naming the `wallet` family — the combination the
  server answers with a 400. See the fix below. It also picks up the filters the
  spec has carried for a while and the type never exposed: `search`, `sort_by`,
  `sort_dir`, `created_at_from`/`created_at_to`, `amount_min`/`amount_max`,
  `statuses`.

### Fixed

- **`transactions.list()` could return another family's rows.**
  `GET /transactions` serves three resource families from one path, and with
  `transaction_type` omitted the server INFERS the family from the other
  filters — `customer_id` alone infers `auto_account`. `list()` named no
  family, so the obvious spelling of "this customer's one-off transactions":

  ```typescript
  client.transactions.list({ customer_id });
  ```

  returned that customer's **auto-account** transactions. They parse into
  `OneOffTransaction` with missing fields rather than failing, and the return
  type said `OneOffTransaction` throughout, so nothing surfaced the
  substitution. README and AGENTS.md both taught this exact call.

  `list()` now always names the family on the wire, defaulting to `one_off`,
  and verifies the family the response reports before yielding a page — a
  POSITIVE mismatch only, since an absent `meta.transaction_type` means the
  response made no claim rather than that it served the wrong family. The
  synced spec is what made the check possible.

  The element type now follows the family rather than asserting one:
  `list({ transaction_type: 'wallet' })` yields `WalletTransaction`,
  `'auto_account'` yields `AutoTransaction`, anything else `OneOffTransaction`.

- **`selfServe.listLedger()` could silently drop rows at a page boundary.** The
  ledger's `cursor` is a timestamp, and entries written in one transaction
  share a `created_at` — so ordering by it alone is not total, and a page
  boundary landing inside such a group lost the rest of it. `cursor_id` is the
  tiebreaker that completes the ordering; pass the last entry's `id` alongside
  its `created_at`.

### Added

- **`AgentConversationOptions.developerFee`.** The proposals request gained
  `developer_fee` in this sync, and `AgentConversation` builds that body
  itself, so there was no way to declare a fee on a drafting turn.

  Declare it in BOTH places, not one or the other: the accept is what CHARGES
  the fee, and the drafting turn is what lets the agent MENTION it. Set it only
  on `instructions.create()` and the customer approves a summary that never
  disclosed a fee, then gets charged it. Resent on every turn, since the
  endpoint is stateless — and, like `timezone`, it must be passed again to
  `resumeAgentConversation`, which restores the transcript, not the options.

- **Legal documents (`client.legal`).** `list()` returns the in-force revision
  of every published document as an index without the text; `get(key, version?)`
  returns one document's text, either the revision in force or a specific one.
  Both are **unauthenticated** — integrators need them before a customer
  relationship exists. A revision is immutable, so a fetched `(key, version)`
  can be cached indefinitely; `list()` cannot, since it names whichever revision
  is in force now.

- **`applications.getLegalAcceptance(applicationId)`.** What an
  accept-agreements page renders: the agreements still owed, the ones already
  accepted, and the people permitted to accept them. It exists so that page does
  not call `applications.get()`, which would answer with the whole KYB record —
  the business entity and every individual's date of birth, nationality and
  email. The link that reaches it is emailed and travels in a URL query string,
  so its credential is scoped to this call and the attestation submission.

  Pair it with `legal.get()` for the text, and pass the `version` you displayed
  back as `legal_document_version` on `submitAttestation` so the acceptance
  record names the exact words the customer saw.

- **RD marketing-fee statements (`client.rdMarketingFee`).** `listMonths()`
  returns the months the calling client has a statement for, newest first;
  `getStatement(month)` returns one row per calendar day, read from the stored
  daily principals rather than recomputed, so what a client reads and what
  Dakota priced cannot drift. Absent is not zero throughout: an absent
  `balance_minor` means the day is not stamped yet, `'0'` means the client
  genuinely held no RD. A client with no contract gets a 404; an empty month
  list means the contract is real but starts later.

- **`customers.listPage(params?)`.** One page of customers plus `status_counts`
  — the per-status counts a dashboard header renders, which `list()` cannot
  reach because it iterates rows and drops the envelope. The counts are computed
  under the same filters but ignoring the `status` selection, so a chip keeps
  its count while it is the active filter.

- **The unified customer status.** `Customer.status` collapses the frozen
  state, the application decision, and the application lifecycle into one
  client-facing value (`CustomerStatus`). `CustomerListParams` gains `status`
  plus `kyb_statuses`, `kyc_statuses` and `application_statuses` — all
  comma-separated strings, not arrays — and `sort_by`, `sort_dir`,
  `created_at_from`, `created_at_to`.

- **`APIError.userMessage` and `APIError.resolutionUrl`.** `message` names
  request fields and actions so a machine caller can self-correct;
  `userMessage` says the same thing without API vocabulary, for relaying into a
  human surface. `resolutionUrl` is a token-gated link that CLEARS the problem,
  present today on `terms-not-accepted`, pointing at the hosted flow where the
  outstanding agreement can be signed. Both are `null` when the problem carries
  neither.

- **Typed list filters that the spec already accepted.** These are not new
  upstream — the SDK's params types simply never named them, and since
  `ListParams` carries an index signature they always reached the wire if you
  knew they existed. Now they are discoverable:

  | Where | Gained |
  |-------|--------|
  | `autoTransactions.list()` | `AutoTransactionListParams` — 20 filters incl. `statuses`, `types`, `start_date`/`end_date` (epoch **seconds**), `outgoing_amount_min`/`max`, `sort_by`/`sort_dir` |
  | `users.list()` | `UserListParams` — `search`, `roles`, `created_at_from`/`to`, `sort_by`/`sort_dir` |
  | `destinations.list()` | `DestinationListParams` — `destination_type` |
  | `scheduledPayments.list()` | `mandate_version`, `page` |
  | `applications.get()` | `{ include }` — `entities`, `validation`, `edd`, `attestations`, `all` |

- Type aliases for the rest of the new surface: `CustomerStatus`,
  `CustomerStatusCounts`, `LegalDocument`, `OutstandingLegalDocument`,
  `AcceptedAgreement`, `LegalAcceptanceAttestor`, `LegalAcceptanceContext`,
  `RDMarketingFeeStatement`, `RDMarketingFeeDailyRow`, `RFIRequestedItems`,
  `TransactionResourceType`, `TransactionListMeta`, `CustomerPage`.

  Also generated and reachable through the types: the RFI resubmission scope on
  `Application` (`rfi_requested_items`, `rfi_resubmitted`), attestation
  readiness (`AttestationValidation.ready` / `missing_documents`,
  `AttestationSubmitRequest.legal_document_version`), the inbound deposit
  attribution reference on `BankAccount.payment_reference`, per-pair transfer
  fee overrides (`ClientPricingConfig.transferFeeOverrides`), card settlement
  (`EnableCardSettlementIntent`), and `net_recovered_amount` on one-off and
  auto-account transactions.

### Removed — `insights.chat` (ALPHA)

`client.insights.chat(customerId, …)` is gone, along with the
`InsightChat{Message,Request,Response}` types and the chat path/schemas in
`openapi.agentic.yaml`. Platform removed
`POST /customers/{customer_id}/insights/chat` for the agentic BETA (ENG-3153),
so the method had no server to reach — it would 404 for every caller.

`client.insights.get(customerId)`, the deterministic account report, is
**unaffected**, and so is every other agentic resource.

This is the alpha caveat doing its job: the hosted agentic surface is
`x-alpha`, flag-gated, and documented as liable to change **or be removed**
without a major-version bump. Platform kept the conversational core deliberately
and expects to bring it back in a reshaped form after the beta; when it does, it
will arrive as a new addition here rather than as a restoration of this method.

Until the platform's published spec drops the operation, a wholesale re-sync
reintroduces it and regenerates a type for a method this SDK no longer has.
Two guards in `tests/client/spec-guards.test.ts` hold the removal in place.

The 180s `AGENTIC_MODEL_TIMEOUT_MS` default now applies to proposal drafting
alone.

## [2.2.2] - 2026-08-04

### Fixed — `rejected_input` poisoned the conversation transcript

`conversation_status: 'rejected_input'` means the message was refused
WHOLESALE and, per the spec, "should NOT be added to the conversation
history". 2.2.0 shipped that status in the types and the changelog but
never implemented the behaviour.

`AgentConversation` rolls the optimistic user turn back only on a
transport error. A `rejected_input` arrives as an HTTP **200** with a
populated body, so the rollback never fired: the refused message stayed
in the transcript *and* a synthetic assistant turn was appended on top.
Every later `send()` then re-transmitted the exact message the server
asked the client to drop, corrupting the conversation from that point
on — and since `messages()` returns a copy, callers could not repair it.

The refused turn is now rolled back with no assistant turn recorded, so
the transcript is identical to before the call. The caller still gets the
turn, whose `reply` explains what to resend, and the conversation
continues unaffected.

`warned` and `blocked` are untouched — those turns happened, and dropping
them would break the alternating transcript the platform requires.

Found by automated review on the Go SDK port of the same code; the Go SDK
carried the identical defect and is fixed in the same change.

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
