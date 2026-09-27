/**
 * Web Implementation of Native PDF Opener
 */
export async function isNativeSystemViewerAvailable(): Promise<boolean> {
  return false;
}

export async function getPdfLocalUri(pdfBytes: Uint8Array | ArrayBuffer, fileName: string): Promise<string> {
  const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
}

export async function openInNativeSystemViewer(pdfBytes: Uint8Array | ArrayBuffer, fileName: string): Promise<boolean> {
  if (typeof window !== 'undefined') {
    const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    return true;
  }
  return false;
}
