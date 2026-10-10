import React, { useState, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { FilesHomeScreen } from '../src/components/FilesHomeScreen';
import { DocFile } from '../src/types';
import { useToast } from '../src/context/ToastContext';
import { pdfStore } from '../src/services/pdfStore';
import { hasAllFilesAccess } from '../src/services/nativeFilePicker';

export default function IndexScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const [allFiles, setAllFiles] = useState<DocFile[]>(() => pdfStore.getUserFiles());
  // On native devices, expo-splash-screen handles the single native splash screen.
  // On web, the in-app splash overlay provides the single initial launch screen.
  const [isSplashVisible, setIsSplashVisible] = useState(Platform.OS === 'web');
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Keep allFiles in sync with store additions / scan discoveries
  useEffect(() => {
    const unsubscribe = pdfStore.subscribe(() => {
      const files = pdfStore.getUserFiles();
      setAllFiles(files);
    });

    return unsubscribe;
  }, []);

  // Single unified splash lifecycle until files are listed on the homescreen
  useEffect(() => {
    let isMounted = true;
    const startTime = Date.now();
    const MIN_SPLASH_MS = Platform.OS === 'web' ? 600 : 0;

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

        setTimeout(async () => {
          if (!isMounted) return;

          // Hide native splash screen on native devices - revealing files on homescreen
          if (Platform.OS !== 'web') {
            await SplashScreen.hideAsync().catch(() => {});
          } else {
            // Smoothly fade out the single web splash screen into the homescreen
            Animated.timing(fadeAnim, {
              toValue: 0,
              duration: 300,
              useNativeDriver: false,
            }).start(() => {
              if (isMounted) {
                setIsSplashVisible(false);
              }
            });
          }
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
      router.push({
        pathname: '/pdf',
        params: { title: file.name, docId: file.id },
      });
    }
  };

  return (
    <View style={styles.container}>
      {/* Homescreen renders with listed files */}
      <FilesHomeScreen
        files={allFiles}
        onOpenFile={handleOpenFile}
        onShowToast={showToast}
      />

      {/* Single splash screen displayed on web until files are ready and listed */}
      {Platform.OS === 'web' && isSplashVisible && (
        <Animated.View
          style={[
            styles.splashOverlay,
            { opacity: fadeAnim },
          ]}
          pointerEvents={isSplashVisible ? 'auto' : 'none'}
        >
          <View style={styles.splashContent}>
            {/* Brand Logo Box with soft glow */}
            <View style={styles.iconContainer}>
              <View style={styles.iconBackdrop} />
              <Ionicons name="document-text" size={42} color="#ff516a" />
            </View>

            {/* Typography */}
            <Text style={styles.splashTitle}>DocuFlow</Text>
            <Text style={styles.splashSubtitle}>PDF & Document Reader</Text>

            {/* Clean Loading Indicator */}
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color="#ff516a" />
              <Text style={styles.splashStatusText}>Loading document library...</Text>
            </View>
          </View>

          {/* Footer branding */}
          <View style={styles.splashFooter}>
            <View style={styles.secureBadge}>
              <Ionicons name="shield-checkmark" size={13} color="#7bd0ff" />
              <Text style={styles.secureText}>Local Device Storage</Text>
            </View>
          </View>
        </Animated.View>
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
  splashOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0b1326',
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashContent: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: {
    width: 86,
    height: 86,
    borderRadius: 24,
    backgroundColor: '#121d36',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 81, 106, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ff516a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 12,
    position: 'relative',
  },
  iconBackdrop: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 81, 106, 0.12)',
  },
  splashTitle: {
    marginTop: 22,
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.6,
  },
  splashSubtitle: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '500',
    color: '#8e9ba0',
    letterSpacing: 0.2,
  },
  loadingBox: {
    marginTop: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(18, 29, 54, 0.75)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(45, 52, 73, 0.4)',
  },
  splashStatusText: {
    fontSize: 13,
    color: '#dae2fd',
    fontWeight: '500',
  },
  splashFooter: {
    position: 'absolute',
    bottom: 36,
    alignItems: 'center',
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(123, 208, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(123, 208, 255, 0.2)',
  },
  secureText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7bd0ff',
    letterSpacing: 0.3,
  },
});
