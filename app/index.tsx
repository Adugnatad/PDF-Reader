import React, { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { FilesHomeScreen } from '../src/components/FilesHomeScreen';
import { DocFile } from '../src/types';
import { useToast } from '../src/context/ToastContext';
import { pdfStore } from '../src/services/pdfStore';

export default function IndexScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const [allFiles, setAllFiles] = useState<DocFile[]>(() => pdfStore.getUserFiles());

  useEffect(() => {
    // 1. Subscribe to store changes immediately
    const unsubscribe = pdfStore.subscribe(() => {
      setAllFiles(pdfStore.getUserFiles());
    });

    // 2. Automatically scan native device storage for PDF documents on launch
    pdfStore.scanDeviceAutomatically().then((found) => {
      setAllFiles([...found]);
    }).catch((err) => {
      console.warn('Auto device scan error:', err);
    });

    return unsubscribe;
  }, []);

  const handleOpenFile = (file: DocFile) => {
    if (file.type === 'xlsx') {
      router.push({
        pathname: '/spreadsheet',
        params: { fileName: file.name },
      });
    } else {
      router.push({
        pathname: '/pdf',
        params: { title: file.name, docId: file.id },
      });
    }
  };

  return (
    <FilesHomeScreen
      files={allFiles}
      onOpenFile={handleOpenFile}
      onShowToast={showToast}
    />
  );
}
