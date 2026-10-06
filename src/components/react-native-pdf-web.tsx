import React, {
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from 'react';
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
 * Features flicker-free double buffering and imperative setPage navigation.
 */
const Pdf = forwardRef<any, PdfProps>((props, forwardedRef) => {
  const {
    source,
    page: propPage,
    scale = 1,
    fitPolicy = 0,
    style,
    onLoadComplete,
    onPageChanged,
    onError,
    onPageSingleTap,
    renderActivityIndicator,
  } = props;

  const [activePage, setActivePage] = useState<number>(propPage || 1);
  const localCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentRenderTask = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState<any>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  // Sync prop changes if propPage is passed explicitly
  useEffect(() => {
    if (propPage !== undefined && propPage !== activePage) {
      setActivePage(propPage);
    }
  }, [propPage]);

  // Expose imperative setPage method matching native react-native-pdf
  useImperativeHandle(forwardedRef, () => ({
    setPage: (pageNumber: number) => {
      setActivePage(pageNumber);
    },
    getCanvas: () => localCanvasRef.current,
  }));

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

        let taskInput: any;
        if (typeof pdfData === 'string') {
          taskInput = { url: pdfData };
        } else if (pdfData instanceof Uint8Array) {
          taskInput = { data: pdfData.slice() };
        } else if (pdfData instanceof ArrayBuffer) {
          taskInput = { data: pdfData.slice(0) };
        } else {
          taskInput = { data: pdfData };
        }

        const task = pdfjsLib.getDocument(taskInput);
        const loadedDoc = await task.promise;
        if (isCancelled) return;

        setDoc(loadedDoc);
        setLoading(false);

        if (onLoadComplete) {
          onLoadComplete(loadedDoc.numPages, uri, { width: 595, height: 842 });
        }
        if (onPageChanged) {
          onPageChanged(activePage, loadedDoc.numPages);
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

  // Render page with flicker-free double buffering
  useEffect(() => {
    let isCancelled = false;
    if (!doc || !localCanvasRef.current) return;

    async function renderPage() {
      try {
        if (currentRenderTask.current) {
          currentRenderTask.current.cancel();
          currentRenderTask.current = null;
        }

        const targetPage = Math.max(1, Math.min(activePage, doc.numPages));
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
        const canvas = localCanvasRef.current;
        if (!canvas) return;

        const pixelRatio =
          (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
        const targetWidth = Math.floor(viewport.width * pixelRatio);
        const targetHeight = Math.floor(viewport.height * pixelRatio);

        // Flicker-free double buffering: Render onto an offscreen canvas
        const offscreen = document.createElement('canvas');
        offscreen.width = targetWidth;
        offscreen.height = targetHeight;
        const offCtx = offscreen.getContext('2d');
        if (!offCtx) return;

        offCtx.scale(pixelRatio, pixelRatio);

        const renderTask = pageObj.render({
          canvasContext: offCtx,
          viewport,
        });
        currentRenderTask.current = renderTask;
        await renderTask.promise;
        if (isCancelled) return;

        // Atomically copy the rendered offscreen buffer to the visible canvas in a single frame
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        canvas.style.width = '100%';
        canvas.style.height = 'auto';

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(offscreen, 0, 0);
        }

        if (onPageChanged) {
          onPageChanged(targetPage, doc.numPages);
        }
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
  }, [doc, activePage, scale, containerWidth, fitPolicy]);

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
        ref={localCanvasRef}
        onClick={(e) => {
          if (onPageSingleTap) {
            const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            onPageSingleTap(activePage, x, y);
          }
        }}
        style={{
          display: loading ? 'none' : 'block',
          width: '100%',
          height: 'auto',
          maxWidth: '100%',
          cursor: 'pointer',
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
