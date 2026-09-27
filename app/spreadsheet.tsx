import React from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SpreadsheetReaderScreen } from '../src/components/SpreadsheetReaderScreen';
import { useToast } from '../src/context/ToastContext';

export default function SpreadsheetScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ fileName?: string }>();
  const { showToast } = useToast();

  const fileName = params.fileName || 'Q3_Financial_Statements_Consolidated.xlsx';

  return (
    <SpreadsheetReaderScreen
      fileName={fileName}
      onBack={() => router.back()}
      onShowToast={showToast}
    />
  );
}
