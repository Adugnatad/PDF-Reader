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

export async function shareNativePdf(
  pdfBytesOrUri: Uint8Array | ArrayBuffer | string,
  fileName: string
): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title: fileName,
        text: `Viewing ${fileName}`,
        url: window.location.href,
      });
      return true;
    } catch (e: any) {
      if (e?.name === 'AbortError') return true;
    }
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(window.location.href);
      return true;
    } catch {}
  }
  return false;
}

export async function printNativePdf(
  pdfBytesOrUri: Uint8Array | ArrayBuffer | string,
  fileName: string,
  isHorizontal: boolean = false
): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  try {
    let blobUrl: string | undefined;
    if (typeof pdfBytesOrUri === 'string' && pdfBytesOrUri.startsWith('blob:')) {
      blobUrl = pdfBytesOrUri;
    } else if (typeof pdfBytesOrUri !== 'string') {
      const bytes =
        pdfBytesOrUri instanceof Uint8Array ? pdfBytesOrUri : new Uint8Array(pdfBytesOrUri);
      if (bytes.byteLength > 0) {
        const blob = new Blob([bytes as any], { type: 'application/pdf' });
        blobUrl = URL.createObjectURL(blob);
      }
    }

    if (blobUrl) {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.src = blobUrl;
      document.body.appendChild(iframe);
      iframe.onload = () => {
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch {
            window.print();
          }
        }, 300);
      };
      return true;
    }

    window.print();
    return true;
  } catch {
    window.print();
    return true;
  }
}

