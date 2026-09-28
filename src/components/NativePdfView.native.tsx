import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import Pdf from 'react-native-pdf';
import { Ionicons } from '@expo/vector-icons';
import { getPdfLocalUri, openInNativeSystemViewer } from '../services/nativePdfOpener';

interface NativePdfViewProps {
  canvasRef?: any;
  drawCanvasRef?: any;
  pdfBytes?: Uint8Array | ArrayBuffer | null;
  fileName?: string;
  currentPage?: number;
  numPages?: number;
  zoom?: number;
  themeColors?: any;
  activeTool?: string;
  onOpenSystemViewer?: () => void;
  onPageChanged?: (page: number, total: number) => void;
}

/**
 * Native PDF Viewer powered by react-native-pdf package
 * Offers hardware-accelerated native PDF rendering on iOS and Android
 * with continuous scroll, pinch-to-zoom, and page navigation.
 */
export const NativePdfView: React.FC<NativePdfViewProps> = ({
  pdfBytes,
  fileName = 'document.pdf',
  currentPage = 1,
  numPages = 1,
  zoom = 1,
  onPageChanged,
}) => {
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [isPreparing, setIsPreparing] = useState(true);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState<number>(numPages);

  useEffect(() => {
    let isCancelled = false;
    if (!pdfBytes) return;

    async function prepareFile() {
      try {
        setIsPreparing(true);
        setPdfError(null);

        // Save bytes to native cache directory and obtain file:// URI
        const uri = await getPdfLocalUri(pdfBytes!, fileName);
        if (isCancelled) return;
        setLocalUri(uri);
        setIsPreparing(false);
      } catch (err: any) {
        if (isCancelled) return;
        console.warn('Native PDF file prep notice:', err);
        setPdfError(err?.message || 'Could not prepare file for native viewer');
        setIsPreparing(false);
      }
    }

    prepareFile();
    return () => {
      isCancelled = true;
    };
  }, [pdfBytes, fileName]);

  const handleOpenSystem = async () => {
    if (pdfBytes) {
      await openInNativeSystemViewer(pdfBytes, fileName);
    }
  };

  const screenWidth = Dimensions.get('window').width;
  const viewWidth = Math.min(screenWidth - 24, 640) * zoom;
  const viewHeight = Math.max(520, Math.min(780, Dimensions.get('window').height * 0.76)) * zoom;

  if (isPreparing) {
    return (
      <View style={[styles.loadingBox, { width: viewWidth, height: viewHeight }]}>
        <ActivityIndicator size="small" color="#7bd0ff" />
        <Text style={styles.loadingText}>Opening PDF via react-native-pdf...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, { width: viewWidth, height: viewHeight }]}>
      {/* Top Native Action Bar */}
      <View style={styles.topBar}>
        <View style={styles.badge}>
          <Ionicons name="document-text" size={14} color="#7bd0ff" />
          <Text style={styles.badgeText}>
            Page {currentPage} of {totalPages || numPages} • Native Engine
          </Text>
        </View>
        <TouchableOpacity
          style={styles.systemBtn}
          onPress={handleOpenSystem}
          activeOpacity={0.75}
        >
          <Ionicons name="open-outline" size={14} color="#0d0096" />
          <Text style={styles.systemBtnText}>System Viewer</Text>
        </TouchableOpacity>
      </View>

      {/* Main Native PDF View using react-native-pdf */}
      <View style={styles.pdfContainer}>
        {localUri && !pdfError ? (
          <Pdf
            source={{ uri: localUri, cache: true }}
            page={currentPage}
            scale={zoom}
            horizontal={false}
            enablePaging={false}
            enableRTL={false}
            enableAnnotationRendering={true}
            trustAllCerts={false}
            fitPolicy={0} // fit width
            onLoadComplete={(numberOfPages) => {
              setTotalPages(numberOfPages);
            }}
            onPageChanged={(page, numberOfPages) => {
              setTotalPages(numberOfPages);
              if (onPageChanged) {
                onPageChanged(page, numberOfPages);
              }
            }}
            onError={(error) => {
              console.warn('react-native-pdf load error:', error);
              setPdfError(typeof error === 'string' ? error : (error as any)?.message || 'Render error');
            }}
            style={styles.pdfView}
          />
        ) : (
          <View style={styles.fallbackBox}>
            <Ionicons name="document-text-outline" size={38} color="#7bd0ff" />
            <Text style={styles.fallbackTitle}>Ready to Read</Text>
            <Text style={styles.fallbackSubtitle}>
              {fileName} ({((pdfBytes as Uint8Array)?.byteLength || 0) > 0 ? `${Math.round(((pdfBytes as Uint8Array).byteLength) / 1024)} KB` : 'PDF Document'})
            </Text>
            <TouchableOpacity
              style={styles.fallbackBtn}
              onPress={handleOpenSystem}
              activeOpacity={0.8}
            >
              <Ionicons name="open-outline" size={16} color="#0d0096" />
              <Text style={styles.fallbackBtnText}>Open with Native System Reader</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#131b2e',
    borderWidth: 1,
    borderColor: '#263554',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 8,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0e1629',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#263554',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeText: {
    color: '#7bd0ff',
    fontSize: 11,
    fontWeight: '700',
  },
  systemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#7bd0ff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  systemBtnText: {
    color: '#0d0096',
    fontSize: 11,
    fontWeight: '700',
  },
  pdfContainer: {
    flex: 1,
    backgroundColor: '#0b1326',
  },
  pdfView: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#0b1326',
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#131b2e',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#263554',
    gap: 8,
  },
  loadingText: {
    color: '#7bd0ff',
    fontSize: 12,
    fontWeight: '600',
  },
  fallbackBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  fallbackTitle: {
    color: '#f0f3ff',
    fontSize: 16,
    fontWeight: '700',
  },
  fallbackSubtitle: {
    color: '#908fa0',
    fontSize: 12,
  },
  fallbackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#7bd0ff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  fallbackBtnText: {
    color: '#0d0096',
    fontSize: 13,
    fontWeight: '700',
  },
});
