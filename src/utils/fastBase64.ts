/**
 * High-performance binary to Base64 encoder for React Native Hermes and Web.
 * Uses 32KB chunked transformations to avoid single-character string allocations
 * that cause multi-second UI thread freezes on mobile devices.
 */
export function fastUint8ToBase64(uint8: Uint8Array | ArrayBuffer): string {
  const bytes = uint8 instanceof Uint8Array ? uint8 : new Uint8Array(uint8);

  // If Node / Polyfilled Buffer is available
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
  }

  // 32KB chunks prevent call stack limits while achieving near-native speed
  const CHUNK_SIZE = 0x8000;
  const chunks: string[] = [];
  const len = bytes.length;

  for (let i = 0; i < len; i += CHUNK_SIZE) {
    const end = Math.min(i + CHUNK_SIZE, len);
    chunks.push(String.fromCharCode.apply(null, bytes.subarray(i, end) as any));
  }

  return btoa(chunks.join(''));
}
