import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

export interface PickedFileResult {
  name: string;
  size: number;
  buffer: ArrayBuffer;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  // If global.Buffer is available
  if (typeof Buffer !== 'undefined') {
    const buf = Buffer.from(base64, 'base64');
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  }
  // Fallback for Hermes / JSC
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Loads a PDF directly from native iOS / Android device storage
 * using expo-document-picker (Files app, Google Drive, Downloads, SD card).
 */
export async function pickPdfFromDevice(): Promise<PickedFileResult | null> {
  try {
    const res = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'application/*'],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (res.canceled || !res.assets || res.assets.length === 0) {
      return null;
    }

    const asset = res.assets[0];
    const name = asset.name || 'document.pdf';
    let buffer: ArrayBuffer | null = null;

    // 1. Try reading via fetch (standard React Native supports file:// & content:// fetch)
    try {
      const response = await fetch(asset.uri);
      buffer = await response.arrayBuffer();
    } catch {
      // 2. Fallback to FileSystem.readAsStringAsync base64
      try {
        const base64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: 'base64' as any,
        });
        buffer = base64ToArrayBuffer(base64);
      } catch (err) {
        console.error('Error reading native file URI:', err);
      }
    }

    if (!buffer) {
      throw new Error('Unable to read selected PDF file data from native device');
    }

    return {
      name,
      size: asset.size || buffer.byteLength,
      buffer,
    };
  } catch (err) {
    console.error('Native document picker error:', err);
    throw err;
  }
}

/**
 * Scans or selects multiple documents from native device storage
 */
export async function scanDeviceStorage(): Promise<PickedFileResult[]> {
  try {
    const res = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'application/*'],
      copyToCacheDirectory: true,
      multiple: true,
    });

    if (res.canceled || !res.assets || res.assets.length === 0) {
      return [];
    }

    const results: PickedFileResult[] = [];
    for (const asset of res.assets) {
      try {
        let buffer: ArrayBuffer | null = null;
        try {
          const response = await fetch(asset.uri);
          buffer = await response.arrayBuffer();
        } catch {
          const base64 = await FileSystem.readAsStringAsync(asset.uri, {
            encoding: 'base64' as any,
          });
          buffer = base64ToArrayBuffer(base64);
        }

        if (buffer) {
          results.push({
            name: asset.name || 'document.pdf',
            size: asset.size || buffer.byteLength,
            buffer,
          });
        }
      } catch (err) {
        console.warn('Failed reading scanned asset:', err);
      }
    }
    return results;
  } catch (err) {
    console.warn('Native scan error:', err);
    return [];
  }
}
