import '../utils/pdfPolyfills';
import * as pdfjsLib from 'pdfjs-dist';
import * as pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs';

if (typeof window !== 'undefined') {
  try {
    // Hook the worker message handler directly onto globalThis.
    // This allows PDF.js to use the pre-bundled worker in the main thread
    // with 0ms latency and eliminates any dynamic network import of pdf.worker.min.mjs.
    (globalThis as any).pdfjsWorker = pdfjsWorker;

    if (pdfjsLib.GlobalWorkerOptions) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'in-memory-worker';
    }
  } catch (err) {
    console.warn('pdfjsWorker setup note:', err);
  }
}

export { pdfjsLib };
