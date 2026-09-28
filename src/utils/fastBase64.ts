import * as base64js from 'base64-js';

/**
 * Ultra-fast binary to Base64 encoder using base64-js.
 * Fully compatible with React Native Hermes, Android, iOS, and Web.
 * Does not depend on global Buffer, window, or btoa.
 */
export function fastUint8ToBase64(uint8: Uint8Array | ArrayBuffer): string {
  const bytes = uint8 instanceof Uint8Array ? uint8 : new Uint8Array(uint8);
  return base64js.fromByteArray(bytes);
}

export function fastBase64ToUint8(base64: string): Uint8Array {
  return base64js.toByteArray(base64);
}
