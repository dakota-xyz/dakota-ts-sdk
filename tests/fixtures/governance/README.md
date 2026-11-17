# Governance intent golden vectors

`intents.golden.json` holds the canonical bytes the policy engine signs over for
each signer-group governance intent, produced by policy-engine's own
`pkg/intent.CanonicalIntentBytes` (policy-engine origin/main `dde0d46`,
2026-11-17). `tests/governance/intents.test.ts` asserts the SDK's builders
reproduce them byte for byte.

Do not edit the JSON by hand. To regenerate after a policy-engine change, copy
`generate-intents.go` into an empty directory next to a `go.mod`
(`module goldengen` / `go 1.26.10`, no `require`), then:

```bash
go work init . /path/to/policy-engine
go run . > intents.golden.json
```
