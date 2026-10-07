import { Platform } from 'react-native';
import { pdfStore } from './pdfStore';
import { pdfjsLib } from './pdfService';
import { fastUint8ToBase64 } from '../utils/fastBase64';
import {
  saveThumbnailsToDisk,
  loadThumbnailsFromDisk,
} from './storageHelper';

type ThumbnailListener = (fileId: string, dataUrl: string) => void;

function cloneBufferSafe(data: Uint8Array | ArrayBuffer): Uint8Array {
  const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
  const copy = new Uint8Array(u8.byteLength);
  copy.set(u8);
  return copy;
}

/**
 * Searches for embedded JPEG image stream inside raw PDF binary bytes.
 * Scanned PDFs, contracts with photos/logos, and photo-based PDFs embed JPEGs directly.
 */
function extractEmbeddedJpeg(bytes: Uint8Array): string | null {
  const maxScan = Math.min(bytes.length, 3 * 1024 * 1024);
  for (let i = 0; i < maxScan - 4; i++) {
    // Check for JPEG magic header: 0xFF 0xD8 0xFF
    if (bytes[i] === 0xff && bytes[i + 1] === 0xd8 && bytes[i + 2] === 0xff) {
      // Find matching JPEG EOI marker: 0xFF 0xD9
      const endLimit = Math.min(bytes.length, i + 1024 * 1024);
      for (let j = i + 200; j < endLimit - 1; j++) {
        if (bytes[j] === 0xff && bytes[j + 1] === 0xd9) {
          const slice = bytes.subarray(i, j + 2);
          if (slice.length >= 800) {
            return `data:image/jpeg;base64,${fastUint8ToBase64(slice)}`;
          }
        }
      }
    }
  }
  return null;
}

/**
 * Generates an authentic SVG vector preview of a document page.
 * Renders like a real A4 sheet with title, header band, and realistic paragraph lines.
 */
function generateDocumentVectorPreview(docTitle: string): string {
  const cleanTitle = (docTitle || 'PDF Document')
    .replace(/\.pdf$/i, '')
    .trim()
    .slice(0, 24);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 130" width="100" height="130">
    <defs>
      <linearGradient id="pageGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="100%" stop-color="#f1f5f9"/>
      </linearGradient>
      <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#ef4444"/>
        <stop offset="100%" stop-color="#f87171"/>
      </linearGradient>
    </defs>
    <!-- Paper Sheet Background -->
    <rect x="0" y="0" width="100" height="130" rx="6" fill="url(#pageGrad)"/>
    <!-- Page Header Accent -->
    <rect x="8" y="10" width="84" height="4" rx="2" fill="url(#headerGrad)"/>
    <!-- Title Line -->
    <rect x="8" y="18" width="55" height="5" rx="1.5" fill="#1e293b"/>
    <!-- Document Text Lines -->
    <rect x="8" y="28" width="84" height="2.5" rx="1" fill="#94a3b8"/>
    <rect x="8" y="34" width="80" height="2.5" rx="1" fill="#cbd5e1"/>
    <rect x="8" y="40" width="84" height="2.5" rx="1" fill="#cbd5e1"/>
    <rect x="8" y="46" width="60" height="2.5" rx="1" fill="#cbd5e1"/>

    <!-- Mid Section Block -->
    <rect x="8" y="55" width="40" height="20" rx="3" fill="#e2e8f0"/>
    <rect x="52" y="56" width="40" height="2.5" rx="1" fill="#94a3b8"/>
    <rect x="52" y="62" width="36" height="2.5" rx="1" fill="#cbd5e1"/>
    <rect x="52" y="68" width="38" height="2.5" rx="1" fill="#cbd5e1"/>

    <!-- Bottom Paragraph Lines -->
    <rect x="8" y="82" width="84" height="2.5" rx="1" fill="#cbd5e1"/>
    <rect x="8" y="88" width="84" height="2.5" rx="1" fill="#cbd5e1"/>
    <rect x="8" y="94" width="70" height="2.5" rx="1" fill="#cbd5e1"/>
    <rect x="8" y="100" width="45" height="2.5" rx="1" fill="#cbd5e1"/>

    <!-- Signature / Footer Seal -->
    <line x1="8" y1="112" x2="38" y2="112" stroke="#94a3b8" stroke-width="1.5"/>
    <rect x="74" y="106" width="18" height="12" rx="2" fill="#ef4444" opacity="0.15"/>
    <text x="83" y="115" font-family="system-ui, sans-serif" font-size="7" font-weight="900" fill="#dc2626" text-anchor="middle">PDF</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

class PdfThumbnailService {
  private cache: Map<string, string> = new Map();
  private pending: Map<string, Promise<string | null>> = new Map();
  private listeners: Set<ThumbnailListener> = new Set();
  private initPromise: Promise<void>;
  private isSaveScheduled = false;

  constructor() {
    this.initPromise = this.initFromStorage();
  }

  private async initFromStorage(): Promise<void> {
    try {
      const saved = await loadThumbnailsFromDisk();
      if (saved) {
        const obj = JSON.parse(saved);
        if (typeof obj === 'object' && obj !== null) {
          for (const [k, v] of Object.entries(obj)) {
            if (typeof v === 'string' && v.startsWith('data:image/')) {
              this.cache.set(k, v);
            }
          }
        }
      }
    } catch (e) {
      console.warn('Init thumbnail storage note:', e);
    }
  }

  private scheduleSave(): void {
    if (this.isSaveScheduled) return;
    this.isSaveScheduled = true;
    setTimeout(() => {
      this.isSaveScheduled = false;
      try {
        const obj: Record<string, string> = {};
        let count = 0;
        // Limit persistent cache to latest 80 thumbnails to keep storage lightweight
        for (const [k, v] of this.cache.entries()) {
          if (count++ > 80) break;
          obj[k] = v;
        }
        saveThumbnailsToDisk(JSON.stringify(obj)).catch(() => {});
      } catch {}
    }, 1500);
  }

  public subscribe(listener: ThumbnailListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(fileId: string, dataUrl: string): void {
    this.listeners.forEach((l) => {
      try {
        l(fileId, dataUrl);
      } catch {}
    });
  }

  /**
   * Synchronously checks if a thumbnail is already available in memory.
   */
  public getThumbnailSync(fileId: string, fileName?: string): string | null {
    if (this.cache.has(fileId)) return this.cache.get(fileId)!;
    if (fileName && this.cache.has(fileName)) return this.cache.get(fileName)!;
    return null;
  }

  /**
   * Explicitly stores a confirmed thumbnail (e.g. from reader render).
   */
  public saveThumbnail(fileIdOrName: string, dataUrl: string): void {
    if (!fileIdOrName || !dataUrl) return;
    this.cache.set(fileIdOrName, dataUrl);
    this.notify(fileIdOrName, dataUrl);
    this.scheduleSave();
  }

  /**
   * Loads or lazily generates a high-fidelity thumbnail for the given document.
   */
  public async getThumbnail(
    fileId: string,
    fileName: string = ''
  ): Promise<string | null> {
    await this.initPromise;

    // 1. In-memory cache hit
    const cached = this.getThumbnailSync(fileId, fileName);
    if (cached) return cached;

    // 2. Already in-flight task
    const taskKey = fileId;
    if (this.pending.has(taskKey)) {
      return this.pending.get(taskKey)!;
    }

    const task = (async () => {
      try {
        // Fetch raw document data
        const item = await pdfStore.getPdfData(fileId);
        if (!item || !item.data) return null;

        const bytes =
          item.data instanceof Uint8Array
            ? item.data
            : new Uint8Array(item.data);

        // A. On Web: Use PDF.js to render authentic first page to offscreen Canvas
        if (typeof document !== 'undefined') {
          try {
            const workerCopy = cloneBufferSafe(bytes);
            const loadingTask = pdfjsLib.getDocument({
              data: workerCopy,
            });
            const doc = await loadingTask.promise;
            if (doc && doc.numPages > 0) {
              const page = await doc.getPage(1);
              // Scale to a sharp ~120px width preview
              const baseVp = page.getViewport({ scale: 1.0 });
              const targetWidth = 120;
              const scale = targetWidth / Math.max(1, baseVp.width);
              const vp = page.getViewport({ scale });

              const canvas = document.createElement('canvas');
              canvas.width = Math.floor(vp.width);
              canvas.height = Math.floor(vp.height);
              const ctx = canvas.getContext('2d');
              if (ctx) {
                await (page.render as any)({ canvasContext: ctx, viewport: vp, canvas })
                  .promise;
                const thumbDataUrl = canvas.toDataURL('image/jpeg', 0.82);

                if (thumbDataUrl && thumbDataUrl.startsWith('data:image/')) {
                  this.cache.set(fileId, thumbDataUrl);
                  if (fileName) this.cache.set(fileName, thumbDataUrl);
                  this.notify(fileId, thumbDataUrl);
                  this.scheduleSave();
                  return thumbDataUrl;
                }
              }
            }
          } catch (webErr) {
            // Fall through to embedded / vector extraction
          }
        }

        // B. Pure-JS Embedded JPEG extraction (fast across iOS, Android, and Web)
        const embeddedJpeg = extractEmbeddedJpeg(bytes);
        if (embeddedJpeg) {
          this.cache.set(fileId, embeddedJpeg);
          if (fileName) this.cache.set(fileName, embeddedJpeg);
          this.notify(fileId, embeddedJpeg);
          this.scheduleSave();
          return embeddedJpeg;
        }

        // C. Clean SVG Vector Document Preview
        const svgPreview = generateDocumentVectorPreview(fileName || item.name || fileId);
        this.cache.set(fileId, svgPreview);
        if (fileName) this.cache.set(fileName, svgPreview);
        this.notify(fileId, svgPreview);
        this.scheduleSave();
        return svgPreview;
      } catch (err) {
        console.warn('Generate thumbnail note:', err);
        return null;
      } finally {
        this.pending.delete(taskKey);
      }
    })();

    this.pending.set(taskKey, task);
    return task;
  }
}

export const pdfThumbnailService = new PdfThumbnailService();
