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
import { WebView } from 'react-native-webview';
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
}

/**
 * Native Device Implementation (iOS & Android):
 * Directly renders the actual visual PDF without extracting text!
 * - iOS: WKWebView renders the PDF natively via CoreGraphics with high performance.
 * - Android: WebView renders the PDF directly via embedded canvas.
 * - One-tap action to open in Apple QuickLook or Android System Reader.
 */
export const NativePdfView: React.FC<NativePdfViewProps> = ({
  pdfBytes,
  fileName = 'document.pdf',
  currentPage = 1,
  numPages = 1,
  zoom = 1,
}) => {
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [base64Content, setBase64Content] = useState<string>('');
  const [isPreparing, setIsPreparing] = useState(true);

  useEffect(() => {
    let isCancelled = false;
    if (!pdfBytes) return;

    async function prepareFile() {
      try {
        setIsPreparing(true);

        // Convert bytes to base64
        let base64 = '';
        if (typeof Buffer !== 'undefined') {
          base64 = Buffer.from(pdfBytes as any).toString('base64');
        } else {
          const bytes = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes!);
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          base64 = btoa(binary);
        }

        if (isCancelled) return;
        setBase64Content(base64);

        // Write to local cache directory for native file access
        const uri = await getPdfLocalUri(pdfBytes!, fileName);
        if (isCancelled) return;
        setLocalUri(uri);
        setIsPreparing(false);
      } catch (err: any) {
        if (isCancelled) return;
        console.warn('Native view prepare notice:', err);
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
  const viewWidth = Math.min(screenWidth - 24, 620) * zoom;
  const viewHeight = Math.max(500, Math.min(760, Dimensions.get('window').height * 0.75)) * zoom;

  if (isPreparing) {
    return (
      <View style={[styles.loadingBox, { width: viewWidth, height: viewHeight }]}>
        <ActivityIndicator size="large" color="#7bd0ff" />
        <Text style={styles.loadingText}>Opening PDF directly on device...</Text>
      </View>
    );
  }

  // HTML Viewer for Android WebView
  const htmlViewer = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=4.0, user-scalable=yes">
        <style>
          * { box-sizing: border-box; }
          body, html { margin: 0; padding: 0; background: #0b1326; color: #fff; width: 100%; height: 100%; overflow: auto; }
          #container { display: flex; flex-direction: column; align-items: center; padding: 12px; gap: 16px; }
          canvas { max-width: 100%; height: auto; box-shadow: 0 4px 16px rgba(0,0,0,0.5); border-radius: 4px; }
          .msg { text-align: center; color: #7bd0ff; font-family: sans-serif; padding: 24px; font-size: 14px; }
        </style>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
      </head>
      <body>
        <div id="container">
          <div id="loading" class="msg">Loading PDF document...</div>
        </div>
        <script>
          try {
            const raw = atob("${base64Content}");
            const uint8 = new Uint8Array(raw.length);
            for (let i = 0; i < raw.length; i++) uint8[i] = raw.charCodeAt(i);
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            pdfjsLib.getDocument({ data: uint8 }).promise.then(pdf => {
              const loadingEl = document.getElementById('loading');
              if (loadingEl) loadingEl.style.display = 'none';
              const targetPage = Math.min(${currentPage}, pdf.numPages);
              pdf.getPage(targetPage).then(page => {
                const viewport = page.getViewport({ scale: 1.5 });
                const canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                const ctx = canvas.getContext('2d');
                document.getElementById('container').appendChild(canvas);
                page.render({ canvasContext: ctx, viewport: viewport });
              });
            }).catch(e => {
              const loadingEl = document.getElementById('loading');
              if (loadingEl) loadingEl.innerText = 'Tap "Open in System Viewer" above to view';
            });
          } catch(e) {
            const loadingEl = document.getElementById('loading');
            if (loadingEl) loadingEl.innerText = 'Tap "Open in System Viewer" above to view';
          }
        </script>
      </body>
    </html>
  `;

  return (
    <View style={[styles.wrapper, { width: viewWidth, height: viewHeight }]}>
      {/* Top Native Action Bar */}
      <View style={styles.topBar}>
        <View style={styles.badge}>
          <Ionicons name="document-text" size={14} color="#7bd0ff" />
          <Text style={styles.badgeText}>
            Page {currentPage} of {numPages}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.systemBtn}
          onPress={handleOpenSystem}
          activeOpacity={0.75}
        >
          <Ionicons name="open-outline" size={14} color="#0d0096" />
          <Text style={styles.systemBtnText}>Open with System Viewer</Text>
        </TouchableOpacity>
      </View>

      {/* Embedded Native Viewer: iOS uses Apple CoreGraphics via WKWebView; Android uses canvas */}
      <View style={styles.webViewContainer}>
        {Platform.OS === 'ios' && localUri ? (
          <WebView
            source={{ uri: localUri }}
            style={styles.webView}
            originWhitelist={['*']}
            allowFileAccess={true}
            allowFileAccessFromFileURLs={true}
            allowUniversalAccessFromFileURLs={true}
            scalesPageToFit={true}
            bounces={false}
          />
        ) : (
          <WebView
            source={{ html: htmlViewer }}
            style={styles.webView}
            originWhitelist={['*']}
            allowFileAccess={true}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            scalesPageToFit={true}
          />
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
  webViewContainer: {
    flex: 1,
    backgroundColor: '#0b1326',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#131b2e',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#263554',
    gap: 12,
  },
  loadingText: {
    color: '#7bd0ff',
    fontSize: 13,
    fontWeight: '600',
  },
});
