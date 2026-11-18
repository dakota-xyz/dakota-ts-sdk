// Generates canonical-intent golden vectors for dakota-ts-sdk (ENG-6468)
// from policy-engine's own intent.CanonicalIntentBytes.
package main

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"os"

	"github.com/dakota-xyz/policy-engine/pkg/intent"
	"github.com/dakota-xyz/policy-engine/proto/gen/endorsement"
)

type vector struct {
	Name         string         `json:"name"`
	Kind         string         `json:"kind"`
	Input        map[string]any `json:"input"`
	CanonicalB64 string         `json:"canonical_b64"`
	SHA256Hex    string         `json:"sha256_hex"`
}

const keyA = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEMbuCXgirK7R0SD7rp7e/YLTYbw0ceCI/WA31TtTcZ//y3CNkqgXkKdwHBa3N4S5BI+8pSx1NLYnyfihfmELCgw=="
const keyB = "pQECAyYgASFYIONPBSOpT1b1GhA42/UncK14mua0wlAqa3rifDVE+dNIIlggkoBPQr6PDtfwTEhVgmvlrYauaafB3MLQ3AIGo7OEvYo="
const keyC = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEyrrHNsQMwUxGIWthOdpPCAwR"
const idem = "047caa77-8cec-4e96-994c-a12b655231de"
const group = "3MF5pRlAIRFYkOAd3TstqUKMOpp"
const gov = "3MF5pokUeizBfGkQF0N4qhUgRve"

func i32(v int32) *int32  { return &v }
func str(v string) *string { return &v }

func main() {
	var out []vector
	add := func(name, kind string, in map[string]any, msg any) {
		b, err := intent.CanonicalIntentBytes(msg)
		if err != nil {
			panic(err)
		}
		h := sha256.Sum256(b)
		out = append(out, vector{name, kind, in, base64.StdEncoding.EncodeToString(b), hex.EncodeToString(h[:])})
	}

	add("add one key at version 0", "add_signers_to_group",
		map[string]any{"signer_group_id": group, "new_member_keys": []string{keyA}, "signer_group_version": 0, "idempotency_key": idem},
		&endorsement.AddSignersToGroupIntent{SignerGroupId: group, NewMemberKeys: []string{keyA}, SignerGroupVersion: 0, IdempotencyKey: idem})
	add("add two keys keeps order", "add_signers_to_group",
		map[string]any{"signer_group_id": group, "new_member_keys": []string{keyC, keyA}, "signer_group_version": 7, "idempotency_key": idem},
		&endorsement.AddSignersToGroupIntent{SignerGroupId: group, NewMemberKeys: []string{keyC, keyA}, SignerGroupVersion: 7, IdempotencyKey: idem})
	add("add with HTML and non-ASCII characters", "add_signers_to_group",
		map[string]any{"signer_group_id": "g<1>&é ", "new_member_keys": []string{"k\"\\/"}, "signer_group_version": 4294967296, "idempotency_key": idem},
		&endorsement.AddSignersToGroupIntent{SignerGroupId: "g<1>&é ", NewMemberKeys: []string{"k\"\\/"}, SignerGroupVersion: 4294967296, IdempotencyKey: idem})

	add("remove one key at version 0", "remove_signers_from_group",
		map[string]any{"group_id": group, "members_to_remove": []string{keyA}, "signer_group_version": 0, "idempotency_key": idem},
		&endorsement.RemoveSignersFromGroupIntent{GroupId: group, MembersToRemove: []string{keyA}, SignerGroupVersion: 0, IdempotencyKey: idem})
	add("remove keeps the order sent", "remove_signers_from_group",
		map[string]any{"group_id": group, "members_to_remove": []string{keyC, keyB, keyA}, "signer_group_version": 3, "idempotency_key": idem},
		&endorsement.RemoveSignersFromGroupIntent{GroupId: group, MembersToRemove: []string{keyC, keyB, keyA}, SignerGroupVersion: 3, IdempotencyKey: idem})

	add("governance clears both settings", "update_signer_group_governance",
		map[string]any{"signer_group_id": group, "signer_group_version": 0, "idempotency_key": idem},
		&endorsement.UpdateSignerGroupGovernanceIntent{SignerGroupId: group, SignerGroupVersion: 0, IdempotencyKey: idem})
	add("governance threshold only", "update_signer_group_governance",
		map[string]any{"signer_group_id": group, "signer_group_version": 3, "idempotency_key": idem, "governance_threshold": 2},
		&endorsement.UpdateSignerGroupGovernanceIntent{SignerGroupId: group, SignerGroupVersion: 3, IdempotencyKey: idem, GovernanceThreshold: i32(2)})
	add("governance governing group only", "update_signer_group_governance",
		map[string]any{"signer_group_id": group, "signer_group_version": 5, "idempotency_key": idem, "governance_signer_group_id": gov},
		&endorsement.UpdateSignerGroupGovernanceIntent{SignerGroupId: group, SignerGroupVersion: 5, IdempotencyKey: idem, GovernanceSignerGroupId: str(gov)})
	add("governance both settings", "update_signer_group_governance",
		map[string]any{"signer_group_id": group, "signer_group_version": 12, "idempotency_key": idem, "governance_threshold": 3, "governance_signer_group_id": gov},
		&endorsement.UpdateSignerGroupGovernanceIntent{SignerGroupId: group, SignerGroupVersion: 12, IdempotencyKey: idem, GovernanceThreshold: i32(3), GovernanceSignerGroupId: str(gov)})

	add("crypto destination on an EVM network", "create_crypto_destination",
		map[string]any{"recipient_id": "3MF9wAqM2HQHe7eiQ1OU1ovUuWt", "network_id": "ethereum-sepolia", "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1", "signer_group_id": group, "idempotency_key": idem},
		&endorsement.CreateCryptoDestinationIntent{RecipientId: "3MF9wAqM2HQHe7eiQ1OU1ovUuWt", NetworkId: "ethereum-sepolia", Address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1", SignerGroupId: group, IdempotencyKey: idem})
	add("crypto destination on Solana", "create_crypto_destination",
		map[string]any{"recipient_id": "3MF9wAqM2HQHe7eiQ1OU1ovUuWt", "network_id": "solana-devnet", "address": "7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV", "signer_group_id": group, "idempotency_key": idem},
		&endorsement.CreateCryptoDestinationIntent{RecipientId: "3MF9wAqM2HQHe7eiQ1OU1ovUuWt", NetworkId: "solana-devnet", Address: "7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV", SignerGroupId: group, IdempotencyKey: idem})

	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	enc.SetEscapeHTML(false)
	if err := enc.Encode(map[string]any{
		"source":  "policy-engine pkg/intent.CanonicalIntentBytes (generator: ENG-6468)",
		"vectors": out,
	}); err != nil {
		panic(err)
	}
}
