import React, { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { FilesHomeScreen } from '../src/components/FilesHomeScreen';
import { INITIAL_FILES } from '../src/data/mockData';
import { DocFile } from '../src/types';
import { useToast } from '../src/context/ToastContext';
import { pdfStore } from '../src/services/pdfStore';

export default function IndexScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const [allFiles, setAllFiles] = useState<DocFile[]>(() => [
    ...pdfStore.getUserFiles(),
    ...INITIAL_FILES,
  ]);

  useEffect(() => {
    return pdfStore.subscribe(() => {
      setAllFiles([...pdfStore.getUserFiles(), ...INITIAL_FILES]);
    });
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
