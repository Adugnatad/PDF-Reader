import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { fastUint8ToBase64 } from '../utils/fastBase64';

// Cache written URIs so we don't rewrite the same PDF repeatedly
const uriCache = new Map<string, string>();

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
 * with zero text extraction and zero wait!
 */
export async function openInNativeSystemViewer(pdfBytes: Uint8Array | ArrayBuffer, fileName: string): Promise<boolean> {
  try {
    const fileUri = await getPdfLocalUri(pdfBytes, fileName);
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
