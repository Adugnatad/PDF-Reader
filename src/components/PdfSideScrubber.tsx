import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  Animated,
  Platform,
} from 'react-native';
import { ReaderTheme } from '../types';

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

const WIDGET_HEIGHT = 54;
const WIDGET_WIDTH = 92;
const CIRCLE_SIZE = 54;
const PILL_WIDTH = 48;
const PILL_HEIGHT = 48;

export const PdfSideScrubber: React.FC<PdfSideScrubberProps> = ({
  currentPage,
  numPages,
  onPageChange,
  topOffset = 74,
  bottomOffset = 84,
  theme = 'light',
  visible = true,
}) => {
  const [trackHeight, setTrackHeight] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const isDraggingRef = useRef<boolean>(false);
  const [scrubPage, setScrubPage] = useState<number>(currentPage);

  // Animated values for 60 FPS transitions
  const thumbY = useRef(new Animated.Value(0)).current;
  const currentThumbYRef = useRef<number>(0);
  const widgetScale = useRef(new Animated.Value(1)).current;
  const widgetOpacity = useRef(new Animated.Value(0.95)).current;
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
    return Math.max(1, trackHeight - WIDGET_HEIGHT);
  }, [trackHeight]);

  // Synchronize scrubber position when currentPage changes externally (scrolling, taps, keyboard)
  useEffect(() => {
    if (isDraggingRef.current || trackHeight <= 0 || numPages <= 1) return;

    const progress = Math.max(0, Math.min(1, (currentPage - 1) / (numPages - 1)));
    const targetY = progress * availableTravel;

    Animated.spring(thumbY, {
      toValue: targetY,
      tension: 130,
      friction: 14,
      useNativeDriver: Platform.OS !== 'web',
    }).start();

    setScrubPage(currentPage);
  }, [currentPage, numPages, availableTravel, trackHeight]);

  // Gentle haptic feedback on page change during scrubbing
  const triggerHaptic = useCallback((newPage: number) => {
    if (newPage !== lastHapticPageRef.current) {
      lastHapticPageRef.current = newPage;
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate(8);
        } catch {
          // ignore
        }
      }
    }
  }, []);

  const animateActiveState = useCallback((active: boolean) => {
    Animated.parallel([
      Animated.spring(widgetScale, {
        toValue: active ? 1.06 : 1,
        tension: 200,
        friction: 12,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(widgetOpacity, {
        toValue: 1,
        duration: 100,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, [widgetScale, widgetOpacity]);

  // Convert vertical track pixel position to clamped page number
  const calculatePageFromY = useCallback(
    (y: number): { page: number; clampedY: number } => {
      if (numPages <= 1 || availableTravel <= 0) {
        return { page: 1, clampedY: 0 };
      }
      const clampedY = Math.max(0, Math.min(availableTravel, y));
      const progress = clampedY / availableTravel;
      const calculated = Math.round(progress * (numPages - 1)) + 1;
      const page = Math.max(1, Math.min(numPages, calculated));
      return { page, clampedY };
    },
    [numPages, availableTravel],
  );

  // Throttled page scrubbing update for buttery rendering
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
        }, 35);
      }
    },
    [onPageChange, triggerHaptic],
  );

  // PanResponder for native gestures (iOS, Android, React Native Web)
  const panStartOffset = useRef<number>(0);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => numPages > 1,
        onStartShouldSetPanResponderCapture: () => numPages > 1,
        onMoveShouldSetPanResponder: () => numPages > 1,
        onMoveShouldSetPanResponderCapture: () => numPages > 1,

        onPanResponderGrant: (evt) => {
          if (numPages <= 1) return;
          setIsDragging(true);
          isDraggingRef.current = true;
          animateActiveState(true);

          const touchY = evt.nativeEvent.locationY;
          const initialY = touchY - WIDGET_HEIGHT / 2;
          const { page, clampedY } = calculatePageFromY(initialY);

          panStartOffset.current = clampedY;
          thumbY.setValue(clampedY);
          currentThumbYRef.current = clampedY;

          applyPageScrub(page);
        },

        onPanResponderMove: (evt, gestureState) => {
          if (!isDraggingRef.current || numPages <= 1) return;

          const newY = panStartOffset.current + gestureState.dy;
          const { page, clampedY } = calculatePageFromY(newY);

          thumbY.setValue(clampedY);
          currentThumbYRef.current = clampedY;

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
        },

        onPanResponderTerminate: () => {
          setIsDragging(false);
          isDraggingRef.current = false;
          animateActiveState(false);
        },
      }),
    [
      numPages,
      calculatePageFromY,
      applyPageScrub,
      onPageChange,
      animateActiveState,
      thumbY,
    ],
  );

  // Web pointer event handlers for desktop mouse and browser touch drag
  const handleWebPointerDown = (e: any) => {
    if (Platform.OS !== 'web' || numPages <= 1) return;
    try {
      e.currentTarget?.setPointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }

    setIsDragging(true);
    isDraggingRef.current = true;
    animateActiveState(true);

    const rect = e.currentTarget.getBoundingClientRect();
    const touchY = e.clientY - rect.top;
    const initialY = touchY - WIDGET_HEIGHT / 2;
    const { page, clampedY } = calculatePageFromY(initialY);

    panStartOffset.current = clampedY;
    thumbY.setValue(clampedY);
    currentThumbYRef.current = clampedY;

    applyPageScrub(page);
  };

  const handleWebPointerMove = (e: any) => {
    if (Platform.OS !== 'web' || !isDraggingRef.current || numPages <= 1) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const touchY = e.clientY - rect.top;
    const initialY = touchY - WIDGET_HEIGHT / 2;
    const { page, clampedY } = calculatePageFromY(initialY);

    thumbY.setValue(clampedY);
    currentThumbYRef.current = clampedY;

    applyPageScrub(page);
  };

  const handleWebPointerUp = (e: any) => {
    if (Platform.OS !== 'web' || !isDraggingRef.current) return;
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
      pillBg: '#e8ecf4',
      pillBorder: 'rgba(0, 0, 0, 0.08)',
      pageTextColor: '#334155',
    },
    sepia: {
      pillBg: '#ece4d5',
      pillBorder: 'rgba(70, 50, 30, 0.1)',
      pageTextColor: '#3c3226',
    },
    night: {
      pillBg: '#1e293b',
      pillBorder: 'rgba(255, 255, 255, 0.12)',
      pageTextColor: '#f8fafc',
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
      {/* Vertical Interactive Track Area along right edge */}
      <View
        ref={trackRef}
        style={styles.trackWrapper}
        onLayout={(e) => {
          const height = e.nativeEvent.layout.height;
          if (height > 0 && Math.abs(height - trackHeight) > 2) {
            setTrackHeight(height);
          }
        }}
        {...panResponder.panHandlers}
        {...(Platform.OS === 'web'
          ? {
              onPointerDown: handleWebPointerDown,
              onPointerMove: handleWebPointerMove,
              onPointerUp: handleWebPointerUp,
              onPointerCancel: handleWebPointerUp,
            }
          : {})}
      >
        {/* The Exact Scrubber Widget from the Reference Screenshot */}
        <Animated.View
          style={[
            styles.scrubberWidget,
            {
              transform: [
                { translateY: thumbY },
                { scale: widgetScale },
              ],
              opacity: widgetOpacity,
            },
          ]}
          pointerEvents="none"
        >
          {/* Light Grey Page Number Bubble attached flush to right screen edge */}
          <View
            style={[
              styles.pagePillContainer,
              {
                backgroundColor: themeStyles.pillBg,
                borderColor: themeStyles.pillBorder,
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

          {/* Red Circle Grab Handle with Two Horizontal White Grip Bars */}
          <View style={styles.redCircleHandle}>
            <View style={styles.gripBarsContainer}>
              <View style={styles.gripBar} />
              <View style={styles.gripBar} />
            </View>
          </View>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 0,
    width: WIDGET_WIDTH,
    zIndex: 9999,
  },
  trackWrapper: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: WIDGET_WIDTH,
    justifyContent: 'flex-start',
  },
  scrubberWidget: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: WIDGET_WIDTH,
    height: WIDGET_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Grey bubble that touches the right screen edge */
  pagePillContainer: {
    position: 'absolute',
    right: 0,
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 10,
    shadowColor: '#000000',
    shadowOffset: { width: -1, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 4,
  },
  pageNumberText: {
    fontSize: 20,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  /* Red circular drag handle with two horizontal white grip bars */
  redCircleHandle: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    backgroundColor: '#dc2626', // Acrobat Crimson Red
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: -1, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 8,
  },
  gripBarsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4.5,
  },
  gripBar: {
    width: 20,
    height: 3.5,
    backgroundColor: '#ffffff',
    borderRadius: 2,
  },
});
