/**
 * Polyfills for modern ECMAScript features required by pdfjs-dist v6.3+
 * Ensures 100% compatibility across all browser engines, iframes, mobile webviews,
 * and older Chromium/WebKit versions.
 */

// 1. Promise.withResolvers
if (typeof (Promise as any).withResolvers !== 'function') {
  (Promise as any).withResolvers = function <T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: any) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

// 2. Promise.try
if (typeof (Promise as any).try !== 'function') {
  (Promise as any).try = function <T>(fn: (...args: any[]) => T, ...args: any[]): Promise<T> {
    return new Promise((resolve) => resolve(fn(...args)));
  };
}

// 3. Uint8Array.prototype.toHex
if (typeof (Uint8Array.prototype as any).toHex !== 'function') {
  (Uint8Array.prototype as any).toHex = function () {
    return Array.from(this)
      .map((b: any) => Number(b).toString(16).padStart(2, '0'))
      .join('');
  };
}

// 4. Uint8Array.fromHex
if (typeof (Uint8Array as any).fromHex !== 'function') {
  (Uint8Array as any).fromHex = function (hex: string) {
    const clean = hex.replace(/\s+/g, '');
    const bytes = new Uint8Array(Math.floor(clean.length / 2));
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  };
}

// 5. URL.parse
if (typeof (URL as any).parse !== 'function') {
  (URL as any).parse = function (url: string, base?: string) {
    try {
      return new URL(url, base);
    } catch {
      return null;
    }
  };
}
