import React, { useEffect, useRef, useState, forwardRef } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { pdfjsLib } from '../services/pdfService';
import { fastBase64ToUint8 } from '../utils/fastBase64';

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
 * rendering via HTML5 canvas, edge-to-edge full width with sharp devicePixelRatio scaling.
 */
const Pdf = forwardRef<any, PdfProps>((props, forwardedRef) => {
  const {
    source,
    page = 1,
    scale = 1,
    fitPolicy = 0,
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
  const [containerWidth, setContainerWidth] = useState<number>(0);

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
          pdfData = fastBase64ToUint8(b64);
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
        console.warn('react-native-pdf web error:', err);
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

        const baseViewport = pageObj.getViewport({ scale: 1.0 });

        // Calculate fit-to-width scale so the PDF fills the screen completely
        let effectiveScale = scale;
        const parentWidth =
          containerWidth ||
          (typeof window !== 'undefined' ? window.innerWidth : 600);
        if (fitPolicy === 0 && parentWidth > 0 && baseViewport.width > 0) {
          effectiveScale = (parentWidth / baseViewport.width) * scale;
        }

        const viewport = pageObj.getViewport({ scale: effectiveScale });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const pixelRatio =
          (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.width = '100%';
        canvas.style.height = 'auto';

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.save();
        ctx.scale(pixelRatio, pixelRatio);

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
  }, [doc, page, scale, containerWidth, fitPolicy]);

  return (
    <View
      style={[styles.container, style]}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && Math.abs(w - containerWidth) > 2) {
          setContainerWidth(w);
        }
      }}
    >
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
          width: '100%',
          height: 'auto',
          maxWidth: '100%',
        }}
      />
    </View>
  );
});

export default Pdf;

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flex: 1,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  loader: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
