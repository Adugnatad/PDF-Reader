import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Platform,
  Image,
  Dimensions,
  StatusBar,
  Animated,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { Header } from "./Header";
import { ReaderTheme } from "../types";
import { pdfStore } from "../services/pdfStore";
import { pdfjsLib } from "../services/pdfService";
import { ViewModeModal } from "./ViewModeModal";
import { pickPdfFromDevice } from "../services/nativeFilePicker";
import Pdf from "react-native-pdf";
import { fastUint8ToBase64 } from "../utils/fastBase64";
import {
  getPdfLocalUri,
  openInNativeSystemViewer,
} from "../services/nativePdfOpener";
import {
  saveViewModeSettings,
  loadViewModeSettings,
} from "../services/storageHelper";

interface PdfReaderScreenProps {
  onBack: () => void;
  onShowToast: (msg: string) => void;
  docTitle?: string;
  docId?: string;
}

interface NoteAnnotation {
  id: string;
  page: number;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  text: string;
  author: string;
  time: string;
}

interface StampAnnotation {
  id: string;
  page: number;
  x: number;
  y: number;
  title: string;
  time: string;
}

interface SearchMatch {
  page: number;
  snippet: string;
}

export const PdfReaderScreen: React.FC<PdfReaderScreenProps> = ({
  onBack,
  onShowToast,
  docTitle = "Q4_Tax_Filing_Signed.pdf",
  docId,
}) => {
  // Document State
  const [activeTitle, setActiveTitle] = useState(docTitle);
  const [activeId, setActiveId] = useState(docId || docTitle);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | ArrayBuffer | null>(
    null,
  );
  const [nativePdfUri, setNativePdfUri] = useState("");
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // View & Layout Settings
  const [theme, setTheme] = useState<ReaderTheme>("sepia");
  const [reflow, setReflow] = useState<boolean>(false);
  const [reflowFontSize, setReflowFontSize] = useState<number>(16);
  const [reflowText, setReflowText] = useState<string>("");
  const [reflowParagraphs, setReflowParagraphs] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"single" | "continuous">("single");
  const [readingDirection, setReadingDirection] = useState<
    "horizontal" | "vertical"
  >("vertical");

  // Load remembered View Mode settings on mount
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const saved = await loadViewModeSettings();
        if (saved && isMounted) {
          if (saved.viewMode) setViewMode(saved.viewMode);
          if (typeof saved.reflow === "boolean") setReflow(saved.reflow);
          if (saved.reflowFontSize) setReflowFontSize(saved.reflowFontSize);
          if (saved.theme) setTheme(saved.theme);
          if (saved.readingDirection)
            setReadingDirection(saved.readingDirection);
        }
      } catch (err) {
        console.warn("Could not load view mode settings:", err);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // Handlers to update and immediately persist View Mode choices
  const handleUpdateViewMode = useCallback(
    (mode: "single" | "continuous") => {
      setViewMode(mode);
      saveViewModeSettings({
        viewMode: mode,
        reflow,
        reflowFontSize,
        theme,
        readingDirection,
      });
    },
    [reflow, reflowFontSize, theme, readingDirection],
  );

  const handleUpdateReflow = useCallback(
    (active: boolean) => {
      setReflow(active);
      saveViewModeSettings({
        viewMode,
        reflow: active,
        reflowFontSize,
        theme,
        readingDirection,
      });
    },
    [viewMode, reflowFontSize, theme, readingDirection],
  );

  const handleUpdateFontSize = useCallback(
    (size: number) => {
      setReflowFontSize(size);
      saveViewModeSettings({
        viewMode,
        reflow,
        reflowFontSize: size,
        theme,
        readingDirection,
      });
    },
    [viewMode, reflow, theme, readingDirection],
  );

  const handleUpdateTheme = useCallback(
    (newTheme: ReaderTheme) => {
      setTheme(newTheme);
      saveViewModeSettings({
        viewMode,
        reflow,
        reflowFontSize,
        theme: newTheme,
        readingDirection,
      });
    },
    [viewMode, reflow, reflowFontSize, readingDirection],
  );

  const handleUpdateReadingDirection = useCallback(
    (dir: "horizontal" | "vertical") => {
      setReadingDirection(dir);
      saveViewModeSettings({
        viewMode,
        reflow,
        reflowFontSize,
        theme,
        readingDirection: dir,
      });
    },
    [viewMode, reflow, reflowFontSize, theme],
  );

  const [showViewModeModal, setShowViewModeModal] = useState<boolean>(false);
  const [zoom, setZoom] = useState<number>(1.0);
  const [rotation, setRotation] = useState<number>(0);
  const [showThumbnails, setShowThumbnails] = useState<boolean>(false);
  const [isBookmarked, setIsBookmarked] = useState<boolean>(false);
  const [showPagePicker, setShowPagePicker] = useState<boolean>(false);
  const [showBars, setShowBars] = useState<boolean>(true);

  // Smooth bar transitions that never trigger layout recalculation or native page blinks
  const barsAnim = useRef(new Animated.Value(1)).current;

  // Top-left page pill visibility animation (shows only on interaction, auto-fades out)
  const pillOpacity = useRef(new Animated.Value(0)).current;
  const pillTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerPageInteraction = useCallback(() => {
    if (pillTimerRef.current) {
      clearTimeout(pillTimerRef.current);
    }
    Animated.timing(pillOpacity, {
      toValue: 1,
      duration: 160,
      useNativeDriver: Platform.OS !== "web",
    }).start();

    pillTimerRef.current = setTimeout(() => {
      Animated.timing(pillOpacity, {
        toValue: 0,
        duration: 350,
        useNativeDriver: Platform.OS !== "web",
      }).start();
    }, 2500);
  }, [pillOpacity]);

  useEffect(() => {
    return () => {
      if (pillTimerRef.current) {
        clearTimeout(pillTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    Animated.timing(barsAnim, {
      toValue: showBars ? 1 : 0,
      duration: 220,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [showBars, barsAnim]);

  // Search State
  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<SearchMatch[]>([]);
  const [searchIndex, setSearchIndex] = useState<number>(0);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // Annotation & Drawing State
  const [activeTool, setActiveTool] = useState<
    "hand" | "highlighter" | "pen" | "note" | "signature" | "eraser"
  >("hand");
  const [notes, setNotes] = useState<NoteAnnotation[]>([]);
  const [stamps, setStamps] = useState<StampAnnotation[]>([]);
  const [activeNoteEditing, setActiveNoteEditing] = useState<string | null>(
    null,
  );
  const [newNoteInput, setNewNoteInput] = useState<string>("");

  // Tap-on-file full screen toggle callback
  const handleSingleTap = useCallback(() => {
    // Do not toggle bars if actively drawing with pen or highlighter
    if (activeTool === "pen" || activeTool === "highlighter") return;
    if (activeNoteEditing) {
      setActiveNoteEditing(null);
      return;
    }
    setShowBars((prev) => !prev);
    triggerPageInteraction();
  }, [activeTool, activeNoteEditing, triggerPageInteraction]);

  // Thumbnails Data Cache (data URLs)
  const [thumbnails, setThumbnails] = useState<Record<number, string>>({});

  // Source for react-native-pdf (Web uses data URI, native devices can use local file URI or base64 data URI)
  const pdfSource = useMemo(() => {
    if (!pdfBytes) return { uri: "" };
    if (Platform.OS !== "web" && nativePdfUri) {
      return { uri: nativePdfUri, cache: true };
    }
    const b64 = fastUint8ToBase64(pdfBytes);
    return { uri: `data:application/pdf;base64,${b64}`, cache: true };
  }, [pdfBytes, nativePdfUri]);

  // Canvas & DOM Refs (portable across React Native and Web)
  const canvasRef = useRef<any>(null);
  const drawCanvasRef = useRef<any>(null);
  const currentRenderTask = useRef<any>(null);
  const fileInputRef = useRef<any>(null);
  const continuousContainerRef = useRef<any>(null);

  // Continuous page canvas refs
  const continuousCanvases = useRef<Map<number, any>>(new Map());

  // 1. Fetch PDF Data from store
  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);
    setLoadError(null);

    async function loadPdf() {
      try {
        setNativePdfUri("");
        const item = await pdfStore.getPdfData(activeId);
        if (isCancelled) return;
        setPdfBytes(item.data);
        setActiveTitle(item.name);

        if (Platform.OS !== "web") {
          const directUri =
            item.nativeUri || (await getPdfLocalUri(item.data, item.name));
          if (isCancelled) return;
          setNativePdfUri(directUri);
        }

        // On Web, initialize pdfjsLib for search, reflow, and continuous view
        if (Platform.OS === "web") {
          const loadingTask = pdfjsLib.getDocument({
            data: item.data,
          });

          const loadedDoc = await loadingTask.promise;
          if (isCancelled) return;
          setPdfDoc(loadedDoc);
          setNumPages(loadedDoc.numPages);
          setCurrentPage(1);
          setIsLoading(false);
        } else {
          // On native devices, react-native-pdf onLoadComplete supplies numPages
          setCurrentPage(1);
          setIsLoading(false);
        }
      } catch (err: any) {
        if (isCancelled) return;
        console.error("Error loading PDF:", err);
        setLoadError(err?.message || "Failed to parse PDF file");
        setIsLoading(false);
        onShowToast("Could not load PDF: " + (err?.message || "Error"));
      }
    }

    loadPdf();

    return () => {
      isCancelled = true;
      if (currentRenderTask.current) {
        currentRenderTask.current.cancel();
      }
    };
  }, [activeId]);

  // 2. Generate Thumbnails Lazily (ONLY when user actually opens thumbnail panel)
  useEffect(() => {
    if (!pdfDoc || numPages === 0 || !showThumbnails) return;

    let isMounted = true;

    async function generateAllThumbnails() {
      const generated: Record<number, string> = {};
      // Generate up to 20 thumbnails
      const maxThumbPages = Math.min(numPages, 20);
      for (let i = 1; i <= maxThumbPages; i++) {
        try {
          if (Platform.OS === "web" && typeof document !== "undefined") {
            const page = await pdfDoc.getPage(i);
            const thumbViewport = page.getViewport({ scale: 0.22, rotation });
            const thumbCanvas = document.createElement("canvas");
            thumbCanvas.width = Math.floor(thumbViewport.width);
            thumbCanvas.height = Math.floor(thumbViewport.height);
            const ctx = thumbCanvas.getContext("2d");
            if (ctx) {
              await page.render({ canvasContext: ctx, viewport: thumbViewport })
                .promise;
              if (!isMounted) return;
              generated[i] = thumbCanvas.toDataURL();
            }
          }
        } catch {
          // ignore individual thumb fail
        }
      }
      if (isMounted) {
        setThumbnails(generated);
      }
    }

    generateAllThumbnails();

    return () => {
      isMounted = false;
    };
  }, [pdfDoc, numPages, rotation, showThumbnails]);

  // 3. Extract Text Content when Reflow mode is active or page changes
  useEffect(() => {
    if (!pdfDoc || !reflow) return;

    let isMounted = true;
    async function extractText() {
      try {
        const page = await pdfDoc.getPage(currentPage);
        const textContent = await page.getTextContent();
        const items = textContent.items;

        let lastY: number | null = null;
        const paragraphs: string[] = [];
        let curPara = "";

        for (const item of items) {
          const str = (item.str || "").trim();
          if (!str) continue;

          const y = item.transform ? Math.round(item.transform[5]) : null;
          // If vertical jump is noticeable, start a new paragraph
          if (lastY !== null && y !== null && Math.abs(lastY - y) > 16) {
            if (curPara) {
              paragraphs.push(curPara.trim());
              curPara = "";
            }
          }
          curPara += (curPara ? " " : "") + str;
          lastY = y;
        }
        if (curPara) {
          paragraphs.push(curPara.trim());
        }

        const fullString = textContent.items
          .map((item: any) => item.str || "")
          .join(" ")
          .replace(/\s+/g, " ");

        if (isMounted) {
          setReflowText(
            fullString || "No selectable text layer found on this page.",
          );
          setReflowParagraphs(
            paragraphs.length > 0
              ? paragraphs
              : fullString
                ? [fullString]
                : ["No selectable text layer found on this page."],
          );
        }
      } catch (err) {
        if (isMounted) {
          setReflowText("Unable to extract text from this page.");
          setReflowParagraphs(["Unable to extract text from this page."]);
        }
      }
    }

    extractText();
    return () => {
      isMounted = false;
    };
  }, [pdfDoc, currentPage, reflow]);

  // Keyboard navigation based on reading direction
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if (readingDirection === "horizontal") {
        if (e.key === "ArrowRight" || e.key === "PageDown") {
          if (currentPage < numPages) {
            setCurrentPage((p) => Math.min(numPages, p + 1));
          }
        } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
          if (currentPage > 1) {
            setCurrentPage((p) => Math.max(1, p - 1));
          }
        }
      } else {
        if (e.key === "ArrowDown" || e.key === "PageDown") {
          if (currentPage < numPages) {
            setCurrentPage((p) => Math.min(numPages, p + 1));
          }
        } else if (e.key === "ArrowUp" || e.key === "PageUp") {
          if (currentPage > 1) {
            setCurrentPage((p) => Math.max(1, p - 1));
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentPage, numPages, readingDirection]);

  // 4. Synchronize drawing overlay canvas size with PDF page viewport
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const canvas = canvasRef.current;
    const drawCanvas = drawCanvasRef.current;
    if (canvas && drawCanvas) {
      drawCanvas.width = canvas.width;
      drawCanvas.height = canvas.height;
      drawCanvas.style.width = canvas.style.width;
      drawCanvas.style.height = canvas.style.height;
    }
  }, [currentPage, zoom, rotation]);

  // 5. Render Continuous Scroll Pages
  useEffect(() => {
    if (!pdfDoc || viewMode !== "continuous") return;

    let isMounted = true;
    async function renderAllContinuousPages() {
      for (let p = 1; p <= numPages; p++) {
        const c = continuousCanvases.current.get(p);
        if (!c) continue;

        try {
          const page = await pdfDoc.getPage(p);
          const viewport = page.getViewport({ scale: zoom * 0.9, rotation });
          const pixelRatio =
            (typeof window !== "undefined" && window.devicePixelRatio) || 1;

          c.width = Math.floor(viewport.width * pixelRatio);
          c.height = Math.floor(viewport.height * pixelRatio);
          c.style.width = `${Math.floor(viewport.width)}px`;
          c.style.height = `${Math.floor(viewport.height)}px`;

          const ctx = c.getContext("2d");
          if (ctx) {
            ctx.save();
            ctx.scale(pixelRatio, pixelRatio);
            await page.render({ canvasContext: ctx, viewport }).promise;
          }
        } catch {
          // ignore individual continuous render cancel
        }
      }
    }

    renderAllContinuousPages();
    return () => {
      isMounted = false;
    };
  }, [pdfDoc, viewMode, zoom, rotation, numPages]);

  // 6. Navigation Handlers
  const handlePrevPage = () => {
    if (currentPage > 1) {
      const next = currentPage - 1;
      setCurrentPage(next);
      canvasRef.current?.setPage?.(next);
      onShowToast(`Page ${next} of ${numPages}`);
    }
  };

  const handleNextPage = () => {
    if (currentPage < numPages) {
      const next = currentPage + 1;
      setCurrentPage(next);
      canvasRef.current?.setPage?.(next);
      onShowToast(`Page ${next} of ${numPages}`);
    }
  };

  const handleSelectPage = (pageNum: number) => {
    const target = Math.max(1, Math.min(numPages, pageNum));
    setCurrentPage(target);
    canvasRef.current?.setPage?.(target);
    setShowPagePicker(false);
    onShowToast(`Jumped to Page ${target}`);
  };

  // Sync current page smoothly when viewMode switches between single and continuous
  useEffect(() => {
    canvasRef.current?.setPage?.(currentPage);
  }, [viewMode]);

  // 7. Zoom Handlers
  const handleZoomIn = () => {
    setZoom((prev) => {
      const next = Math.min(2.5, +(prev + 0.2).toFixed(1));
      onShowToast(`Zoom: ${Math.round(next * 100)}%`);
      return next;
    });
  };

  const handleZoomOut = () => {
    setZoom((prev) => {
      const next = Math.max(0.6, +(prev - 0.2).toFixed(1));
      onShowToast(`Zoom: ${Math.round(next * 100)}%`);
      return next;
    });
  };

  const handleFitWidth = () => {
    setZoom(1.0);
    onShowToast("Zoom reset to 100% (Fit Width)");
  };

  const handleRotate = () => {
    setRotation((prev) => {
      const next = (prev + 90) % 360;
      onShowToast(`Rotated ${next}°`);
      return next;
    });
  };

  // 8. Search Functionality
  const handleExecuteSearch = async () => {
    if (!pdfDoc || !searchQuery.trim()) return;

    setIsSearching(true);
    const q = searchQuery.toLowerCase().trim();
    const matches: SearchMatch[] = [];

    try {
      for (let p = 1; p <= numPages; p++) {
        const page = await pdfDoc.getPage(p);
        const content = await page.getTextContent();
        const text = content.items.map((i: any) => i.str || "").join(" ");
        if (text.toLowerCase().includes(q)) {
          const idx = text.toLowerCase().indexOf(q);
          const start = Math.max(0, idx - 25);
          const end = Math.min(text.length, idx + q.length + 35);
          const snippet = `...${text.substring(start, end).trim()}...`;
          matches.push({ page: p, snippet });
        }
      }

      setSearchResults(matches);
      setSearchIndex(0);
      setIsSearching(false);

      if (matches.length > 0) {
        setCurrentPage(matches[0].page);
        onShowToast(
          `Found ${matches.length} matches. Showing match 1 on Page ${matches[0].page}`,
        );
      } else {
        onShowToast(`No matches found for "${searchQuery}"`);
      }
    } catch (err) {
      setIsSearching(false);
      onShowToast("Search error occurred");
    }
  };

  const handleNextSearchMatch = () => {
    if (searchResults.length === 0) return;
    const nextIdx = (searchIndex + 1) % searchResults.length;
    setSearchIndex(nextIdx);
    setCurrentPage(searchResults[nextIdx].page);
    onShowToast(
      `Match ${nextIdx + 1} of ${searchResults.length} (Page ${searchResults[nextIdx].page})`,
    );
  };

  const handlePrevSearchMatch = () => {
    if (searchResults.length === 0) return;
    const prevIdx =
      (searchIndex - 1 + searchResults.length) % searchResults.length;
    setSearchIndex(prevIdx);
    setCurrentPage(searchResults[prevIdx].page);
    onShowToast(
      `Match ${prevIdx + 1} of ${searchResults.length} (Page ${searchResults[prevIdx].page})`,
    );
  };

  // 9. Open Another PDF from Native Device Storage or Web
  const handlePickAnotherPdf = async () => {
    try {
      const picked = await pickPdfFromDevice();
      if (!picked) return;

      onShowToast(`Opening ${picked.name}...`);
      const newDoc = pdfStore.addUploadedPdf(
        { name: picked.name, size: picked.size },
        picked.buffer,
      );
      setActiveId(newDoc.id);
      setActiveTitle(newDoc.name);
      setLoadError(null);
      onShowToast(`Opened ${picked.name}`);
    } catch (err: any) {
      onShowToast("Error loading PDF: " + (err?.message || "Failed"));
    }
  };

  // 10. Open in Native System Viewer (Apple QuickLook / Android System PDF Reader)
  const handleOpenSystemViewer = async () => {
    if (!pdfBytes) {
      onShowToast("PDF data not ready");
      return;
    }
    onShowToast("Opening in system viewer...");
    const ok = await openInNativeSystemViewer(pdfBytes, activeTitle);
    if (!ok && Platform.OS === "web") {
      onShowToast("Opened PDF in new browser tab");
    }
  };

  // 11. Download Current PDF
  const handleDownload = () => {
    if (!pdfBytes) {
      onShowToast("PDF data not ready");
      return;
    }
    pdfStore.downloadPdf(pdfBytes, activeTitle);
    onShowToast(`Downloaded ${activeTitle}`);
  };

  // 11. Annotation & Stamping Handlers
  const handleCanvasClick = (e: any) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const pctX = Math.round((clickX / rect.width) * 100);
    const pctY = Math.round((clickY / rect.height) * 100);

    if (activeTool === "note") {
      const noteId = `note-${Date.now()}`;
      const newNote: NoteAnnotation = {
        id: noteId,
        page: currentPage,
        x: pctX,
        y: pctY,
        text: "Add your note here...",
        author: "Reviewer",
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setNotes((prev) => [...prev, newNote]);
      setActiveNoteEditing(noteId);
      setNewNoteInput(newNote.text);
      onShowToast(`Sticky Note placed on Page ${currentPage}`);
    } else if (activeTool === "signature") {
      const stampId = `stamp-${Date.now()}`;
      const newStamp: StampAnnotation = {
        id: stampId,
        page: currentPage,
        x: pctX,
        y: pctY,
        title: "VERIFIED & CERTIFIED",
        time: new Date().toLocaleDateString(),
      };
      setStamps((prev) => [...prev, newStamp]);
      onShowToast(`Signature seal stamped on Page ${currentPage}`);
    }
  };

  // Freehand drawing support
  const isDrawing = useRef<boolean>(false);
  const startDrawing = (e: any) => {
    if (activeTool !== "pen" && activeTool !== "highlighter") return;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    isDrawing.current = true;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = activeTool === "highlighter" ? 14 : 3;
    ctx.lineCap = "round";
    ctx.strokeStyle =
      activeTool === "highlighter" ? "rgba(255, 235, 59, 0.45)" : "#2563eb";
  };

  const drawMove = (e: any) => {
    if (
      !isDrawing.current ||
      (activeTool !== "pen" && activeTool !== "highlighter")
    )
      return;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawing.current = false;
  };

  const clearCurrentMarkups = () => {
    const canvas = drawCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setNotes((prev) => prev.filter((n) => n.page !== currentPage));
    setStamps((prev) => prev.filter((s) => s.page !== currentPage));
    onShowToast(`Markups cleared for Page ${currentPage}`);
  };

  // Color & Theme Styling (PDF page seamlessly fills the screen)
  const getThemeColors = () => {
    if (theme === "light") {
      return {
        bg: "#ffffff",
        paperBg: "#ffffff",
        text: "#0f172a",
        muted: "#64748b",
        border: "transparent",
        canvasFilter: "none",
      };
    }
    if (theme === "night") {
      return {
        bg: "#080d1a",
        paperBg: "#080d1a",
        text: "#dae2fd",
        muted: "#908fa0",
        border: "transparent",
        canvasFilter: "invert(0.92) hue-rotate(180deg) brightness(0.95)",
      };
    }
    // Sepia
    return {
      bg: "#fdfbf7",
      paperBg: "#fdfbf7",
      text: "#1a1c1e",
      muted: "#8c887e",
      border: "transparent",
      canvasFilter: "sepia(0.35) contrast(0.95) brightness(0.96)",
    };
  };

  const t = getThemeColors();

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      {/* Main Document Content (Fixed layout that never resizes or causes page refresh/blink) */}
      <ScrollView
        style={[styles.mainScrollView, { backgroundColor: t.paperBg }]}
        contentContainerStyle={[
          styles.mainScrollContent,
          !reflow && styles.mainScrollContentPdf,
        ]}
        scrollEnabled={
          reflow || (Platform.OS === "web" && viewMode === "continuous")
        }
        onScroll={triggerPageInteraction}
        scrollEventThrottle={16}
      >
        {/* Loading State */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#7bd0ff" />
            <Text style={styles.loadingTitle}>Opening PDF Engine...</Text>
            <Text style={styles.loadingSubtitle}>{activeTitle}</Text>
          </View>
        )}

        {/* Load Error State */}
        {loadError && !isLoading && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={48} color="#ff516a" />
            <Text style={styles.errorTitle}>Unable to read this PDF</Text>
            <Text style={styles.errorSubtitle}>{loadError}</Text>
            <TouchableOpacity
              onPress={handlePickAnotherPdf}
              style={styles.retryBtn}
              activeOpacity={0.8}
            >
              <Ionicons
                name="folder-open-outline"
                size={16}
                color="#ffffff"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.retryBtnText}>
                Choose Another PDF from Device
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 1. REFLOW / PURE TEXT READER MODE */}
        {!isLoading && !loadError && reflow && (
          <View
            style={[
              styles.reflowContainer,
              { backgroundColor: t.paperBg, borderColor: t.border },
            ]}
          >
            <View style={styles.reflowHeader}>
              <View style={styles.reflowPageBadge}>
                <Ionicons name="document-text" size={13} color="#0284c7" />
                <Text style={styles.reflowPageBadgeText}>
                  REFLOW • PAGE {currentPage} OF {numPages}
                </Text>
              </View>
              <View style={styles.reflowControls}>
                <TouchableOpacity
                  onPress={() =>
                    handleUpdateFontSize(Math.max(12, reflowFontSize - 2))
                  }
                  style={styles.reflowBtn}
                  accessibilityLabel="Decrease Font Size"
                >
                  <Text style={styles.reflowBtnText}>A-</Text>
                </TouchableOpacity>

                <View style={styles.reflowFontSizeBadge}>
                  <Text style={styles.reflowFontSizeText}>
                    {reflowFontSize}px
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() =>
                    handleUpdateFontSize(Math.min(32, reflowFontSize + 2))
                  }
                  style={styles.reflowBtn}
                  accessibilityLabel="Increase Font Size"
                >
                  <Text style={styles.reflowBtnText}>A+</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setShowViewModeModal(true)}
                  style={styles.reflowOptionsBtn}
                  accessibilityLabel="View Mode Options"
                >
                  <MaterialIcons name="tune" size={14} color="#7bd0ff" />
                  <Text style={styles.reflowOptionsBtnText}>Options</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.reflowParagraphsContainer}>
              {reflowParagraphs.map((para, idx) => (
                <Text
                  key={idx}
                  style={[
                    styles.reflowParagraph,
                    {
                      color: t.text,
                      fontSize: reflowFontSize,
                      lineHeight: Math.round(reflowFontSize * 1.68),
                    },
                  ]}
                >
                  {para}
                </Text>
              ))}
            </View>
          </View>
        )}

        {/* 2. REAL CANVAS / NATIVE PDF RENDERING */}
        {!isLoading &&
          !loadError &&
          !reflow &&
          (Platform.OS !== "web" || viewMode === "single") && (
            <View style={styles.pageOuterWrapper}>
              <View
                style={[
                  styles.pdfPaper,
                  {
                    backgroundColor: t.paperBg,
                    borderColor: "transparent",
                    width: zoom > 1 ? `${Math.round(zoom * 100)}%` : "100%",
                  },
                ]}
              >
                {/* Canvas viewport container */}
                <View
                  style={[
                    styles.canvasRelativeWrapper,
                    {
                      width: "100%",
                      filter: t.canvasFilter as any,
                    },
                  ]}
                  {...(Platform.OS === "web"
                    ? {
                        onClick: (e: any) => {
                          handleCanvasClick(e);
                          handleSingleTap();
                        },
                        onMouseDown: startDrawing,
                        onMouseMove: drawMove,
                        onMouseUp: stopDrawing,
                        onMouseLeave: stopDrawing,
                      }
                    : {})}
                >
                  {/* Visual PDF Document View: Using react-native-pdf Package */}
                  {pdfSource.uri ? (
                    <Pdf
                      ref={canvasRef as any}
                      source={pdfSource}
                      scale={zoom}
                      fitPolicy={0}
                      enablePaging={viewMode === "single"}
                      enableAntialiasing={true}
                      spacing={10}
                      horizontal={readingDirection === "horizontal"}
                      onPageSingleTap={handleSingleTap}
                      onScaleChanged={(scale) => {
                        setZoom(scale);
                        triggerPageInteraction();
                      }}
                      onLoadComplete={(loadedPages) => {
                        setNumPages(loadedPages);
                        setIsLoading(false);
                        triggerPageInteraction();
                      }}
                      onPageChanged={(page, total) => {
                        setCurrentPage((prev) => (prev !== page ? page : prev));
                        setNumPages((prev) => (prev !== total ? total : prev));
                        triggerPageInteraction();
                      }}
                      onError={(err) => {
                        console.warn("react-native-pdf view note:", err);
                      }}
                      style={styles.pdfViewer}
                    />
                  ) : (
                    <ActivityIndicator size="small" color="#7bd0ff" />
                  )}

                  {/* Freehand Drawing Overlay Canvas */}
                  {Platform.OS === "web" && (
                    <canvas
                      ref={drawCanvasRef}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        pointerEvents:
                          activeTool === "pen" || activeTool === "highlighter"
                            ? "auto"
                            : "none",
                        maxWidth: "100%",
                      }}
                    />
                  )}

                  {/* Notes and Stamps Overlays */}
                  {notes
                    .filter((n) => n.page === currentPage)
                    .map((note) => (
                      <View
                        key={note.id}
                        style={[
                          styles.notePin,
                          {
                            top: `${note.y}%` as any,
                            left: `${note.x}%` as any,
                          },
                        ]}
                      >
                        <TouchableOpacity
                          onPress={() => setActiveNoteEditing(note.id)}
                          style={styles.notePinIcon}
                        >
                          <Ionicons
                            name="chatbubble"
                            size={20}
                            color="#f59e0b"
                          />
                        </TouchableOpacity>
                        {activeNoteEditing === note.id && (
                          <View style={styles.noteEditorCard}>
                            <TextInput
                              value={newNoteInput}
                              onChangeText={setNewNoteInput}
                              style={styles.noteEditorInput}
                              multiline
                            />
                            <View style={styles.noteEditorActions}>
                              <TouchableOpacity
                                onPress={() => {
                                  setNotes((prev) =>
                                    prev.map((n) =>
                                      n.id === note.id
                                        ? { ...n, text: newNoteInput }
                                        : n,
                                    ),
                                  );
                                  setActiveNoteEditing(null);
                                  onShowToast("Note updated");
                                }}
                                style={styles.noteSaveBtn}
                              >
                                <Text style={styles.noteSaveBtnText}>Save</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => {
                                  setNotes((prev) =>
                                    prev.filter((n) => n.id !== note.id),
                                  );
                                  setActiveNoteEditing(null);
                                }}
                                style={styles.noteDeleteBtn}
                              >
                                <Text style={styles.noteDeleteBtnText}>
                                  Delete
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}
                      </View>
                    ))}

                  {stamps
                    .filter((s) => s.page === currentPage)
                    .map((stamp) => (
                      <View
                        key={stamp.id}
                        style={[
                          styles.stampOverlay,
                          {
                            top: `${stamp.y}%` as any,
                            left: `${stamp.x}%` as any,
                          },
                        ]}
                      >
                        <Ionicons
                          name="shield-checkmark"
                          size={16}
                          color="#059669"
                        />
                        <Text style={styles.stampOverlayTitle}>
                          {stamp.title}
                        </Text>
                        <Text style={styles.stampOverlayTime}>
                          {stamp.time}
                        </Text>
                      </View>
                    ))}
                </View>
              </View>
            </View>
          )}

        {/* 3. CONTINUOUS SCROLL VIEW (WEB ONLY) */}
        {!isLoading &&
          !loadError &&
          !reflow &&
          Platform.OS === "web" &&
          viewMode === "continuous" &&
          (readingDirection === "horizontal" ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={true}
              contentContainerStyle={styles.continuousContainerHorizontal}
              style={{ width: "100%" }}
            >
              {Array.from({ length: numPages }, (_, i) => i + 1).map((p) => (
                <View
                  key={p}
                  style={[
                    styles.continuousPageCardHorizontal,
                    {
                      backgroundColor: t.paperBg,
                      borderColor: t.border,
                    },
                  ]}
                >
                  <View style={styles.continuousPageHeader}>
                    <Text
                      style={[styles.continuousPageNum, { color: t.muted }]}
                    >
                      Page {p} of {numPages}
                    </Text>
                  </View>
                  <View
                    style={{
                      filter: t.canvasFilter as any,
                      alignItems: "center",
                    }}
                  >
                    {Platform.OS === "web" ? (
                      <canvas
                        ref={(el) => {
                          if (el) continuousCanvases.current.set(p, el);
                          else continuousCanvases.current.delete(p);
                        }}
                        style={{ display: "block", maxWidth: "100%" }}
                      />
                    ) : (
                      <View style={styles.nativePdfFallbackCard}>
                        <Ionicons
                          name="document-text"
                          size={32}
                          color="#7bd0ff"
                        />
                        <Text
                          style={[
                            styles.nativePdfFallbackSubtitle,
                            { color: t.text, fontWeight: "700" },
                          ]}
                        >
                          Page {p} of {numPages}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </ScrollView>
          ) : (
            <View
              ref={continuousContainerRef}
              style={styles.continuousContainer}
            >
              {Array.from({ length: numPages }, (_, i) => i + 1).map((p) => (
                <View
                  key={p}
                  style={[
                    styles.continuousPageCard,
                    {
                      backgroundColor: t.paperBg,
                      borderColor: t.border,
                    },
                  ]}
                >
                  <View style={styles.continuousPageHeader}>
                    <Text
                      style={[styles.continuousPageNum, { color: t.muted }]}
                    >
                      Page {p} of {numPages}
                    </Text>
                  </View>
                  <View
                    style={{
                      filter: t.canvasFilter as any,
                      alignItems: "center",
                    }}
                  >
                    {Platform.OS === "web" ? (
                      <canvas
                        ref={(el) => {
                          if (el) continuousCanvases.current.set(p, el);
                          else continuousCanvases.current.delete(p);
                        }}
                        style={{ display: "block", maxWidth: "100%" }}
                      />
                    ) : (
                      <View style={styles.nativePdfFallbackCard}>
                        <Ionicons
                          name="document-text"
                          size={32}
                          color="#7bd0ff"
                        />
                        <Text
                          style={[
                            styles.nativePdfFallbackSubtitle,
                            { color: t.text, fontWeight: "700" },
                          ]}
                        >
                          Page {p} of {numPages}
                        </Text>
                        <TouchableOpacity
                          style={styles.nativeContinuousBtn}
                          onPress={handleOpenSystemViewer}
                        >
                          <Ionicons
                            name="open-outline"
                            size={14}
                            color="#0d0096"
                          />
                          <Text style={styles.nativeContinuousBtnText}>
                            Open with System Viewer
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>
          ))}

        {/* Real Dynamic Thumbnail Strip */}
        {/* {showThumbnails && !isLoading && !loadError && (
          <View style={styles.thumbnailStrip}>
            <View style={styles.thumbStripHeader}>
              <Text style={styles.thumbStripTitle}>
                DOCUMENT PAGES ({numPages})
              </Text>
              <Text style={styles.thumbStripSubtitle}>Tap to jump to page</Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbScroll}
            >
              {Array.from({ length: numPages }, (_, idx) => idx + 1).map(
                (p) => {
                  const isCur = currentPage === p;
                  const thumbData = thumbnails[p];

                  return (
                    <TouchableOpacity
                      key={p}
                      onPress={() => handleSelectPage(p)}
                      style={[
                        styles.thumbCard,
                        isCur && styles.thumbCardActive,
                      ]}
                      activeOpacity={0.7}
                    >
                      <View style={styles.thumbImageWrap}>
                        {thumbData ? (
                          <Image
                            source={{ uri: thumbData }}
                            style={styles.thumbImage}
                            resizeMode="contain"
                          />
                        ) : (
                          <View style={styles.thumbPlaceholder}>
                            <ActivityIndicator size="small" color="#908fa0" />
                          </View>
                        )}
                      </View>
                      <Text
                        style={[
                          styles.thumbLabel,
                          isCur && styles.thumbLabelActive,
                        ]}
                      >
                        P. {p}
                      </Text>
                    </TouchableOpacity>
                  );
                },
              )}
            </ScrollView>
          </View>
        )} */}
      </ScrollView>

      {/* Top Header: Absolutely positioned overlay (ZERO layout shift / zero blinks on toggle) */}
      <Animated.View
        style={[
          styles.absoluteHeaderWrapper,
          {
            opacity: barsAnim,
            transform: [
              {
                translateY: barsAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-90, 0],
                }),
              },
            ],
          },
        ]}
        pointerEvents={showBars ? "auto" : "none"}
      >
        <Header
          title={activeTitle}
          onBack={onBack}
          onShowToast={onShowToast}
          onOpenFileFromDevice={handlePickAnotherPdf}
          onOpenSystemViewer={handleOpenSystemViewer}
        />
      </Animated.View>

      {/* Docked Bottom Bar: Absolutely positioned overlay (ZERO layout shift / zero blinks on toggle) */}
      <Animated.View
        style={[
          styles.absoluteBottomBarWrapper,
          {
            opacity: barsAnim,
            transform: [
              {
                translateY: barsAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [90, 0],
                }),
              },
            ],
          },
        ]}
        pointerEvents={showBars ? "auto" : "none"}
      >
        <View style={styles.dockedBottomBar}>
          <View style={styles.bottomBarInner}>
            <TouchableOpacity
              style={styles.viewModeBottomInner}
              onPress={() => setShowViewModeModal(true)}
              activeOpacity={0.7}
              accessibilityLabel="View Mode"
              accessibilityRole="button"
            >
              <MaterialIcons name="book" size={23} color="#fff" />
              <Text style={styles.viewModeBtnTitle}>View Mode</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.viewModeBottomInner}
              onPress={() => {
                onShowToast("Edit & annotation tools enabled");
              }}
              activeOpacity={0.7}
              accessibilityLabel="Edit"
              accessibilityRole="button"
            >
              <MaterialIcons name="edit" size={23} color="#fff" />
              <Text style={styles.viewModeBtnTitle}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.viewModeBottomInner}
              onPress={() => setShowViewModeModal(true)}
              activeOpacity={0.7}
              accessibilityLabel="Settings"
              accessibilityRole="button"
            >
              <MaterialIcons name="settings" size={23} color="#fff" />
              <Text style={styles.viewModeBtnTitle}>Settings</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      {/* Top Left Page Pill: Appears at top-left corner ONLY when user interacts with the page, auto-fades out */}
      <Animated.View
        style={[
          styles.topLeftPagePillContainer,
          {
            opacity: pillOpacity,
            top: !showBars
              ? Platform.OS === "ios"
                ? 52
                : 20
              : Platform.OS === "ios"
                ? 104
                : 74,
          },
        ]}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          onPress={() => {
            setShowBars((prev) => !prev);
            triggerPageInteraction();
          }}
          activeOpacity={0.8}
          style={styles.topLeftPagePill}
          accessibilityLabel={`Page ${currentPage} of ${numPages || 1}`}
        >
          <Text style={styles.topLeftPagePillText}>
            {currentPage}
            <Text style={styles.topLeftPagePillTotal}> / {numPages || 1}</Text>
          </Text>
        </TouchableOpacity>
      </Animated.View>

      {/* View Mode Modal Component */}
      <ViewModeModal
        visible={showViewModeModal}
        onClose={() => setShowViewModeModal(false)}
        viewMode={viewMode}
        onChangeViewMode={handleUpdateViewMode}
        reflow={reflow}
        onToggleReflow={handleUpdateReflow}
        reflowFontSize={reflowFontSize}
        onChangeFontSize={handleUpdateFontSize}
        theme={theme}
        onChangeTheme={handleUpdateTheme}
        readingDirection={readingDirection}
        onChangeReadingDirection={handleUpdateReadingDirection}
        onShowToast={onShowToast}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b1326",
  },
  toolbarWrapper: {
    backgroundColor: "rgba(11, 19, 38, 0.95)",
    borderBottomWidth: 1,
    borderBottomColor: "#2d3449",
    paddingHorizontal: 12,
    paddingVertical: 8,
    zIndex: 40,
  },
  controlPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  pagePickerContainer: {
    position: "relative",
  },
  pagePickerTrigger: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#171f33",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2d3449",
    gap: 6,
  },
  pagePickerText: {
    color: "#dae2fd",
    fontSize: 13,
    fontWeight: "700",
  },
  pageTotalText: {
    color: "#908fa0",
    fontSize: 12,
    fontWeight: "400",
  },
  pageDropdown: {
    position: "absolute",
    top: 40,
    left: 0,
    width: 200,
    backgroundColor: "#171f33",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2d3449",
    padding: 10,
    zIndex: 100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  pageDropdownTitle: {
    color: "#908fa0",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 8,
  },
  pageDropdownScroll: {
    maxHeight: 180,
  },
  pageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  pageGridItem: {
    width: 38,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    backgroundColor: "#0b1326",
  },
  pageGridItemActive: {
    backgroundColor: "#c0c1ff",
  },
  pageGridText: {
    color: "#dae2fd",
    fontSize: 12,
    fontWeight: "600",
  },
  pageGridTextActive: {
    color: "#0d0096",
    fontWeight: "700",
  },
  themeSelector: {
    flexDirection: "row",
    backgroundColor: "#171f33",
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: "#2d3449",
  },
  themeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  themeBtnActive: {
    backgroundColor: "#2d3449",
  },
  quickActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#171f33",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#2d3449",
  },
  actionBtnActive: {
    backgroundColor: "#c0c1ff",
    borderColor: "#c0c1ff",
  },
  zoomLabelBtn: {
    paddingHorizontal: 6,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#171f33",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2d3449",
  },
  zoomLabelText: {
    color: "#dae2fd",
    fontSize: 11,
    fontWeight: "600",
  },
  openAnotherBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#142738",
    borderColor: "rgba(123, 208, 255, 0.4)",
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  openAnotherText: {
    color: "#7bd0ff",
    fontSize: 11,
    fontWeight: "600",
  },
  searchDrawer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#171f33",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2d3449",
    marginTop: 8,
    paddingHorizontal: 10,
    height: 38,
    gap: 8,
  },
  searchDrawerInput: {
    flex: 1,
    color: "#dae2fd",
    fontSize: 13,
    paddingVertical: 0,
    outlineStyle: "none" as any,
  },
  searchFindBtn: {
    backgroundColor: "#2d3449",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  searchFindText: {
    color: "#dae2fd",
    fontSize: 11,
    fontWeight: "600",
  },
  searchNavRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  searchCountText: {
    color: "#7bd0ff",
    fontSize: 11,
    fontWeight: "600",
  },
  searchArrowBtn: {
    padding: 2,
  },
  searchCloseBtn: {
    padding: 2,
  },
  annotationBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(45, 52, 73, 0.4)",
    marginTop: 6,
    overflow: "scroll" as any,
  },
  toolBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#171f33",
    borderWidth: 1,
    borderColor: "#2d3449",
  },
  toolBtnActive: {
    backgroundColor: "#c0c1ff",
    borderColor: "#c0c1ff",
  },
  toolBtnText: {
    fontSize: 11,
    color: "#c7c4d7",
    fontWeight: "500",
  },
  toolBtnTextActive: {
    color: "#0d0096",
    fontWeight: "700",
  },
  mainScrollView: {
    flex: 1,
  },
  mainScrollContent: {
    padding: 16,
    alignItems: "center",
    paddingBottom: 64,
  },
  mainScrollContentPdf: {
    padding: 0,
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
    alignItems: "stretch",
    width: "100%",
    flexGrow: 1,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: "center",
    gap: 12,
  },
  loadingTitle: {
    color: "#dae2fd",
    fontSize: 16,
    fontWeight: "600",
  },
  loadingSubtitle: {
    color: "#908fa0",
    fontSize: 13,
  },
  errorContainer: {
    paddingVertical: 40,
    alignItems: "center",
    gap: 10,
    maxWidth: 360,
  },
  errorTitle: {
    color: "#ffb2b7",
    fontSize: 16,
    fontWeight: "700",
  },
  errorSubtitle: {
    color: "#908fa0",
    fontSize: 13,
    textAlign: "center",
  },
  retryBtn: {
    backgroundColor: "#171f33",
    borderWidth: 1,
    borderColor: "#2d3449",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  retryBtnText: {
    color: "#7bd0ff",
    fontSize: 13,
    fontWeight: "600",
  },
  reflowContainer: {
    width: "100%",
    maxWidth: 680,
    borderRadius: 12,
    borderWidth: 1,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  reflowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(144, 143, 160, 0.2)",
    paddingBottom: 10,
  },
  reflowPageBadge: {
    backgroundColor: "rgba(123, 208, 255, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  reflowPageBadgeText: {
    color: "#0284c7",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  reflowControls: {
    flexDirection: "row",
    gap: 8,
  },
  reflowBtn: {
    backgroundColor: "rgba(144, 143, 160, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  reflowBtnText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "700",
  },
  reflowBodyText: {
    lineHeight: 28,
    letterSpacing: 0.2,
  },
  pageOuterWrapper: {
    alignItems: "center",
    width: "100%",
    flex: 1,
    minHeight:
      Platform.OS !== "web" ? Dimensions.get("window").height - 140 : undefined,
  },
  pdfPaper: {
    width: "100%",
    flex: 1,
    overflow: "hidden",
    alignItems: "center",
    minHeight:
      Platform.OS !== "web" ? Dimensions.get("window").height - 140 : undefined,
  },
  canvasRelativeWrapper: {
    width: "100%",
    flex: 1,
    position: "relative",
    cursor: "crosshair" as any,
    alignItems: "center",
    minHeight:
      Platform.OS !== "web" ? Dimensions.get("window").height - 140 : undefined,
  },
  paperFooter: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  paperFooterText: {
    fontSize: 10,
  },
  bottomNavStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    maxWidth: 580,
    marginTop: 16,
    backgroundColor: "#0b1326",
    borderWidth: 1,
    borderColor: "#2d3449",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  bottomNavBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#171f33",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  bottomNavBtnDisabled: {
    opacity: 0.4,
  },
  bottomNavText: {
    color: "#dae2fd",
    fontSize: 12,
    fontWeight: "600",
  },
  bottomNavTextDisabled: {
    color: "#6b7280",
  },
  bottomNavPageLabel: {
    color: "#dae2fd",
    fontSize: 13,
  },
  continuousContainer: {
    width: "100%",
    maxWidth: 680,
    gap: 20,
    alignItems: "center",
  },
  continuousPageCard: {
    borderRadius: 6,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  continuousPageHeader: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
  },
  continuousPageNum: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  notePin: {
    position: "absolute",
    transform: [{ translateX: -12 }, { translateY: -12 }],
    zIndex: 30,
  },
  notePinIcon: {
    padding: 2,
  },
  noteEditorCard: {
    position: "absolute",
    top: 24,
    left: -80,
    width: 180,
    backgroundColor: "#1e293b",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#475569",
    padding: 8,
    zIndex: 50,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
  },
  noteEditorInput: {
    color: "#ffffff",
    fontSize: 12,
    minHeight: 48,
    outlineStyle: "none" as any,
  },
  noteEditorActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 6,
    marginTop: 6,
  },
  noteSaveBtn: {
    backgroundColor: "#0284c7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  noteSaveBtnText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "600",
  },
  noteDeleteBtn: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  noteDeleteBtnText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "600",
  },
  stampOverlay: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "#059669",
    borderRadius: 6,
    padding: 6,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    alignItems: "center",
    gap: 2,
    transform: [{ rotate: "-8deg" }],
    zIndex: 25,
  },
  stampOverlayTitle: {
    color: "#059669",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  stampOverlayTime: {
    color: "#065f46",
    fontSize: 8,
    fontWeight: "600",
  },
  thumbnailStrip: {
    width: "100%",
    maxWidth: 680,
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#2d3449",
  },
  thumbStripHeader: {
    marginBottom: 10,
  },
  thumbStripTitle: {
    color: "#908fa0",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  thumbStripSubtitle: {
    color: "#64748b",
    fontSize: 10,
    marginTop: 2,
  },
  thumbScroll: {
    gap: 10,
    paddingBottom: 8,
  },
  thumbCard: {
    width: 72,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#2d3449",
    backgroundColor: "#171f33",
    padding: 4,
    alignItems: "center",
  },
  thumbCardActive: {
    borderColor: "#7bd0ff",
    backgroundColor: "#1f2e4d",
  },
  thumbImageWrap: {
    width: 62,
    height: 84,
    backgroundColor: "#ffffff",
    borderRadius: 4,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  thumbLabel: {
    color: "#908fa0",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 4,
  },
  thumbLabelActive: {
    color: "#7bd0ff",
    fontWeight: "700",
  },
  actionBtnHighlight: {
    backgroundColor: "rgba(123, 208, 255, 0.12)",
    borderColor: "#7bd0ff",
  },
  reflowFontSizeBadge: {
    backgroundColor: "#171f33",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#2d3449",
    justifyContent: "center",
    alignItems: "center",
  },
  reflowFontSizeText: {
    color: "#7bd0ff",
    fontSize: 11,
    fontWeight: "700",
  },
  reflowOptionsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(123, 208, 255, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(123, 208, 255, 0.3)",
    marginLeft: 4,
  },
  reflowOptionsBtnText: {
    color: "#7bd0ff",
    fontSize: 11,
    fontWeight: "700",
  },
  reflowParagraphsContainer: {
    gap: 16,
  },
  reflowParagraph: {
    letterSpacing: 0.2,
    textAlign: "left",
  },
  floatingSideBtn: {
    position: "absolute",
    top: "40%",
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    borderWidth: 1,
    borderColor: "#334155",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 60,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingSideLeft: {
    left: 8,
  },
  floatingSideRight: {
    right: 8,
  },
  floatingSideDisabled: {
    opacity: 0.25,
  },
  continuousContainerHorizontal: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 16,
    alignItems: "center",
  },
  continuousPageCardHorizontal: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  dockedBottomBar: {
    backgroundColor: "#0b1326",
    borderTopWidth: 1,
    borderTopColor: "#222f4c",
    paddingHorizontal: 16,
    paddingVertical: 10,
    zIndex: 90,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 16,
  },
  bottomBarInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    maxWidth: 900,
    alignSelf: "center",
    width: "100%",
    paddingHorizontal: 16,
  },
  dockPageNavGroup: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#131b2e",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#263554",
    padding: 3,
    gap: 2,
  },
  dockNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 7,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  dockBtnDisabled: {
    opacity: 0.3,
  },
  dockPagePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  dockPagePillText: {
    color: "#7bd0ff",
    fontSize: 12,
    fontWeight: "700",
  },
  dockPageTotalText: {
    color: "#908fa0",
    fontSize: 11,
    fontWeight: "500",
  },
  viewModeBottomBtn: {
    flex: 1,
    maxWidth: 320,
    backgroundColor: "#7bd0ff",
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 12,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#7bd0ff",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  viewModeBottomInner: {
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
  },
  viewModeBtnTitle: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  viewModePillMini: {
    backgroundColor: "rgba(13, 0, 150, 0.12)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  viewModePillMiniText: {
    color: "#0d0096",
    fontSize: 10,
    fontWeight: "700",
  },
  dockRightGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dockUtilityBtn: {
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#131b2e",
    borderWidth: 1,
    borderColor: "#263554",
    justifyContent: "center",
    alignItems: "center",
  },
  dockUtilityBtnActive: {
    backgroundColor: "rgba(123, 208, 255, 0.15)",
    borderColor: "#7bd0ff",
  },
  dockUtilityText: {
    color: "#c7c4d7",
    fontSize: 11,
    fontWeight: "700",
  },
  thumbImage: {
    width: "100%",
    height: "100%",
  },
  nativePdfFallbackCard: {
    paddingVertical: 48,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  nativePdfFallbackTitle: {
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  nativePdfFallbackSubtitle: {
    fontSize: 12,
    textAlign: "center",
  },
  nativeDocPage: {
    width: 580,
    maxWidth: "100%",
    minHeight: 680,
    borderRadius: 4,
    borderWidth: 1,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  nativeDocPageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(144, 143, 160, 0.2)",
    paddingBottom: 12,
    marginBottom: 18,
  },
  nativeDocHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  nativeDocHeaderTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  nativeDocBadge: {
    backgroundColor: "rgba(123, 208, 255, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  nativeDocBadgeText: {
    color: "#7bd0ff",
    fontSize: 10,
    fontWeight: "800",
  },
  nativeDocBody: {
    flex: 1,
    gap: 14,
  },
  nativeDocHeading: {
    fontWeight: "800",
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  nativeDocParagraph: {
    fontWeight: "400",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "justify",
  },
  nativeDocEmpty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },
  nativeDocFooter: {
    marginTop: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(144, 143, 160, 0.2)",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  nativeDocFooterText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  nativeContinuousBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#7bd0ff",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    marginTop: 8,
  },
  nativeContinuousBtnText: {
    color: "#0d0096",
    fontSize: 12,
    fontWeight: "700",
  },
  pdfViewer: {
    width: "100%",
    height: "100%",
    maxWidth: "100%",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  absoluteHeaderWrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
  },
  absoluteBottomBarWrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 50,
  },
  topLeftPagePillContainer: {
    position: "absolute",
    left: 16,
    zIndex: 60,
  },
  topLeftPagePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(11, 19, 38, 0.88)",
    borderWidth: 1,
    borderColor: "rgba(123, 208, 255, 0.35)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  topLeftPagePillText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  topLeftPagePillTotal: {
    color: "#908fa0",
    fontSize: 11,
    fontWeight: "500",
  },
});
