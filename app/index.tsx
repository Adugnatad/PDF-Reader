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
  const [isDiscoveringFiles, setIsDiscoveringFiles] = useState(true);

  useEffect(() => {
    const unsubscribe = pdfStore.subscribe(() => {
      setAllFiles(pdfStore.getUserFiles());
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    let isMounted = true;

    const discoverFilesOnStartup = async () => {
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

      try {
        if (hasAccess) {
          await pdfStore.scanDeviceOnceAfterPermission();
        } else {
          await pdfStore.scanDeviceAutomatically();
        }
      } catch (error) {
        console.warn('Could not complete startup file discovery:', error);
      } finally {
        if (isMounted) setIsDiscoveringFiles(false);
      }
    };

    void discoverFilesOnStartup();
    return () => {
      isMounted = false;
    };
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

  if (isDiscoveringFiles) {
    return (
      <View style={styles.splash}>
        <View style={styles.splashIcon}>
          <MaterialIcons name="picture-as-pdf" size={34} color="#ff516a" />
        </View>
        <Text style={styles.splashTitle}>DocuFlow</Text>
        <Text style={styles.splashMessage}>
          Finding PDF documents on your device
        </Text>
        <ActivityIndicator
          style={styles.splashSpinner}
          size="small"
          color="#7bd0ff"
          accessibilityLabel="Discovering PDF documents"
        />
      </View>
    );
  }

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
