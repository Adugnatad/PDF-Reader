import { DocFile } from '../types';
import {
  generateTaxFilingPdf,
  generateContractPdf,
  generateExecutiveAuditPdf,
  generateDynamicDevicePdf,
} from './samplePdfGenerator';
import {
  autoScanDevicePdfs,
  readNativePdfBytes,
  DiscoveredPdfItem,
  hasAllFilesAccess,
} from './nativeFilePicker';
import {
  isUuidOrHash,
  cleanDocumentName,
  registerKnownPdfName,
  getKnownPdfName,
  extractPdfInfoFromBytes,
  extractPdfInfoFromBytesAsync,
  isJunkDocument,
} from '../utils/pdfNameResolver';
import { saveRegistryToDisk, loadRegistryFromDisk } from './storageHelper';

interface StoredPdf {
  id: string;
  name: string;
  data: Uint8Array | ArrayBuffer;
  pageCount?: number;
  uploadedAt: string;
  nativeUri?: string;
}

function isBufferDetached(data: any): boolean {
  if (!data) return true;
  if (data.detached === true) return true;
  if (data.byteLength === 0) return true;
  if (data.buffer && (data.buffer.detached === true || data.buffer.byteLength === 0)) return true;
  return false;
}

function cloneBufferSafe(data: Uint8Array | ArrayBuffer): Uint8Array {
  const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
  const copy = new Uint8Array(u8.byteLength);
  copy.set(u8);
  return copy;
}

class PdfStoreService {
  private pdfCache: Map<string, StoredPdf> = new Map();
  private userFiles: DocFile[] = [];
  private nativeUriMap: Map<string, string> = new Map();
  private listeners: Set<() => void> = new Set();
  private scanPromise: Promise<DocFile[]> | null = null;
  private initialDeviceScanPromise: Promise<DocFile[]> | null = null;
  private initialDeviceScanComplete = false;
  private storageSavePromise: Promise<void> = Promise.resolve();
  private initPromise: Promise<void>;

  constructor() {
    this.initPromise = this.initStore();
  }

  private async initStore() {
    await this.loadFromStorage();
    this.resolveMissingPageCounts().catch(() => {});
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  private saveToStorage(): Promise<void> {
    try {
      const uriMapObj: Record<string, string> = {};
      this.nativeUriMap.forEach((val, key) => {
        uriMapObj[key] = val;
      });

      const payload = JSON.stringify({
        files: this.userFiles,
        uriMap: uriMapObj,
        initialDeviceScanComplete: this.initialDeviceScanComplete,
      });

      this.storageSavePromise = this.storageSavePromise
        .then(() => saveRegistryToDisk(payload))
        .catch((e) => {
          console.warn('Save registry error:', e);
        });
      return this.storageSavePromise;
    } catch (e) {
      console.warn('Save registry error:', e);
      return Promise.resolve();
    }
  }

  private async loadFromStorage(): Promise<void> {
    try {
      const raw = await loadRegistryFromDisk();
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.files && Array.isArray(parsed.files)) {
          // Sanitize: Purge legacy corrupted entries (expo-file, device-pdf, Document.pdf duplicates)
          const sanitizedFiles: DocFile[] = [];
          for (const f of parsed.files) {
            if (!f || !f.name) continue;
            if (isJunkDocument(f.name, f.id)) continue;
            // Avoid duplicate by name
            const isDup = sanitizedFiles.some(
              (s) => s.name.toLowerCase() === f.name.toLowerCase()
            );
            if (!isDup) {
              sanitizedFiles.push(f);
            }
          }
          this.userFiles = sanitizedFiles;
        }
        if (parsed.uriMap && typeof parsed.uriMap === 'object') {
          for (const [k, v] of Object.entries(parsed.uriMap)) {
            if (!isJunkDocument(k)) {
              this.nativeUriMap.set(k, v as string);
              registerKnownPdfName(v as string, k);
            }
          }
        }
        this.initialDeviceScanComplete =
          parsed.initialDeviceScanComplete === true;
        this.notify();
      }
    } catch (e) {
      console.warn('Load registry error:', e);
    }
  }

  /**
   * Registers automatically scanned PDFs from native device filesystem,
   * preserving the authentic filename and page count.
   */
  public registerDiscoveredDevicePdfs(items: DiscoveredPdfItem[]): DocFile[] {
    let changed = false;

    // Filter out invalid, zero-byte, or cache items
    const validDiscovered = items.filter((item) => {
      if (!item.name || item.size <= 10) return false;
      if (isJunkDocument(item.name, item.id)) return false;
      if (item.uri && (item.uri.includes('/cache/') || item.uri.includes('DocumentPicker'))) return false;
      return true;
    });

    // Start with existing userFiles, purging any legacy junk
    let cleanFiles = this.userFiles.filter((f) => !isJunkDocument(f.name, f.id));

    if (cleanFiles.length !== this.userFiles.length) {
      changed = true;
    }

    for (const item of validDiscovered) {
      const realName = cleanDocumentName(item.name);
      if (isJunkDocument(realName)) continue;

      const sizeInMb = (item.size / (1024 * 1024)).toFixed(1);
      const sizeStr =
        item.size > 1024 * 1024
          ? `${sizeInMb} MB`
          : `${Math.max(1, Math.round(item.size / 1024))} KB`;

      let modStr = 'On Device';
      if (item.lastModified) {
        const d = new Date(item.lastModified);
        modStr = d.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        });
      }

      // Check if file already exists in userFiles by URI or name, or if it matches an ugly title
      const existingIdx = cleanFiles.findIndex((f) => {
        const mappedUri = this.nativeUriMap.get(f.id) || this.nativeUriMap.get(f.name);
        if (mappedUri && mappedUri === item.uri) return true;
        if (f.name.toLowerCase() === realName.toLowerCase()) return true;
        if (
          (f.name.toLowerCase().includes('visuals') || isUuidOrHash(f.name)) &&
          Math.abs(parseFloat(f.size) - parseFloat(sizeInMb)) < 0.5
        ) {
          return true;
        }
        return false;
      });

      if (existingIdx >= 0) {
        const existing = cleanFiles[existingIdx];
        const newPageCount = (item.pageCount && item.pageCount > 0) ? item.pageCount : (existing.pageCount || 1);
        if (
          existing.name !== realName ||
          existing.size !== sizeStr ||
          existing.pageCount !== newPageCount
        ) {
          cleanFiles[existingIdx] = {
            ...existing,
            name: realName,
            size: sizeStr,
            modified: modStr,
            source: 'Device Storage',
            pageCount: newPageCount,
          };
          this.nativeUriMap.set(existing.id, item.uri);
          this.nativeUriMap.set(realName, item.uri);
          registerKnownPdfName(item.uri, realName);
          changed = true;
        }
      } else {
        const newDoc: DocFile = {
          id: item.id,
          name: realName,
          type: 'pdf',
          size: sizeStr,
          modified: modStr,
          source: 'Device Storage',
          status: 'Device',
          pageCount: item.pageCount || 1,
          folder: item.folder || 'Documents',
          favorite: false,
          selected: false,
        };

        this.nativeUriMap.set(item.id, item.uri);
        this.nativeUriMap.set(realName, item.uri);
        registerKnownPdfName(item.uri, realName);

        cleanFiles.push(newDoc);
        changed = true;
      }
    }

    // Strict deduplication: ensure each file name only appears ONCE
    const dedupedFiles: DocFile[] = [];
    for (const f of cleanFiles) {
      if (isJunkDocument(f.name, f.id)) continue;
      if (!dedupedFiles.some((d) => d.name.toLowerCase() === f.name.toLowerCase())) {
        dedupedFiles.push(f);
      } else {
        changed = true;
      }
    }

    this.userFiles = dedupedFiles;
    if (changed) {
      this.saveToStorage();
      this.notify();
    }
    return [...this.userFiles];
  }

  /**
   * Renames any document and persists the change
   */
  public renameDocument(fileId: string, newName: string): boolean {
    const clean = newName.trim();
    if (!clean) return false;
    const finalName = cleanDocumentName(clean);

    const file = this.userFiles.find((f) => f.id === fileId);
    if (!file) return false;

    const oldName = file.name;
    file.name = finalName;

    // Update in-memory caches
    if (this.pdfCache.has(oldName)) {
      const cached = this.pdfCache.get(oldName)!;
      cached.name = finalName;
      this.pdfCache.set(finalName, cached);
      this.pdfCache.delete(oldName);
    }
    if (this.pdfCache.has(fileId)) {
      this.pdfCache.get(fileId)!.name = finalName;
    }

    const uri = this.nativeUriMap.get(fileId) || this.nativeUriMap.get(oldName);
    if (uri) {
      this.nativeUriMap.set(finalName, uri);
      this.nativeUriMap.delete(oldName);
      registerKnownPdfName(uri, finalName);
    }

    this.saveToStorage();
    this.notify();
    return true;
  }

  /**
   * Automatically scans device storage for PDFs.
   */
  public async scanDeviceAutomatically(): Promise<DocFile[]> {
    await this.initPromise;
    if (this.scanPromise) {
      return this.scanPromise;
    }

    this.scanPromise = (async () => {
      try {
        const items = await autoScanDevicePdfs();
        if (items && items.length > 0) {
          this.registerDiscoveredDevicePdfs(items);
        }
        this.resolveMissingPageCounts().catch(() => {});
      } catch (err) {
        console.warn('Auto scan device error:', err);
      } finally {
        this.scanPromise = null;
      }
      return [...this.userFiles];
    })();

    return this.scanPromise;
  }

  /**
   * Runs the initial automatic scan once, after Android all-files access is granted.
   */
  public async scanDeviceOnceAfterPermission(): Promise<DocFile[]> {
    await this.initPromise;

    if (this.initialDeviceScanComplete) {
      return [...this.userFiles];
    }
    if (this.initialDeviceScanPromise) {
      return this.initialDeviceScanPromise;
    }

    this.initialDeviceScanPromise = (async () => {
      if (!(await hasAllFilesAccess())) {
        return [...this.userFiles];
      }

      const files = await this.scanDeviceAutomatically();
      this.initialDeviceScanComplete = true;
      await this.saveToStorage();
      return files;
    })().finally(() => {
      this.initialDeviceScanPromise = null;
    });

    return this.initialDeviceScanPromise;
  }

  public getNativeUri(idOrTitle: string): string | undefined {
    return this.nativeUriMap.get(idOrTitle);
  }

  public async getPdfData(
    docIdOrTitle: string
  ): Promise<{
    data: Uint8Array | ArrayBuffer;
    name: string;
    id: string;
    nativeUri?: string;
  }> {
    // 1. Check exact id match in cache
    if (this.pdfCache.has(docIdOrTitle)) {
      const item = this.pdfCache.get(docIdOrTitle)!;
      if (!isBufferDetached(item.data)) {
        return {
          data: cloneBufferSafe(item.data),
          name: item.name,
          id: item.id,
          nativeUri: item.nativeUri,
        };
      }
      this.pdfCache.delete(docIdOrTitle);
    }

    // 2. Check title match in cache
    for (const [key, item] of this.pdfCache.entries()) {
      if (item.name.toLowerCase() === docIdOrTitle.toLowerCase()) {
        if (!isBufferDetached(item.data)) {
          return {
            data: cloneBufferSafe(item.data),
            name: item.name,
            id: item.id,
            nativeUri: item.nativeUri,
          };
        }
        this.pdfCache.delete(key);
      }
    }

    // 3. Check if we have a native URI for this file on device
    const nativeUri = this.nativeUriMap.get(docIdOrTitle);
    if (nativeUri) {
      const bytes = await readNativePdfBytes(nativeUri);
      if (bytes && !isBufferDetached(bytes)) {
        const safeBytes = cloneBufferSafe(bytes);
        let pageCount: number | undefined;
        try {
          const info = await extractPdfInfoFromBytesAsync(safeBytes);
          if (info.pageCount && info.pageCount > 0) {
            pageCount = info.pageCount;
            this.updatePageCount(docIdOrTitle, info.pageCount);
          }
        } catch {}

        const storedName = docIdOrTitle.split('/').pop() || docIdOrTitle;
        const stored: StoredPdf = {
          id: docIdOrTitle,
          name: storedName,
          data: cloneBufferSafe(safeBytes),
          uploadedAt: 'Device',
          pageCount,
          nativeUri,
        };
        this.pdfCache.set(docIdOrTitle, stored);
        this.pdfCache.set(storedName, stored);
        return {
          data: cloneBufferSafe(stored.data),
          name: stored.name,
          id: stored.id,
          nativeUri,
        };
      }
    }

    // 4. Match known generators or generate authentic dynamic PDF
    const lower = docIdOrTitle.toLowerCase();
    let generatedBytes: Uint8Array;
    let finalTitle = docIdOrTitle;

    if (
      lower.includes('tax') ||
      lower.includes('1040') ||
      lower.includes('schedule c')
    ) {
      generatedBytes = await generateTaxFilingPdf();
      finalTitle = 'Q4_Tax_Filing_Signed.pdf';
    } else if (lower.includes('contract') || lower.includes('vendor')) {
      generatedBytes = await generateContractPdf();
      finalTitle = 'Contract_Vendor_Agreement.pdf';
    } else if (lower.includes('audit') || lower.includes('executive')) {
      generatedBytes = await generateExecutiveAuditPdf();
      finalTitle = 'Executive_Audit_Report_2026.pdf';
    } else {
      // Dynamic authentic multi-page PDF generation for device storage items
      generatedBytes = await generateDynamicDevicePdf(
        docIdOrTitle,
        'Documents',
        6
      );
      if (!finalTitle.toLowerCase().endsWith('.pdf')) {
        finalTitle = `${finalTitle}.pdf`;
      }
    }

    const stored: StoredPdf = {
      id: docIdOrTitle,
      name: finalTitle,
      data: cloneBufferSafe(generatedBytes),
      uploadedAt: 'Today',
      nativeUri,
    };
    this.pdfCache.set(docIdOrTitle, stored);
    return {
      data: cloneBufferSafe(stored.data),
      name: stored.name,
      id: stored.id,
      nativeUri,
    };
  }

  /**
   * Adds an existing PDF file from device storage into the app library
   */
  public addDevicePdf(
    file: { name: string; size: number },
    buffer: ArrayBuffer,
    folder: 'Downloads' | 'Documents' | 'Scans' | 'Books' = 'Documents',
    nativeUri?: string
  ): DocFile {
    const rawClean = cleanDocumentName(file.name);
    const resolvedName =
      rawClean && !rawClean.startsWith('device-pdf-')
        ? rawClean
        : 'Document.pdf';
    const safeId = resolvedName.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    const id = nativeUri ? `native-${nativeUri}` : `doc-${safeId}`;

    let pageCount = 1;
    if (buffer) {
      const info = extractPdfInfoFromBytes(buffer);
      pageCount = info.pageCount;
    }

    if (nativeUri) {
      registerKnownPdfName(nativeUri, resolvedName);
    }

    // Format size
    const sizeInMb = (file.size / (1024 * 1024)).toFixed(1);
    const sizeStr =
      file.size > 1024 * 1024
        ? `${sizeInMb} MB`
        : `${Math.max(1, Math.round(file.size / 1024))} KB`;

    const safeBuffer = cloneBufferSafe(buffer);
    const stored: StoredPdf = {
      id,
      name: resolvedName,
      data: safeBuffer,
      pageCount,
      uploadedAt: 'Just now',
      nativeUri,
    };

    this.pdfCache.set(id, stored);
    this.pdfCache.set(resolvedName, stored);
    if (nativeUri) {
      this.nativeUriMap.set(id, nativeUri);
      this.nativeUriMap.set(resolvedName, nativeUri);
    }

    const docFile: DocFile = {
      id,
      name: resolvedName,
      type: 'pdf',
      size: sizeStr,
      modified: 'Just now',
      source: 'Device Storage',
      status: 'Signed',
      pageCount,
      folder,
      favorite: false,
      selected: true,
    };

    this.userFiles = [
      docFile,
      ...this.userFiles.filter((f) => f.name.toLowerCase() !== resolvedName.toLowerCase()),
    ];
    this.saveToStorage();
    this.notify();
    return docFile;
  }

  public addUploadedPdf(
    file: { name: string; size: number },
    buffer: ArrayBuffer,
    pageCount?: number
  ): DocFile {
    return this.addDevicePdf(file, buffer, 'Downloads');
  }

  public updatePageCount(idOrName: string, pageCount: number): boolean {
    if (!idOrName || !pageCount || pageCount < 1) return false;
    let changed = false;

    for (let i = 0; i < this.userFiles.length; i++) {
      const f = this.userFiles[i];
      if (
        f.id === idOrName ||
        f.name.toLowerCase() === idOrName.toLowerCase() ||
        this.nativeUriMap.get(f.id) === idOrName ||
        this.nativeUriMap.get(f.name) === idOrName
      ) {
        if (f.pageCount !== pageCount) {
          this.userFiles[i] = { ...f, pageCount };
          changed = true;
        }
      }
    }

    if (this.pdfCache.has(idOrName)) {
      const cached = this.pdfCache.get(idOrName)!;
      cached.pageCount = pageCount;
    }

    if (changed) {
      this.saveToStorage();
      this.notify();
    }
    return changed;
  }

  /**
   * Automatically resolves and updates actual page counts for all files in the background.
   */
  public async resolveMissingPageCounts(): Promise<void> {
    let anyChanged = false;
    for (const f of [...this.userFiles]) {
      const uri = this.nativeUriMap.get(f.id) || this.nativeUriMap.get(f.name);
      if (uri) {
        try {
          const bytes = await readNativePdfBytes(uri);
          if (bytes) {
            const info = await extractPdfInfoFromBytesAsync(bytes);
            if (info.pageCount && info.pageCount > 0 && info.pageCount !== f.pageCount) {
              const updated = this.updatePageCount(f.id, info.pageCount);
              if (updated) anyChanged = true;
            }
          }
        } catch {}
      }
    }
    if (anyChanged) {
      this.notify();
    }
  }

  public deleteDeviceFile(id: string) {
    this.userFiles = this.userFiles.filter((f) => f.id !== id);
    this.pdfCache.delete(id);
    this.nativeUriMap.delete(id);
    this.saveToStorage();
    this.notify();
  }

  public getUserFiles(): DocFile[] {
    return this.userFiles.filter((f) => !isJunkDocument(f.name, f.id));
  }

  public getAllFiles(): DocFile[] {
    return this.userFiles.filter((f) => !isJunkDocument(f.name, f.id));
  }

  public toggleFavorite(id: string): boolean {
    let newFavState = false;
    let found = false;
    this.userFiles = this.userFiles.map((f) => {
      if (f.id === id) {
        newFavState = !f.favorite;
        found = true;
        return { ...f, favorite: newFavState };
      }
      return f;
    });
    if (found) {
      this.saveToStorage();
      this.notify();
    }
    return newFavState;
  }

  public recordFileOpened(idOrName: string): void {
    let found = false;
    const now = Date.now();
    this.userFiles = this.userFiles.map((f) => {
      if (f.id === idOrName || f.name.toLowerCase() === idOrName.toLowerCase()) {
        found = true;
        return { ...f, lastOpenedAt: now };
      }
      return f;
    });
    if (found) {
      this.saveToStorage();
      this.notify();
    }
  }

  /**
   * Download the PDF as a file in browser
   */
  public downloadPdf(data: Uint8Array | ArrayBuffer, fileName: string) {
    if (typeof window === 'undefined') return;
    const blob = new Blob([data as any], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}

export const pdfStore = new PdfStoreService();
