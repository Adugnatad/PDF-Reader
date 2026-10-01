/**
 * Utility for resolving authentic, human-readable document titles and page counts
 * from PDF binaries, metadata dictionaries, XMP packets, and device storage paths.
 * Prevents raw UUIDs, content hashes, and temporary cache filenames from appearing in the UI.
 */

export interface PdfMetadataInfo {
  title: string | null;
  pageCount: number;
}

// Known persistent mapping from native URI to user-facing name
const knownUriNames = new Map<string, string>();

export function registerKnownPdfName(uri: string, name: string): void {
  if (!uri || !name) return;
  const cleanUri = uri.replace('file://', '');
  knownUriNames.set(uri, name);
  knownUriNames.set(cleanUri, name);
}

export function getKnownPdfName(uri: string): string | undefined {
  if (!uri) return undefined;
  const cleanUri = uri.replace('file://', '');
  return knownUriNames.get(uri) || knownUriNames.get(cleanUri);
}

/**
 * Checks whether a given filename is an ugly system-generated UUID, GUID, hash, or temporary cache name.
 * e.g. "dc1284d9-3c19-4452-92e8-2da71358b54b.pdf"
 */
export function isUuidOrHash(name: string): boolean {
  if (!name) return true;
  const clean = name.replace(/\.pdf$/i, '').trim();

  // Standard UUID format: 8-4-4-4-12 hex digits
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean)) {
    return true;
  }

  // Hex hash (e.g. MD5, SHA1, SHA256 or random 24+ hex string)
  if (/^[0-9a-f]{20,64}$/i.test(clean)) {
    return true;
  }

  // Temporary system cache prefixes, e.g. "document_172778...", "tmp_...", "cache_..."
  if (/^(tmp|temp|cache|doc|document)[-_0-9a-f]{10,}/i.test(clean)) {
    return true;
  }

  // Raw numeric timestamp or random ID
  if (/^[0-9]{10,18}$/.test(clean)) {
    return true;
  }

  return false;
}

/**
 * Decodes a PDF hexadecimal string (ASCII, UTF-8, or UTF-16BE BOM)
 */
function decodePdfHexString(hex: string): string {
  const clean = hex.replace(/\s+/g, '');
  let str = '';

  if (clean.toLowerCase().startsWith('feff')) {
    // UTF-16BE encoding
    for (let i = 4; i < clean.length; i += 4) {
      str += String.fromCharCode(parseInt(clean.substr(i, 4), 16));
    }
  } else {
    // Standard ASCII / ISO-8859-1
    for (let i = 0; i < clean.length; i += 2) {
      str += String.fromCharCode(parseInt(clean.substr(i, 2), 16));
    }
  }
  return str.trim();
}

/**
 * Cleans and sanitizes a document title string into a proper `.pdf` file name
 */
export function cleanDocumentName(raw: string): string {
  if (!raw) return '';
  let clean = raw
    .replace(/\\([()\\])/g, '$1')
    .replace(/[\0-\x1F\x7F-\x9F]/g, '')
    .trim();

  // Strip invalid filename characters
  clean = clean.replace(/[/\\:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim();

  if (clean.toLowerCase().endsWith('.pdf')) {
    clean = clean.slice(0, -4).trim();
  }

  return clean ? `${clean}.pdf` : '';
}

/**
 * Fast, lightweight extraction of Title and PageCount from PDF binary bytes (ArrayBuffer or Uint8Array)
 */
export function extractPdfInfoFromBytes(
  buffer: ArrayBuffer | Uint8Array
): PdfMetadataInfo {
  let bytes: Uint8Array;
  if (buffer instanceof Uint8Array) {
    bytes = buffer;
  } else {
    bytes = new Uint8Array(buffer);
  }

  if (bytes.length < 10) {
    return { title: null, pageCount: 1 };
  }

  // Sample header (up to 500 KB) and trailer (last 50 KB) where Info and XMP metadata reside
  const headerSlice = bytes.subarray(0, Math.min(bytes.length, 500000));
  const trailerSlice =
    bytes.length > 50000 ? bytes.subarray(bytes.length - 50000) : new Uint8Array(0);

  let headerText = '';
  for (let i = 0; i < headerSlice.length; i++) {
    headerText += String.fromCharCode(headerSlice[i]);
  }

  let trailerText = '';
  for (let i = 0; i < trailerSlice.length; i++) {
    trailerText += String.fromCharCode(trailerSlice[i]);
  }

  const fullScan = headerText + '\n' + trailerText;

  let title: string | null = null;

  // 1. Check Info dictionary /Title (literal string)
  const parenMatch = fullScan.match(/\/Title\s*\(([^)\r\n]{1,160})\)/i);
  if (parenMatch && parenMatch[1].trim()) {
    let raw = parenMatch[1].trim();
    if (raw.charCodeAt(0) === 0xfe && raw.charCodeAt(1) === 0xff) {
      // UTF-16BE BOM
      let decoded = '';
      for (let i = 2; i < raw.length; i += 2) {
        decoded += String.fromCharCode(
          (raw.charCodeAt(i) << 8) | raw.charCodeAt(i + 1)
        );
      }
      raw = decoded;
    }
    const cleaned = cleanDocumentName(raw);
    if (cleaned && !isUuidOrHash(cleaned)) {
      title = cleaned;
    }
  }

  // 2. Check /Title <hex string>
  if (!title) {
    const hexMatch = fullScan.match(/\/Title\s*<([0-9a-fA-F\s]{4,320})>/i);
    if (hexMatch) {
      const decoded = decodePdfHexString(hexMatch[1]);
      const cleaned = cleanDocumentName(decoded);
      if (cleaned && !isUuidOrHash(cleaned)) {
        title = cleaned;
      }
    }
  }

  // 3. Check XMP metadata <dc:title>
  if (!title) {
    const xmpMatch = fullScan.match(
      /<dc:title>[\s\S]*?<rdf:li[^>]*>([^<]{1,160})<\/rdf:li>/i
    );
    if (xmpMatch && xmpMatch[1].trim()) {
      const cleaned = cleanDocumentName(xmpMatch[1].trim());
      if (cleaned && !isUuidOrHash(cleaned)) {
        title = cleaned;
      }
    }
  }

  // 4. Check first text heading in first content stream if still no title
  if (!title) {
    const tjMatches = [...headerText.matchAll(/\(([^)\r\n]{3,60})\)\s*Tj/g)];
    for (const m of tjMatches) {
      const candidate = m[1].trim();
      if (
        candidate &&
        !/^[\d\s.,\-_/\\:;]+$/.test(candidate) &&
        !candidate.toLowerCase().includes('pdf') &&
        candidate.length >= 3 &&
        candidate.length <= 50
      ) {
        const cleaned = cleanDocumentName(candidate);
        if (cleaned && !isUuidOrHash(cleaned)) {
          title = cleaned;
          break;
        }
      }
    }
  }

  // Extract Page Count
  let pageCount = 1;
  const countMatches = [
    ...fullScan.matchAll(/\/Type\s*\/Pages[\s\S]*?\/Count\s+(\d+)/gi),
  ];
  if (countMatches.length > 0) {
    const val = parseInt(countMatches[countMatches.length - 1][1], 10);
    if (val > 0 && val < 10000) {
      pageCount = val;
    }
  } else {
    const pageTypes = [...fullScan.matchAll(/\/Type\s*\/Page\b/gi)];
    if (pageTypes.length > 0) {
      pageCount = Math.min(pageTypes.length, 5000);
    }
  }

  return { title, pageCount };
}

/**
 * Resolves a final, human-readable file name for a PDF item:
 * 1. Checks if URI was previously mapped to a picker name
 * 2. If the current name is a UUID / hash, extracts Title from PDF bytes
 * 3. Falls back to a clean formatted name like "Document (59 KB).pdf"
 */
export function resolvePdfDisplayName(
  rawName: string,
  uri?: string,
  buffer?: ArrayBuffer | Uint8Array,
  sizeBytes?: number
): { name: string; pageCount?: number } {
  // 1. Check known URI name registry
  if (uri) {
    const known = getKnownPdfName(uri);
    if (known && !isUuidOrHash(known)) {
      return { name: cleanDocumentName(known) };
    }
  }

  // 2. If rawName is already human-readable and not a UUID
  if (rawName && !isUuidOrHash(rawName)) {
    return { name: cleanDocumentName(rawName) };
  }

  // 3. If rawName is a UUID / hash, inspect the PDF binary bytes
  if (buffer) {
    const info = extractPdfInfoFromBytes(buffer);
    if (info.title) {
      return { name: info.title, pageCount: info.pageCount };
    }
    if (info.pageCount > 1) {
      const sizeStr = sizeBytes
        ? sizeBytes > 1024 * 1024
          ? `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
          : `${Math.round(sizeBytes / 1024)} KB`
        : '';
      const fallback = sizeStr
        ? `PDF Document (${sizeStr}).pdf`
        : 'PDF Document.pdf';
      return { name: fallback, pageCount: info.pageCount };
    }
  }

  // 4. Fallback formatting
  const sizeStr = sizeBytes
    ? sizeBytes > 1024 * 1024
      ? `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(sizeBytes / 1024)} KB`
    : '';

  const fallback = sizeStr
    ? `PDF Document (${sizeStr}).pdf`
    : 'Device Document.pdf';
  return { name: fallback };
}
