import React from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { PdfReaderScreen } from '../src/components/PdfReaderScreen';
import { useToast } from '../src/context/ToastContext';
import { pdfStore } from '../src/services/pdfStore';

export default function PdfScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ title?: string; docId?: string }>();
  const { showToast } = useToast();

  const lastOpened = pdfStore.getLastOpenedDoc();
  const docTitle = params.title || lastOpened?.name || 'Q4_Tax_Filing_Signed.pdf';
  const docId = params.docId || (params.title ? params.title : (lastOpened?.id || docTitle));

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
