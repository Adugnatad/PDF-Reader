export interface PickedFileResult {
  name: string;
  size: number;
  buffer: ArrayBuffer;
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
