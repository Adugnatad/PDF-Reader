import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { FilesHomeScreen } from '../src/components/FilesHomeScreen';
import { DocFile } from '../src/types';
import { useToast } from '../src/context/ToastContext';
import { pdfStore } from '../src/services/pdfStore';
import { hasAllFilesAccess } from '../src/services/nativeFilePicker';

export default function IndexScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const [allFiles, setAllFiles] = useState<DocFile[]>(() => pdfStore.getUserFiles());

  useEffect(() => {
    const unsubscribe = pdfStore.subscribe(() => {
      setAllFiles(pdfStore.getUserFiles());
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    let isMounted = true;

    const discoverFilesOnStartup = async () => {
      try {
        const timeoutPromise = new Promise<void>((resolve) =>
          setTimeout(resolve, 8000)
        );

        const scanTask = (async () => {
          const needsAndroidPermission =
            Platform.OS === 'android' && Number(Platform.Version) >= 30;
          let hasAccess = false;

          if (needsAndroidPermission) {
            try {
              hasAccess = await hasAllFilesAccess();
            } catch (error) {
              console.warn('Could not check file access before discovery:', error);
            }
          }

          if (hasAccess) {
            await pdfStore.scanDeviceOnceAfterPermission();
          } else {
            await pdfStore.scanDeviceAutomatically();
          }
        })();

        await Promise.race([scanTask, timeoutPromise]);
      } catch (error) {
        console.warn('Startup file discovery note:', error);
      }
    };

    void discoverFilesOnStartup();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleOpenFile = (file: DocFile) => {
    pdfStore.recordFileOpened(file.id);
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

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0b1326',
    padding: 24,
  },
  splashIcon: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255, 81, 106, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 81, 106, 0.3)',
  },
  splashTitle: {
    marginTop: 18,
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  splashMessage: {
    marginTop: 8,
    color: '#aab4c8',
    fontSize: 14,
    textAlign: 'center',
  },
  splashSpinner: {
    marginTop: 28,
  },
});
