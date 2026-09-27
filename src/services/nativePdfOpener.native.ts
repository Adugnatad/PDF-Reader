import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(buffer as any).toString('base64');
  }
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
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
 * and returns the native file:// URI.
 */
export async function getPdfLocalUri(pdfBytes: Uint8Array | ArrayBuffer, fileName: string): Promise<string> {
  const safeName = (fileName || 'document.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
  const targetName = safeName.endsWith('.pdf') ? safeName : `${safeName}.pdf`;
  const fileUri = `${FileSystem.cacheDirectory}pdf_${Date.now()}_${targetName}`;

  const base64 = arrayBufferToBase64(pdfBytes);
  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return fileUri;
}

/**
 * Directly opens the PDF in the native mobile device's system PDF viewer
 * (Apple QuickLook on iOS, Google Drive / System PDF Viewer on Android)
 * with zero text extraction required!
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
