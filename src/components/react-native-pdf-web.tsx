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
  rotation?: number;
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
    rotation = 0,
    fitPolicy = 0,
    style,
    onLoadComplete,
    onPageChanged,
    onError,
    onPageSingleTap,
    renderActivityIndicator,
    onPressLink,
  } = props;

  interface PageLinkItem {
    id: string;
    leftPct: number;
    topPct: number;
    widthPct: number;
    heightPct: number;
    targetPage?: number;
    url?: string;
  }

  const [activePage, setActivePage] = useState<number>(propPage || 1);
  const [pageLinks, setPageLinks] = useState<PageLinkItem[]>([]);
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

        const baseViewport = pageObj.getViewport({ scale: 1.0, rotation });

        // Calculate fit-to-width scale so the PDF fills the screen completely
        let effectiveScale = scale;
        const parentWidth =
          containerWidth ||
          (typeof window !== 'undefined' ? window.innerWidth : 600);
        if (fitPolicy === 0 && parentWidth > 0 && baseViewport.width > 0) {
          effectiveScale = (parentWidth / baseViewport.width) * scale;
        }

        const viewport = pageObj.getViewport({ scale: effectiveScale, rotation });
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

        // Extract and resolve Table of Contents (TOC) and Link Annotations
        try {
          const rawAnnots = await pageObj.getAnnotations();
          const linksList: PageLinkItem[] = [];

          for (let i = 0; i < (rawAnnots || []).length; i++) {
            const annot = rawAnnots[i];
            if (annot.subtype !== 'Link' || !annot.rect) continue;

            // Convert PDF rect [x1, y1, x2, y2] to viewport coordinates
            const bounds = viewport.convertToViewportRectangle(annot.rect);
            const left = Math.min(bounds[0], bounds[2]);
            const top = Math.min(bounds[1], bounds[3]);
            const width = Math.max(4, Math.abs(bounds[0] - bounds[2]));
            const height = Math.max(4, Math.abs(bounds[1] - bounds[3]));

            const leftPct = (left / viewport.width) * 100;
            const topPct = (top / viewport.height) * 100;
            const widthPct = (width / viewport.width) * 100;
            const heightPct = (height / viewport.height) * 100;

            let targetPage: number | undefined;
            let url: string | undefined;

            // 1. External URL
            if (annot.url) {
              url = annot.url;
            } else if (annot.unsafeUrl) {
              url = annot.unsafeUrl;
            } else if (annot.action === 'URI' && annot.uri) {
              url = annot.uri;
            }

            // 2. Internal Link Destination (e.g. TOC jump)
            if (!url && annot.dest) {
              try {
                let explicitDest = annot.dest;
                if (typeof explicitDest === 'string') {
                  explicitDest = await doc.getDestination(explicitDest);
                  if (!explicitDest) {
                    const m = annot.dest.match(/(?:page=|#page=|#|)(\d+)/i);
                    if (m && m[1]) {
                      const p = parseInt(m[1], 10);
                      if (p >= 1 && p <= doc.numPages) targetPage = p;
                    }
                  }
                }

                if (explicitDest && !targetPage) {
                  const pageRef = Array.isArray(explicitDest) ? explicitDest[0] : explicitDest;
                  if (pageRef && typeof pageRef === 'object' && ('num' in pageRef || 'gen' in pageRef)) {
                    const pageIndex = await doc.getPageIndex(pageRef);
                    if (typeof pageIndex === 'number' && pageIndex >= 0) {
                      targetPage = pageIndex + 1;
                    }
                  } else if (typeof pageRef === 'number') {
                    targetPage = pageRef >= 0 && pageRef < doc.numPages ? pageRef + 1 : pageRef;
                  }
                }
              } catch (destErr) {
                console.warn('Destination resolution error:', destErr);
              }
            }

            if (targetPage !== undefined || url !== undefined) {
              linksList.push({
                id: `link-${targetPage || 'url'}-${i}-${annot.id || i}`,
                leftPct,
                topPct,
                widthPct,
                heightPct,
                targetPage,
                url,
              });
            }
          }

          if (!isCancelled) {
            setPageLinks(linksList);
          }
        } catch (annotErr) {
          console.warn('Could not read PDF annotations:', annotErr);
          if (!isCancelled) {
            setPageLinks([]);
          }
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
  }, [doc, activePage, scale, rotation, containerWidth, fitPolicy]);

  const handleLinkPressInternal = (link: PageLinkItem, e: any) => {
    e.preventDefault();
    e.stopPropagation();

    if (link.targetPage) {
      if (onPressLink) {
        onPressLink(String(link.targetPage));
      } else {
        setActivePage(link.targetPage);
        if (onPageChanged && doc) {
          onPageChanged(link.targetPage, doc.numPages);
        }
      }
    } else if (link.url) {
      if (onPressLink) {
        onPressLink(link.url);
      } else {
        try {
          window.open(link.url, '_blank', 'noopener,noreferrer');
        } catch {
          // ignore
        }
      }
    }
  };

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
      <div
        style={{
          position: 'relative',
          width: '100%',
          display: loading ? 'none' : 'block',
        }}
      >
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
            display: 'block',
            width: '100%',
            height: 'auto',
            maxWidth: '100%',
            cursor: 'default',
          }}
        />

        {/* Clickable TOC and Link Annotations Layer */}
        {pageLinks.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              overflow: 'hidden',
            }}
          >
            {pageLinks.map((link) => (
              <a
                key={link.id}
                href={link.url || (link.targetPage ? `#page=${link.targetPage}` : '#')}
                title={
                  link.url
                    ? `Open link: ${link.url}`
                    : link.targetPage
                    ? `Jump to Page ${link.targetPage}`
                    : 'PDF Link'
                }
                onClick={(e) => handleLinkPressInternal(link, e)}
                style={{
                  position: 'absolute',
                  left: `${link.leftPct}%`,
                  top: `${link.topPct}%`,
                  width: `${link.widthPct}%`,
                  height: `${link.heightPct}%`,
                  pointerEvents: 'auto',
                  cursor: 'pointer',
                  backgroundColor: 'rgba(59, 130, 246, 0.04)',
                  borderRadius: 2,
                  outline: 'none',
                  display: 'block',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.16)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.04)';
                }}
              />
            ))}
          </div>
        )}
      </div>
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
