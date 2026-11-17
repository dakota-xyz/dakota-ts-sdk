/**
 * Byte helpers that work the same in browsers, React Native and Node, with
 * no `Buffer` and no `node:` import, so the governance entry point stays
 * bundle-safe.
 */

const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Standard base64 (RFC 4648 §4), padded. */
export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8) | bytes[i + 2]!;
    out +=
      B64_ALPHABET[(n >> 18) & 63]! +
      B64_ALPHABET[(n >> 12) & 63]! +
      B64_ALPHABET[(n >> 6) & 63]! +
      B64_ALPHABET[n & 63]!;
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = bytes[i]! << 16;
    out += B64_ALPHABET[(n >> 18) & 63]! + B64_ALPHABET[(n >> 12) & 63]! + '==';
  } else if (rest === 2) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8);
    out +=
      B64_ALPHABET[(n >> 18) & 63]! +
      B64_ALPHABET[(n >> 12) & 63]! +
      B64_ALPHABET[(n >> 6) & 63]! +
      '=';
  }
  return out;
}

/** base64url (RFC 4648 §5), unpadded — the encoding WebAuthn uses. */
export function bytesToBase64url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decode base64 in either alphabet, padded or not.
 *
 * @throws on characters outside both alphabets or an impossible length.
 */
export function base64ToBytes(input: string): Uint8Array {
  const s = input.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  if (!/^[A-Za-z0-9+/]*$/.test(s) || s.length % 4 === 1) {
    throw new TypeError('invalid base64 or base64url string');
  }
  const out = new Uint8Array(Math.floor((s.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < s.length; i += 4) {
    const a = B64_ALPHABET.indexOf(s[i]!);
    const b = B64_ALPHABET.indexOf(s[i + 1]!);
    const c = i + 2 < s.length ? B64_ALPHABET.indexOf(s[i + 2]!) : 0;
    const d = i + 3 < s.length ? B64_ALPHABET.indexOf(s[i + 3]!) : 0;
    const n = (a << 18) | (b << 12) | (c << 6) | d;
    out[o++] = (n >> 16) & 255;
    if (i + 2 < s.length) out[o++] = (n >> 8) & 255;
    if (i + 3 < s.length) out[o++] = n & 255;
  }
  return out;
}

/** UTF-8 bytes of a string. */
export function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

/** A copy of any BufferSource as a plain Uint8Array. */
export function toBytes(source: ArrayBuffer | ArrayBufferView): Uint8Array {
  // isView / toString instead of instanceof: buffers from another realm
  // (an iframe, jsdom, some React Native bridges) fail `instanceof`.
  if (ArrayBuffer.isView(source)) {
    return new Uint8Array(source.buffer, source.byteOffset, source.byteLength).slice();
  }
  if (Object.prototype.toString.call(source) === '[object ArrayBuffer]') {
    return new Uint8Array((source as ArrayBuffer).slice(0));
  }
  throw new TypeError('expected an ArrayBuffer or a typed array');
}
