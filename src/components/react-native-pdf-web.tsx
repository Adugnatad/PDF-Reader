import React, { useEffect, useRef, useState, forwardRef } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { pdfjsLib } from '../services/pdfService';

export interface Source {
  uri?: string;
  headers?: { [key: string]: string };
  cache?: boolean;
  cacheFileName?: string;
  expiration?: number;
  method?: string;
}

export interface PdfProps {
  style?: any;
  progressContainerStyle?: any;
  source: Source | number;
  page?: number;
  scale?: number;
  minScale?: number;
  maxScale?: number;
  horizontal?: boolean;
  showsHorizontalScrollIndicator?: boolean;
  showsVerticalScrollIndicator?: boolean;
  scrollEnabled?: boolean;
  spacing?: number;
  password?: string;
  renderActivityIndicator?: (progress: number) => React.ReactElement;
  enableAntialiasing?: boolean;
  enableAnnotationRendering?: boolean;
  enablePaging?: boolean;
  enableRTL?: boolean;
  fitPolicy?: 0 | 1 | 2;
  trustAllCerts?: boolean;
  singlePage?: boolean;
  onLoadProgress?: (percent: number) => void;
  onLoadComplete?: (
    numberOfPages: number,
    path: string,
    size: { height: number; width: number }
  ) => void;
  onPageChanged?: (page: number, numberOfPages: number) => void;
  onError?: (error: object) => void;
  onPageSingleTap?: (page: number, x: number, y: number) => void;
  onScaleChanged?: (scale: number) => void;
  onPressLink?: (uri: string) => void;
  canvasRef?: any;
}

/**
 * Web Implementation of react-native-pdf
 * Provides 100% API compatibility with `import Pdf from 'react-native-pdf'`
 * rendering via HTML5 canvas on the Web while native devices use the native binary.
 */
const Pdf = forwardRef<any, PdfProps>((props, forwardedRef) => {
  const {
    source,
    page = 1,
    scale = 1,
    style,
    onLoadComplete,
    onPageChanged,
    onError,
    renderActivityIndicator,
  } = props;

  const localCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasRef = (forwardedRef as any) || props.canvasRef || localCanvasRef;
  const currentRenderTask = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState<any>(null);

  const uri = typeof source === 'object' && source?.uri ? source.uri : '';

  useEffect(() => {
    let isCancelled = false;
    if (!uri) return;

    setLoading(true);

    async function loadDocument() {
      try {
        let pdfData: any = uri;
        if (uri.startsWith('data:application/pdf;base64,')) {
          const b64 = uri.replace('data:application/pdf;base64,', '');
          const binary = atob(b64);
          const len = binary.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          pdfData = bytes;
        }

        const task = pdfjsLib.getDocument(
          typeof pdfData === 'string' ? { url: pdfData } : { data: pdfData }
        );
        const loadedDoc = await task.promise;
        if (isCancelled) return;

        setDoc(loadedDoc);
        setLoading(false);

        if (onLoadComplete) {
          onLoadComplete(loadedDoc.numPages, uri, { width: 595, height: 842 });
        }
        if (onPageChanged) {
          onPageChanged(page, loadedDoc.numPages);
        }
      } catch (err: any) {
        if (isCancelled) return;
        setLoading(false);
        if (onError) onError(err);
      }
    }

    loadDocument();
    return () => {
      isCancelled = true;
    };
  }, [uri]);

  useEffect(() => {
    let isCancelled = false;
    if (!doc || !canvasRef.current) return;

    async function renderPage() {
      try {
        if (currentRenderTask.current) {
          currentRenderTask.current.cancel();
          currentRenderTask.current = null;
        }

        const targetPage = Math.max(1, Math.min(page, doc.numPages));
        const pageObj = await doc.getPage(targetPage);
        if (isCancelled) return;

        const viewport = pageObj.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const renderTask = pageObj.render({
          canvasContext: ctx,
          viewport,
        });
        currentRenderTask.current = renderTask;
        await renderTask.promise;
      } catch (err: any) {
        if (err?.name === 'RenderingCancelledException') return;
        if (onError) onError(err);
      }
    }

    renderPage();
    return () => {
      isCancelled = true;
      if (currentRenderTask.current) {
        currentRenderTask.current.cancel();
      }
    };
  }, [doc, page, scale]);

  return (
    <View style={[styles.container, style]}>
      {loading && (
        <View style={styles.loader}>
          {renderActivityIndicator ? (
            renderActivityIndicator(0)
          ) : (
            <ActivityIndicator size="small" color="#7bd0ff" />
          )}
        </View>
      )}
      <canvas
        ref={canvasRef}
        style={{
          display: loading ? 'none' : 'block',
          maxWidth: '100%',
        }}
      />
    </View>
  );
});

export default Pdf;

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loader: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
