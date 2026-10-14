import React, { useState, useEffect, useRef } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { FilesHomeScreen } from '../src/components/FilesHomeScreen';
import { PdfSplashScreen } from '../src/components/PdfSplashScreen';
import { DocFile } from '../src/types';
import { useToast } from '../src/context/ToastContext';
import { pdfStore } from '../src/services/pdfStore';
import { hasAllFilesAccess } from '../src/services/nativeFilePicker';

export default function IndexScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    title?: string;
    docId?: string;
    file?: string;
    name?: string;
    doc?: string;
  }>();
  const { showToast } = useToast();
  const [allFiles, setAllFiles] = useState<DocFile[]>(() => pdfStore.getUserFiles());
  const [isSplashVisible, setIsSplashVisible] = useState(true);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Immediately redirect to PDF reader if a specific document is requested in the URL
  useEffect(() => {
    const targetTitle = params.title || params.file || params.name || params.doc;
    const targetId = params.docId;
    if (targetTitle || targetId) {
      const resolvedUri =
        (targetId ? pdfStore.getNativeUri(targetId) : undefined) ||
        (targetTitle ? pdfStore.getNativeUri(targetTitle) : undefined) ||
        '';
      router.replace({
        pathname: '/pdf',
        params: {
          title: targetTitle || '',
          docId: targetId || (targetTitle ? targetTitle : ''),
          uri: resolvedUri,
        },
      });
    }
  }, [params.title, params.docId, params.file, params.name, params.doc]);

  // Keep allFiles in sync with store additions / scan discoveries
  useEffect(() => {
    const unsubscribe = pdfStore.subscribe(() => {
      const files = pdfStore.getUserFiles();
      setAllFiles(files);
    });

    return unsubscribe;
  }, []);

  // Loading screen lifecycle while PDF files are loaded & listed in the background
  useEffect(() => {
    let isMounted = true;
    const startTime = Date.now();
    const MIN_SPLASH_MS = 1200;

    // Hide native splash immediately on native so our custom screen is shown
    if (Platform.OS !== 'web') {
      SplashScreen.hideAsync().catch(() => {});
    }

    const startup = async () => {
      try {
        await pdfStore.waitForInit();

        let initialFiles = pdfStore.getUserFiles();
        if (isMounted) {
          setAllFiles(initialFiles);
        }

        // On native Android / iOS or if library is empty, run auto-discovery
        if (initialFiles.length === 0 || Platform.OS !== 'web') {
          const timeoutPromise = new Promise<void>((resolve) =>
            setTimeout(resolve, 3000)
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
        }

        initialFiles = pdfStore.getUserFiles();
        if (isMounted) {
          setAllFiles(initialFiles);
        }
      } catch (error) {
        console.warn('Startup discovery note:', error);
      } finally {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, MIN_SPLASH_MS - elapsed);

        setTimeout(() => {
          if (!isMounted) return;

          // Smoothly fade out the splash screen to reveal listed files on home screen
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 400,
            useNativeDriver: false,
          }).start(() => {
            if (isMounted) {
              setIsSplashVisible(false);
            }
          });
        }, remaining);
      }
    };

    void startup();

    return () => {
      isMounted = false;
    };
  }, [fadeAnim]);

  const handleOpenFile = (file: DocFile) => {
    pdfStore.recordFileOpened(file.id);
    if (file.type === 'xlsx') {
      router.push({
        pathname: '/spreadsheet',
        params: { fileName: file.name },
      });
    } else {
      const nativeUri =
        pdfStore.getNativeUri(file.id) ||
        pdfStore.getNativeUri(file.name) ||
        '';
      router.push({
        pathname: '/pdf',
        params: {
          title: file.name,
          docId: file.id,
          uri: nativeUri,
        },
      });
    }
  };

  return (
    <View style={styles.container}>
      {/* Homescreen renders with listed files in the background */}
      <FilesHomeScreen
        files={allFiles}
        onOpenFile={handleOpenFile}
        onShowToast={showToast}
      />

      {/* Loading Screen while PDF files are loaded & listed */}
      {isSplashVisible && (
        <PdfSplashScreen
          visible={isSplashVisible}
          fadeAnim={fadeAnim}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1326',
    width: '100%',
    height: '100%',
  },
});
