/**
 * RFC 8785 (JCS) canonical JSON — the exact bytes the platform signs.
 *
 * A payload canonicalized here matches the platform's `enc.C14nJSON`
 * (json.Marshal + jsoncanonicalizer.Transform) byte-for-byte, so a
 * signature produced from the result verifies server-side.
 *
 * This implementation covers the value shapes the SDK ever puts into a
 * signed payload: nulls, booleans, finite integers/floats, strings,
 * arrays, and plain object maps. It intentionally does NOT handle
 * non-integer numbers with fractional parts differently from
 * JSON.stringify, because every mandate/endorsement payload the SDK
 * produces uses only integers, strings, arrays, and object maps — decimal
 * amounts are always sent as strings.
 */

/**
 * RFC 8785 (JCS) canonicalize `value` and return its bytes as a UTF-8 string.
 *
 * @throws if `value` contains a non-finite number, a Symbol, a bigint, or a
 *   circular reference — any of which cannot be encoded to canonical JSON.
 */
export function canonicalJSON(value: unknown): string {
  return canonicalize(value);
}

function canonicalize(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError(`canonical JSON: non-finite number ${value}`);
    }
    // JSON.stringify already emits ES6 Number.prototype.toString() for
    // finite numbers, which is exactly what RFC 8785 § 3.2.2.3 mandates.
    return JSON.stringify(value);
  }
  if (typeof value === 'string') {
    // JSON.stringify handles JSON escape sequences per RFC 8259, matching
    // JCS's string-escape rules (§ 3.2.2.2).
    return JSON.stringify(value);
  }
  if (typeof value === 'bigint') {
    // BigInts have no unambiguous number representation for JSON;
    // fail loudly rather than produce bytes that won't verify.
    throw new TypeError('canonical JSON: bigint values are not supported');
  }
  if (Array.isArray(value)) {
    const parts = value.map((item) => canonicalize(item));
    return `[${parts.join(',')}]`;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    // JCS sorts object member keys by their UTF-16 code-unit order,
    // which is exactly what a JavaScript `Array.prototype.sort()` on
    // strings produces (§ 3.2.3).
    const keys = Object.keys(obj).sort();
    const parts = keys.map((key) => `${JSON.stringify(key)}:${canonicalize(obj[key])}`);
    return `{${parts.join(',')}}`;
  }
  throw new TypeError(`canonical JSON: unsupported value type ${typeof value}`);
}
