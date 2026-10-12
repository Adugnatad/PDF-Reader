import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { Share as RNShare } from 'react-native';
import { fastUint8ToBase64 } from '../utils/fastBase64';

// Cache written URIs so we don't rewrite the same PDF repeatedly
const uriCache = new Map<string, string>();

export function getCachedLocalUri(fileName: string, byteLength?: number): string | null {
  if (byteLength) {
    const key = `${fileName}_${byteLength}`;
    if (uriCache.has(key)) return uriCache.get(key)!;
  }
  for (const [k, uri] of uriCache.entries()) {
    if (k.startsWith(fileName)) return uri;
  }
  return null;
}

/**
 * Checks if native device sharing/quicklook is available
 */
export async function isNativeSystemViewerAvailable(): Promise<boolean> {
  try {
    return await Sharing.isAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * Saves the PDF bytes to a local file in the app cache directory
 * and returns the native file:// URI with near-instant caching.
 */
export async function getPdfLocalUri(pdfBytes: Uint8Array | ArrayBuffer, fileName: string): Promise<string> {
  const bytes = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const cacheKey = `${fileName}_${bytes.byteLength}`;

  if (uriCache.has(cacheKey)) {
    return uriCache.get(cacheKey)!;
  }

  const safeName = (fileName || 'document.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
  const targetName = safeName.endsWith('.pdf') ? safeName : `${safeName}.pdf`;
  const viewerCacheDir = `${FileSystem.cacheDirectory}viewer_cache/`;

  try {
    const dirInfo = await FileSystem.getInfoAsync(viewerCacheDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(viewerCacheDir, { intermediates: true });
    }
  } catch {}

  const fileUri = `${viewerCacheDir}${targetName}`;

  const base64 = fastUint8ToBase64(bytes);
  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  uriCache.set(cacheKey, fileUri);
  return fileUri;
}

/**
 * Directly opens the PDF in the native mobile device's system PDF viewer
 * (Apple QuickLook on iOS, Google Drive / System PDF Viewer on Android)
 * with zero text extraction and zero wait! Accepts either in-memory bytes or direct disk file URI.
 */
export async function openInNativeSystemViewer(
  pdfBytesOrUri: Uint8Array | ArrayBuffer | string,
  fileName: string
): Promise<boolean> {
  try {
    let fileUri: string;
    if (typeof pdfBytesOrUri === 'string') {
      fileUri = pdfBytesOrUri;
    } else {
      if (pdfBytesOrUri.byteLength === 0) {
        const cached = getCachedLocalUri(fileName);
        if (cached) {
          fileUri = cached;
        } else {
          return false;
        }
      } else {
        fileUri = await getPdfLocalUri(pdfBytesOrUri, fileName);
      }
    }

    const available = await Sharing.isAvailableAsync();
    if (available) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
        dialogTitle: `Open ${fileName}`,
      });
      return true;
    }
    return false;
  } catch (err) {
    console.error('Failed to open PDF in native system viewer:', err);
    return false;
  }
}

/**
 * Shares the PDF using native mobile share sheet (expo-sharing or RN Share fallback)
 */
export async function shareNativePdf(
  pdfBytesOrUri: Uint8Array | ArrayBuffer | string,
  fileName: string
): Promise<boolean> {
  try {
    let fileUri: string;
    if (typeof pdfBytesOrUri === 'string' && pdfBytesOrUri.length > 0) {
      fileUri = pdfBytesOrUri;
    } else {
      const bytes =
        pdfBytesOrUri instanceof Uint8Array || pdfBytesOrUri instanceof ArrayBuffer
          ? pdfBytesOrUri
          : new Uint8Array();
      if (bytes.byteLength === 0) {
        const cached = getCachedLocalUri(fileName);
        if (cached) {
          fileUri = cached;
        } else {
          return false;
        }
      } else {
        fileUri = await getPdfLocalUri(bytes, fileName);
      }
    }

    const available = await Sharing.isAvailableAsync().catch(() => false);
    if (available) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
        dialogTitle: `Share ${fileName}`,
      });
      return true;
    }

    // Fallback using React Native Share module
    await RNShare.share({
      title: fileName,
      message: `Sharing ${fileName}`,
      url: fileUri,
    });
    return true;
  } catch (err: any) {
    if (
      err?.message?.includes('cancelled') ||
      err?.message?.includes('dismissed') ||
      err?.name === 'AbortError'
    ) {
      return true;
    }
    console.error('Failed to share PDF natively:', err);
    return false;
  }
}

/**
 * Prints the PDF using native system print manager (AirPrint on iOS, Android Print Manager on Android)
 */
export async function printNativePdf(
  pdfBytesOrUri: Uint8Array | ArrayBuffer | string,
  fileName: string,
  isHorizontal: boolean = false
): Promise<boolean> {
  try {
    let fileUri: string | undefined;
    if (typeof pdfBytesOrUri === 'string' && pdfBytesOrUri.length > 0) {
      fileUri = pdfBytesOrUri;
    } else {
      const bytes =
        pdfBytesOrUri instanceof Uint8Array || pdfBytesOrUri instanceof ArrayBuffer
          ? pdfBytesOrUri
          : new Uint8Array();
      if (bytes.byteLength > 0) {
        fileUri = await getPdfLocalUri(bytes, fileName);
      } else {
        const cached = getCachedLocalUri(fileName);
        if (cached) {
          fileUri = cached;
        }
      }
    }

    const orientation = isHorizontal
      ? Print.Orientation.landscape
      : Print.Orientation.portrait;

    if (fileUri) {
      await Print.printAsync({
        uri: fileUri,
        orientation,
      });
      return true;
    } else if (typeof pdfBytesOrUri !== 'string') {
      const bytes =
        pdfBytesOrUri instanceof Uint8Array ? pdfBytesOrUri : new Uint8Array(pdfBytesOrUri);
      if (bytes.byteLength > 0) {
        const base64 = fastUint8ToBase64(bytes);
        await Print.printAsync({
          uri: `data:application/pdf;base64,${base64}`,
          orientation,
        });
        return true;
      }
    }

    return false;
  } catch (err: any) {
    if (
      err?.message?.includes('cancelled') ||
      err?.message?.includes('dismissed')
    ) {
      return true;
    }
    console.error('Failed to print PDF natively:', err);
    return false;
  }
}

