import React from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { PdfReaderScreen } from '../src/components/PdfReaderScreen';
import { useToast } from '../src/context/ToastContext';
import { pdfStore } from '../src/services/pdfStore';

export default function PdfScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    title?: string;
    docId?: string;
    file?: string;
    name?: string;
    doc?: string;
  }>();
  const { showToast } = useToast();

  const lastOpened = pdfStore.getLastOpenedDoc();
  const explicitTitle = params.title || params.file || params.name || params.doc;
  const explicitDocId = params.docId;

  let docTitle = explicitTitle || '';
  let docId = explicitDocId || '';

  if (!docId && !docTitle) {
    if (lastOpened) {
      docTitle = lastOpened.name;
      docId = lastOpened.id;
    } else {
      docTitle = 'Q4_Tax_Filing_Signed.pdf';
      docId = 'sample-tax';
    }
  } else if (!docId && docTitle) {
    const matched = pdfStore.getUserFiles().find(
      (f) =>
        f.name.toLowerCase() === docTitle.toLowerCase() ||
        f.id.toLowerCase() === docTitle.toLowerCase()
    );
    docId = matched?.id || docTitle;
  } else if (docId && !docTitle) {
    const matched = pdfStore.getUserFiles().find((f) => f.id === docId);
    docTitle = matched?.name || docId;
  }

  return (
    <PdfReaderScreen
      key={`${docId}-${docTitle}`}
      docTitle={docTitle}
      docId={docId}
      onBack={() => router.back()}
      onShowToast={showToast}
    />
  );
}
