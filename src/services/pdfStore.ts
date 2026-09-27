import { DocFile } from '../types';
import {
  generateTaxFilingPdf,
  generateContractPdf,
  generateExecutiveAuditPdf,
  generateDynamicDevicePdf,
} from './samplePdfGenerator';

interface StoredPdf {
  id: string;
  name: string;
  data: Uint8Array | ArrayBuffer;
  pageCount?: number;
  uploadedAt: string;
}

class PdfStoreService {
  private pdfCache: Map<string, StoredPdf> = new Map();
  private userFiles: DocFile[] = [];
  private listeners: Set<() => void> = new Set();

  constructor() {
    // Initial device documents can be loaded/indexed
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  public async getPdfData(docIdOrTitle: string): Promise<{ data: Uint8Array | ArrayBuffer; name: string; id: string }> {
    // 1. Check exact id match
    if (this.pdfCache.has(docIdOrTitle)) {
      const item = this.pdfCache.get(docIdOrTitle)!;
      return { data: item.data, name: item.name, id: item.id };
    }

    // 2. Check title match in cache
    for (const [_, item] of this.pdfCache.entries()) {
      if (item.name.toLowerCase() === docIdOrTitle.toLowerCase()) {
        return { data: item.data, name: item.name, id: item.id };
      }
    }

    // 3. Match known generators or generate authentic dynamic PDF
    const lower = docIdOrTitle.toLowerCase();
    let generatedBytes: Uint8Array;
    let finalTitle = docIdOrTitle;

    if (lower.includes('tax') || lower.includes('1040') || lower.includes('schedule c')) {
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
      generatedBytes = await generateDynamicDevicePdf(docIdOrTitle, 'Documents', 6);
      if (!finalTitle.toLowerCase().endsWith('.pdf')) {
        finalTitle = `${finalTitle}.pdf`;
      }
    }

    const stored: StoredPdf = {
      id: docIdOrTitle,
      name: finalTitle,
      data: generatedBytes,
      uploadedAt: 'Today',
    };
    this.pdfCache.set(docIdOrTitle, stored);
    return { data: stored.data, name: stored.name, id: stored.id };
  }

  /**
   * Adds an existing PDF file from the device storage into the app library
   */
  public addDevicePdf(
    file: { name: string; size: number },
    buffer: ArrayBuffer,
    folder: 'Downloads' | 'Documents' | 'Scans' | 'Books' = 'Documents'
  ): DocFile {
    const id = `device-pdf-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    
    // Format size
    const sizeInMb = (file.size / (1024 * 1024)).toFixed(1);
    const sizeStr = file.size > 1024 * 1024 ? `${sizeInMb} MB` : `${Math.round(file.size / 1024)} KB`;

    const stored: StoredPdf = {
      id,
      name: file.name,
      data: buffer,
      pageCount: 1,
      uploadedAt: 'Just now',
    };

    this.pdfCache.set(id, stored);
    this.pdfCache.set(file.name, stored);

    const docFile: DocFile = {
      id,
      name: file.name,
      type: 'pdf',
      size: sizeStr,
      modified: 'Just now',
      source: 'Local Storage',
      status: 'Signed',
      pageCount: 1,
      folder,
      favorite: false,
      selected: true,
    };

    this.userFiles.unshift(docFile);
    this.notify();
    return docFile;
  }

  public addUploadedPdf(file: File, buffer: ArrayBuffer, pageCount?: number): DocFile {
    return this.addDevicePdf(file, buffer, 'Downloads');
  }

  public deleteDeviceFile(id: string) {
    this.userFiles = this.userFiles.filter((f) => f.id !== id);
    this.pdfCache.delete(id);
    this.notify();
  }

  public getUserFiles(): DocFile[] {
    return this.userFiles;
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
