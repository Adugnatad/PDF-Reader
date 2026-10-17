import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  Animated,
  Platform,
} from "react-native";
import { ReaderTheme } from "../types";

interface PdfSideScrubberProps {
  currentPage: number;
  numPages: number;
  onPageChange: (page: number) => void;
  topOffset?: number;
  bottomOffset?: number;
  theme?: ReaderTheme;
  thumbnails?: Record<number, string>;
  visible?: boolean;
  docTitle?: string;
}

const PILL_WIDTH = 50;
const PILL_HEIGHT = 48;

export const PdfSideScrubber: React.FC<PdfSideScrubberProps> = ({
  currentPage,
  numPages,
  onPageChange,
  topOffset = 74,
  bottomOffset = 84,
  theme = "light",
  visible = true,
}) => {
  const [trackHeight, setTrackHeight] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const isDraggingRef = useRef<boolean>(false);
  const [scrubPage, setScrubPage] = useState<number>(currentPage);

  // Animated values for 60 FPS continuous transitions
  const thumbY = useRef(new Animated.Value(0)).current;
  const currentThumbYRef = useRef<number>(0);
  const widgetScale = useRef(new Animated.Value(1)).current;
  const widgetOpacity = useRef(new Animated.Value(0.92)).current;
  const lastHapticPageRef = useRef<number>(currentPage);
  const trackRef = useRef<any>(null);

  // Keep ref synchronized with thumb animated value
  useEffect(() => {
    const listenerId = thumbY.addListener(({ value }) => {
      currentThumbYRef.current = value;
    });
    return () => {
      thumbY.removeListener(listenerId);
    };
  }, [thumbY]);

  // Usable travel distance along the vertical side rail
  const availableTravel = useMemo(() => {
    return Math.max(1, trackHeight - PILL_HEIGHT);
  }, [trackHeight]);

  // Synchronize scrubber position when currentPage changes externally (scrolling, taps, keyboard)
  useEffect(() => {
    if (isDraggingRef.current || trackHeight <= 0 || numPages <= 1) return;

    const progress = Math.max(
      0,
      Math.min(1, (currentPage - 1) / (numPages - 1)),
    );
    const targetY = progress * availableTravel;

    Animated.spring(thumbY, {
      toValue: targetY,
      tension: 130,
      friction: 14,
      useNativeDriver: Platform.OS !== "web",
    }).start();

    setScrubPage(currentPage);
  }, [currentPage, numPages, availableTravel, trackHeight]);

  // Gentle haptic feedback on page change during scrubbing
  const triggerHaptic = useCallback((newPage: number) => {
    if (newPage !== lastHapticPageRef.current) {
      lastHapticPageRef.current = newPage;
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate(8);
        } catch {
          // ignore
        }
      }
    }
  }, []);

  const animateActiveState = useCallback(
    (active: boolean) => {
      Animated.parallel([
        Animated.spring(widgetScale, {
          toValue: active ? 1.08 : 1,
          tension: 220,
          friction: 14,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(widgetOpacity, {
          toValue: active ? 1 : 0.92,
          duration: 100,
          useNativeDriver: Platform.OS !== "web",
        }),
      ]).start();
    },
    [widgetScale, widgetOpacity],
  );

  // Throttled page scrubbing update for smooth real-time rendering
  const scrubThrottleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPageRef = useRef<number>(currentPage);

  const applyPageScrub = useCallback(
    (targetPage: number) => {
      pendingPageRef.current = targetPage;
      setScrubPage(targetPage);
      triggerHaptic(targetPage);

      if (!scrubThrottleTimer.current) {
        scrubThrottleTimer.current = setTimeout(() => {
          scrubThrottleTimer.current = null;
          onPageChange(pendingPageRef.current);
        }, 100); // Smooth non-blocking document updates
      }
    },
    [onPageChange, triggerHaptic],
  );

  // PanResponder for native gestures: ATTACHED ONLY TO THE PILL
  const panStartOffset = useRef<number>(0);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => numPages > 1,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          numPages > 1 && Math.abs(gestureState.dy) > 2,
        onMoveShouldSetPanResponderCapture: () => false,

        onPanResponderGrant: () => {
          if (numPages <= 1) return;
          setIsDragging(true);
          isDraggingRef.current = true;
          animateActiveState(true);

          // Drag starts from current thumb position without jumping
          panStartOffset.current = currentThumbYRef.current;
        },

        onPanResponderMove: (_, gestureState) => {
          if (!isDraggingRef.current || numPages <= 1 || availableTravel <= 0) return;

          // Continuous thumb movement following the finger exactly
          const nextY = Math.max(
            0,
            Math.min(availableTravel, panStartOffset.current + gestureState.dy),
          );

          thumbY.setValue(nextY);
          currentThumbYRef.current = nextY;

          const progress = nextY / availableTravel;
          const calculatedPage = Math.round(progress * (numPages - 1)) + 1;
          const page = Math.max(1, Math.min(numPages, calculatedPage));

          applyPageScrub(page);
        },

        onPanResponderRelease: () => {
          setIsDragging(false);
          isDraggingRef.current = false;
          animateActiveState(false);

          if (scrubThrottleTimer.current) {
            clearTimeout(scrubThrottleTimer.current);
            scrubThrottleTimer.current = null;
          }

          const finalPage = pendingPageRef.current;
          onPageChange(finalPage);

          // Settle smoothly onto the exact page position
          if (numPages > 1 && availableTravel > 0) {
            const settleY = ((finalPage - 1) / (numPages - 1)) * availableTravel;
            Animated.spring(thumbY, {
              toValue: settleY,
              tension: 130,
              friction: 14,
              useNativeDriver: Platform.OS !== "web",
            }).start();
          }
        },

        onPanResponderTerminate: () => {
          setIsDragging(false);
          isDraggingRef.current = false;
          animateActiveState(false);

          if (numPages > 1 && availableTravel > 0) {
            const settleY =
              ((pendingPageRef.current - 1) / (numPages - 1)) * availableTravel;
            Animated.spring(thumbY, {
              toValue: settleY,
              tension: 130,
              friction: 14,
              useNativeDriver: Platform.OS !== "web",
            }).start();
          }
        },
      }),
    [
      numPages,
      availableTravel,
      applyPageScrub,
      onPageChange,
      animateActiveState,
      thumbY,
    ],
  );

  // Web pointer event handlers for desktop mouse and browser touch drag
  const webPointerStartY = useRef<number>(0);

  const handleWebPointerDown = (e: any) => {
    if (Platform.OS !== "web" || numPages <= 1) return;
    try {
      e.currentTarget?.setPointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }

    setIsDragging(true);
    isDraggingRef.current = true;
    animateActiveState(true);

    panStartOffset.current = currentThumbYRef.current;
    webPointerStartY.current = e.clientY;
  };

  const handleWebPointerMove = (e: any) => {
    if (Platform.OS !== "web" || !isDraggingRef.current || numPages <= 1 || availableTravel <= 0)
      return;

    const dy = e.clientY - webPointerStartY.current;
    const nextY = Math.max(0, Math.min(availableTravel, panStartOffset.current + dy));

    thumbY.setValue(nextY);
    currentThumbYRef.current = nextY;

    const progress = nextY / availableTravel;
    const calculatedPage = Math.round(progress * (numPages - 1)) + 1;
    const page = Math.max(1, Math.min(numPages, calculatedPage));

    applyPageScrub(page);
  };

  const handleWebPointerUp = (e: any) => {
    if (Platform.OS !== "web" || !isDraggingRef.current) return;
    try {
      e.currentTarget?.releasePointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }

    setIsDragging(false);
    isDraggingRef.current = false;
    animateActiveState(false);

    if (scrubThrottleTimer.current) {
      clearTimeout(scrubThrottleTimer.current);
      scrubThrottleTimer.current = null;
    }

    const finalPage = pendingPageRef.current;
    onPageChange(finalPage);

    // Settle smoothly onto the exact page position
    if (numPages > 1 && availableTravel > 0) {
      const settleY = ((finalPage - 1) / (numPages - 1)) * availableTravel;
      Animated.spring(thumbY, {
        toValue: settleY,
        tension: 130,
        friction: 14,
        useNativeDriver: false,
      }).start();
    }
  };

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (scrubThrottleTimer.current) clearTimeout(scrubThrottleTimer.current);
    };
  }, []);

  if (!visible || numPages <= 1) {
    return null;
  }

  // Theme-adaptive colors for the page bubble container
  const themeStyles = {
    light: {
      pillBg: "#e8ecf4",
      pillBorder: "rgba(0, 0, 0, 0.12)",
      pageTextColor: "#334155",
      shadowColor: "#000000",
    },
    sepia: {
      pillBg: "#ece4d5",
      pillBorder: "rgba(70, 50, 30, 0.15)",
      pageTextColor: "#3c3226",
      shadowColor: "#45321f",
    },
    night: {
      pillBg: "#1e293b",
      pillBorder: "rgba(255, 255, 255, 0.16)",
      pageTextColor: "#f8fafc",
      shadowColor: "#000000",
    },
  }[theme];

  return (
    <View
      style={[
        styles.container,
        {
          top: topOffset,
          bottom: bottomOffset,
        },
      ]}
      pointerEvents="box-none"
    >
      {/* Vertical Rail / Track measuring container (NO GESTURE HANDLERS HERE) */}
      <View
        ref={trackRef}
        style={styles.trackWrapper}
        onLayout={(e) => {
          const height = e.nativeEvent.layout.height;
          if (height > 0 && Math.abs(height - trackHeight) > 2) {
            setTrackHeight(height);
          }
        }}
        pointerEvents="box-none"
      >
        {/* Draggable Scrubber Thumb Pill - Gestures attached ONLY here */}
        <Animated.View
          style={[
            styles.scrubberWidget,
            {
              transform: [{ translateY: thumbY }, { scale: widgetScale }],
              opacity: widgetOpacity,
              cursor: (isDragging ? "grabbing" : "grab") as any,
              ...(Platform.OS === "web"
                ? ({ touchAction: "none", userSelect: "none" } as any)
                : {}),
            },
          ]}
          pointerEvents="auto"
          {...panResponder.panHandlers}
          {...(Platform.OS === "web"
            ? {
                onPointerDown: handleWebPointerDown,
                onPointerMove: handleWebPointerMove,
                onPointerUp: handleWebPointerUp,
                onPointerCancel: handleWebPointerUp,
              }
            : {})}
        >
          {/* Flush-mounted Right-edge Page Number Pill */}
          <View
            style={[
              styles.pagePillContainer,
              {
                backgroundColor: themeStyles.pillBg,
                borderColor: themeStyles.pillBorder,
                shadowColor: themeStyles.shadowColor,
              },
            ]}
          >
            <Text
              style={[
                styles.pageNumberText,
                { color: themeStyles.pageTextColor },
              ]}
              numberOfLines={1}
            >
              {scrubPage}
            </Text>
          </View>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    right: 0,
    width: PILL_WIDTH,
    zIndex: 9999,
  },
  trackWrapper: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    width: PILL_WIDTH,
    justifyContent: "flex-start",
  },
  scrubberWidget: {
    position: "absolute",
    top: 0,
    right: 0,
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  /* Pill bubble attached flush to the right edge */
  pagePillContainer: {
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingLeft: 4,
    shadowOffset: { width: -1, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 4,
    elevation: 6,
  },
  pageNumberText: {
    fontSize: 17,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.5,
  },
});
