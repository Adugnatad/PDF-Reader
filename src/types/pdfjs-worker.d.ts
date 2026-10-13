declare module 'pdfjs-dist/build/pdf.worker.min.mjs' {
  const content: any;
  export default content;
  export const WorkerMessageHandler: any;
}

declare module 'pdfjs-dist/build/pdf.worker.min.mjs?worker' {
  const worker: { new (): Worker };
  export default worker;
}

declare module 'pdfjs-dist/build/pdf.worker.min.mjs?url' {
  const url: string;
  export default url;
}
