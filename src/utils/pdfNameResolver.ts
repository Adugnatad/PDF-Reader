import { PDFDocument } from 'pdf-lib';

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

  // Hex hash (e.g. MD5, SHA1, SHA256 or random 20+ hex string)
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

export function isJunkDocument(name: string, id?: string): boolean {
  const n = (name || '').toLowerCase().trim();
  const i = (id || '').toLowerCase().trim();
  if (n.startsWith('expo-file') || i.includes('expo-file')) return true;
  if (n.includes('data user 0') || i.includes('data user 0')) return true;
  if (n.includes('com.adugna12') || i.includes('com.adugna12')) return true;
  if (n.startsWith('device-pdf-') || i.startsWith('device-pdf-')) return true;
  if (n === 'document.pdf' || n.startsWith('document.') || n.startsWith('document (')) return true;
  if (i.includes('app-doc-expo')) return true;
  if (n.includes('tmp_') || n.includes('cache_')) return true;
  return false;
}

/**
 * Detects generic junk titles like "Untitled", "Microsoft Word - Document1"
 */
export function isJunkTitle(title: string): boolean {
  if (!title) return true;
  const lower = title.toLowerCase().trim();
  if (isUuidOrHash(lower)) return true;

  const junkKeywords = [
    'untitled',
    'document',
    'microsoft word',
    'word document',
    'presentation',
    'page 1',
    'sheet1',
    'print',
    'scan',
    'export',
    'default',
    'layout',
    'template',
    'pdf document',
    'device document',
  ];

  for (const junk of junkKeywords) {
    if (lower === junk || lower.startsWith(junk + ' -') || lower.startsWith(junk + ' 1')) {
      return true;
    }
  }
  return false;
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
 * Safe, accurate extraction of Title and PageCount from PDF binary bytes using pdf-lib
 */
export async function extractPdfInfoFromBytesAsync(
  buffer: ArrayBuffer | Uint8Array
): Promise<PdfMetadataInfo> {
  try {
    const doc = await PDFDocument.load(buffer, {
      ignoreEncryption: true,
      parseSpeed: 1,
    });
    const pageCount = doc.getPageCount();
    const rawTitle = doc.getTitle();
    const rawSubject = doc.getSubject();

    let title: string | null = null;
    if (rawTitle && rawTitle.trim() && !isJunkTitle(rawTitle) && !isUuidOrHash(rawTitle)) {
      title = cleanDocumentName(rawTitle);
    } else if (rawSubject && rawSubject.trim() && !isJunkTitle(rawSubject) && !isUuidOrHash(rawSubject)) {
      title = cleanDocumentName(rawSubject);
    }

    if (pageCount && pageCount > 0) {
      return { title, pageCount };
    }
  } catch {
    // Fall back to robust binary stream parsing
  }

  return extractPdfInfoFromBytes(buffer);
}

/**
 * Robust binary fallback extractor for page count and title.
 * Analyzes both head and tail of the file for /Pages /Count and /Type /Page objects.
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

  // Sample beginning (head) and end (tail) of the file
  const headLimit = Math.min(bytes.length, 350000);
  let headText = '';
  for (let i = 0; i < headLimit; i++) {
    headText += String.fromCharCode(bytes[i]);
  }

  let tailText = '';
  if (bytes.length > 350000) {
    const tailStart = Math.max(0, bytes.length - 350000);
    for (let i = tailStart; i < bytes.length; i++) {
      tailText += String.fromCharCode(bytes[i]);
    }
  }

  const combinedText = headText + '\n' + tailText;

  let title: string | null = null;
  const titleMatch = combinedText.match(/\/Title\s*(?:\(([^)\r\n]{2,120})\)|<([0-9a-fA-F]{4,240})>)/i);
  if (titleMatch) {
    let rawTitle = '';
    if (titleMatch[1]) {
      rawTitle = titleMatch[1].trim();
    } else if (titleMatch[2]) {
      const hex = titleMatch[2];
      try {
        for (let k = 0; k < hex.length; k += 2) {
          const code = parseInt(hex.substr(k, 2), 16);
          if (code >= 32 && code <= 126) rawTitle += String.fromCharCode(code);
        }
      } catch {}
    }
    if (rawTitle) {
      const candidate = cleanDocumentName(rawTitle);
      if (candidate && !isJunkTitle(candidate) && !isUuidOrHash(candidate)) {
        title = candidate;
      }
    }
  }

  let pageCount = 1;
  const foundCounts: number[] = [];

  // Match /Type /Pages ... /Count N (or /Pages ... /Count N)
  const forwardMatches = combinedText.matchAll(/(?:\/Type\s*\/Pages|\/Pages)[\s\S]{0,400}?\/Count\s+(\d+)/gi);
  for (const m of forwardMatches) {
    const val = parseInt(m[1], 10);
    if (val > 0 && val < 50000) foundCounts.push(val);
  }

  // Match /Count N ... /Type /Pages
  const reverseMatches = combinedText.matchAll(/\/Count\s+(\d+)[\s\S]{0,400}?(?:\/Type\s*\/Pages|\/Pages)/gi);
  for (const m of reverseMatches) {
    const val = parseInt(m[1], 10);
    if (val > 0 && val < 50000) foundCounts.push(val);
  }

  if (foundCounts.length > 0) {
    // The root /Pages node has the total page count across the document tree
    pageCount = Math.max(...foundCounts);
  } else {
    // Count individual /Type /Page (singular) objects
    const pageNodes = combinedText.match(/\/Type\s*\/Page(?!\w)/gi);
    if (pageNodes && pageNodes.length > 0) {
      pageCount = pageNodes.length;
    }
  }

  return { title, pageCount: Math.max(1, pageCount) };
}

/**
 * Resolves the final display name and page count:
 * - If rawName is already a valid human-readable file name (e.g. "Remember.pdf"), IT IS ALWAYS PRESERVED.
 * - If rawName is a UUID, checks the known registered name, then metadata, then fallback.
 */
export function resolvePdfDisplayName(
  rawName: string,
  uri?: string,
  buffer?: ArrayBuffer | Uint8Array,
  sizeBytes?: number
): { name: string; pageCount?: number } {
  // 1. If rawName is already a proper human-readable filename, KEEP IT!
  if (rawName && !isUuidOrHash(rawName)) {
    let pageCount: number | undefined;
    if (buffer) {
      const info = extractPdfInfoFromBytes(buffer);
      pageCount = info.pageCount;
    }
    return { name: cleanDocumentName(rawName), pageCount };
  }

  // 2. Check known URI name registry
  if (uri) {
    const known = getKnownPdfName(uri);
    if (known && !isUuidOrHash(known)) {
      let pageCount: number | undefined;
      if (buffer) {
        const info = extractPdfInfoFromBytes(buffer);
        pageCount = info.pageCount;
      }
      return { name: cleanDocumentName(known), pageCount };
    }
  }

  // 3. If rawName is a UUID, extract valid metadata title
  if (buffer) {
    const info = extractPdfInfoFromBytes(buffer);
    if (info.title && !isJunkTitle(info.title)) {
      return { name: info.title, pageCount: info.pageCount };
    }
    if (info.pageCount > 1) {
      return { name: `Document (${info.pageCount} pages).pdf`, pageCount: info.pageCount };
    }
  }

  // 4. Clean fallback for unknown UUID files
  const sizeStr = sizeBytes
    ? sizeBytes > 1024 * 1024
      ? `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(sizeBytes / 1024)} KB`
    : '';

  const fallback = sizeStr ? `Document (${sizeStr}).pdf` : 'Document.pdf';
  return { name: fallback };
}
