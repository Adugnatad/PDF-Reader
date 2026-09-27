import React from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { PdfReaderScreen } from '../src/components/PdfReaderScreen';
import { useToast } from '../src/context/ToastContext';

export default function PdfScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ title?: string; docId?: string }>();
  const { showToast } = useToast();

  const docTitle = params.title || 'Q4_Tax_Filing_Signed.pdf';
  const docId = params.docId || docTitle;

  return (
    <PdfReaderScreen
      docTitle={docTitle}
      docId={docId}
      onBack={() => router.back()}
      onShowToast={showToast}
    />
  );
}
