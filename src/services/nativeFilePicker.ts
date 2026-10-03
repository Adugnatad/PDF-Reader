export interface PickedFileResult {
  name: string;
  size: number;
  buffer: ArrayBuffer;
  uri?: string;
  pageCount?: number;
}

export interface DiscoveredPdfItem {
  id: string;
  name: string;
  size: number;
  uri: string;
  lastModified?: number;
  folder: 'Downloads' | 'Documents' | 'Scans' | 'Books';
  pageCount?: number;
}

/**
 * Reads binary ArrayBuffer from a web URI / blob
 */
export async function readNativePdfBytes(fileUriOrPath: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(fileUriOrPath);
    if (res.ok) {
      return await res.arrayBuffer();
    }
  } catch (e) {
    console.warn('readNativePdfBytes web note:', e);
  }
  return null;
}

/**
 * Web Implementation of Automatic Device PDF Scanner:
 * Restores any previously registered device files from localStorage.
 */
export async function autoScanDevicePdfs(): Promise<DiscoveredPdfItem[]> {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = localStorage.getItem('docuflow_cached_device_pdfs');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore
    }
  }
  return [];
}

export async function promptAndScanDeviceStorage(): Promise<DiscoveredPdfItem[]> {
  return await autoScanDevicePdfs();
}

/**
 * Web Implementation of File Picking
 * Uses window.showOpenFilePicker when available, falling back to a hidden file input.
 */
export async function pickPdfFromDevice(): Promise<PickedFileResult | null> {
  if (typeof window !== 'undefined' && 'showOpenFilePicker' in window) {
    try {
      const [handle] = await (window as any).showOpenFilePicker({
        multiple: false,
        types: [
          {
            description: 'PDF Documents',
            accept: { 'application/pdf': ['.pdf'] },
          },
        ],
      });
      if (!handle) return null;
      const file = await handle.getFile();
      const buffer = await file.arrayBuffer();
      return {
        name: file.name,
        size: file.size,
        buffer,
      };
    } catch (err: any) {
      if (err?.name === 'AbortError') return null;
      // Fallback to DOM input
    }
  }

  // Standard DOM input fallback for all browsers
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(null);
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf,.pdf';
    input.style.display = 'none';

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      try {
        const buffer = await file.arrayBuffer();
        resolve({
          name: file.name,
          size: file.size,
          buffer,
        });
      } catch {
        resolve(null);
      } finally {
        if (input.parentNode) {
          input.parentNode.removeChild(input);
        }
      }
    };

    document.body.appendChild(input);
    input.click();
  });
}

/**
 * Scan device / multiple file selection on Web
 */
export async function scanDeviceStorage(): Promise<PickedFileResult[]> {
  if (typeof window !== 'undefined' && 'showOpenFilePicker' in window) {
    try {
      const handles = await (window as any).showOpenFilePicker({
        multiple: true,
        types: [
          {
            description: 'PDF Documents',
            accept: { 'application/pdf': ['.pdf'] },
          },
        ],
      });
      const results: PickedFileResult[] = [];
      for (const handle of handles) {
        const file = await handle.getFile();
        const buffer = await file.arrayBuffer();
        results.push({
          name: file.name,
          size: file.size,
          buffer,
        });
      }
      return results;
    } catch (err: any) {
      if (err?.name === 'AbortError') return [];
    }
  }
  return [];
}
