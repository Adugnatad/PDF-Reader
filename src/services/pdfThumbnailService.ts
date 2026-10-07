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
 */
function extractEmbeddedJpeg(bytes: Uint8Array): string | null {
  const maxScan = Math.min(bytes.length, 3 * 1024 * 1024);
  for (let i = 0; i < maxScan - 4; i++) {
    // Check for JPEG magic header: 0xFF 0xD8 0xFF
    if (bytes[i] === 0xff && bytes[i + 1] === 0xd8 && bytes[i + 2] === 0xff) {
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
      if (typeof loadThumbnailsFromDisk === 'function') {
        const saved = await loadThumbnailsFromDisk();
        if (saved) {
          const obj = JSON.parse(saved);
          if (obj && typeof obj === 'object') {
            for (const k in obj) {
              if (Object.prototype.hasOwnProperty.call(obj, k)) {
                const v = obj[k];
                if (typeof v === 'string' && v.startsWith('data:image/')) {
                  this.cache.set(k, v);
                }
              }
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
        if (typeof saveThumbnailsToDisk === 'function') {
          saveThumbnailsToDisk(JSON.stringify(obj)).catch(() => {});
        }
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
              const baseVp = page.getViewport({ scale: 1.0 });
              const targetWidth = 160;
              const scale = targetWidth / Math.max(1, baseVp.width);
              const vp = page.getViewport({ scale });

              const canvas = document.createElement('canvas');
              canvas.width = Math.floor(vp.width);
              canvas.height = Math.floor(vp.height);
              const ctx = canvas.getContext('2d');
              if (ctx) {
                // Fill crisp white background so transparent pages don't render black or empty
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                await (page.render as any)({ canvasContext: ctx, viewport: vp, canvas })
                  .promise;
                const thumbDataUrl = canvas.toDataURL('image/jpeg', 0.85);

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

        // C. On native, return null so NativeDocumentSheet renders crisp UI
        return null;
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
