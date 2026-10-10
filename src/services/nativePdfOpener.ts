/**
 * Web Implementation of Native PDF Opener
 */
export async function isNativeSystemViewerAvailable(): Promise<boolean> {
  return false;
}

export function getCachedLocalUri(fileName: string, byteLength?: number): string | null {
  return null;
}

export async function getPdfLocalUri(pdfBytes: Uint8Array | ArrayBuffer, fileName: string): Promise<string> {
  const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
}

export async function openInNativeSystemViewer(
  pdfBytesOrUri: Uint8Array | ArrayBuffer | string,
  fileName: string
): Promise<boolean> {
  if (typeof window !== 'undefined') {
    if (typeof pdfBytesOrUri === 'string') {
      window.open(pdfBytesOrUri, '_blank');
      return true;
    }
    const blob = new Blob([pdfBytesOrUri as any], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    return true;
  }
  return false;
}
