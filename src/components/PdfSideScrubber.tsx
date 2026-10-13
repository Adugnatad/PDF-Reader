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
  Image,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

const THUMB_HEIGHT = 54;
const TOUCH_AREA_WIDTH = 44; // Touch target width for native mobile thumbs
const BUBBLE_WIDTH = 154;

export const PdfSideScrubber: React.FC<PdfSideScrubberProps> = ({
  currentPage,
  numPages,
  onPageChange,
  topOffset = 84,
  bottomOffset = 84,
  theme = 'night',
  thumbnails = {},
  visible = true,
  docTitle,
}) => {
  const [trackHeight, setTrackHeight] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const isDraggingRef = useRef<boolean>(false);
  const [scrubPage, setScrubPage] = useState<number>(currentPage);

  // Animated values for 60 FPS transitions
  const thumbY = useRef(new Animated.Value(0)).current;
  const currentThumbYRef = useRef<number>(0);
  const bubbleScale = useRef(new Animated.Value(0)).current;
  const bubbleOpacity = useRef(new Animated.Value(0)).current;
  const railOpacity = useRef(new Animated.Value(0.75)).current;
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  // Available vertical distance the thumb can travel
  const availableTravel = useMemo(() => {
    return Math.max(1, trackHeight - THUMB_HEIGHT);
  }, [trackHeight]);

  // Synchronize thumb position when currentPage changes externally (scrolling, taps, keyboard)
  useEffect(() => {
    if (isDraggingRef.current || trackHeight <= 0 || numPages <= 1) return;

    const progress = Math.max(0, Math.min(1, (currentPage - 1) / (numPages - 1)));
    const targetY = progress * availableTravel;

    Animated.spring(thumbY, {
      toValue: targetY,
      tension: 120,
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
          navigator.vibrate(6);
        } catch {
          // ignore
        }
      }
    }
  }, []);

  // Show page number bubble with pop-in spring animation
  const showBubble = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    Animated.parallel([
      Animated.spring(bubbleScale, {
        toValue: 1,
        tension: 180,
        friction: 11,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(bubbleOpacity, {
        toValue: 1,
        duration: 130,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(railOpacity, {
        toValue: 1,
        duration: 120,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, [bubbleScale, bubbleOpacity, railOpacity]);

  // Smoothly fade out bubble after user finishes scrubbing
  const scheduleHideBubble = useCallback(
    (delayMs = 1200) => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
      hideTimerRef.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(bubbleScale, {
            toValue: 0.85,
            duration: 200,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(bubbleOpacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(railOpacity, {
            toValue: 0.65,
            duration: 280,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]).start();
      }, delayMs);
    },
    [bubbleScale, bubbleOpacity, railOpacity],
  );

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

  // Throttled page scrubbing update
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
        }, 40);
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

        onPanResponderGrant: (evt, gestureState) => {
          if (numPages <= 1) return;
          setIsDragging(true);
          isDraggingRef.current = true;
          showBubble();

          const touchY = evt.nativeEvent.locationY;
          const initialY = touchY - THUMB_HEIGHT / 2;
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

          if (scrubThrottleTimer.current) {
            clearTimeout(scrubThrottleTimer.current);
            scrubThrottleTimer.current = null;
          }

          const finalPage = pendingPageRef.current;
          onPageChange(finalPage);
          scheduleHideBubble(1400);
        },

        onPanResponderTerminate: () => {
          setIsDragging(false);
          isDraggingRef.current = false;
          scheduleHideBubble(600);
        },
      }),
    [
      numPages,
      calculatePageFromY,
      applyPageScrub,
      onPageChange,
      showBubble,
      scheduleHideBubble,
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
    showBubble();

    const rect = e.currentTarget.getBoundingClientRect();
    const touchY = e.clientY - rect.top;
    const initialY = touchY - THUMB_HEIGHT / 2;
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
    const initialY = touchY - THUMB_HEIGHT / 2;
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

    if (scrubThrottleTimer.current) {
      clearTimeout(scrubThrottleTimer.current);
      scrubThrottleTimer.current = null;
    }

    const finalPage = pendingPageRef.current;
    onPageChange(finalPage);
    scheduleHideBubble(1400);
  };

  // Quick jump button for top page (1) and bottom page (numPages)
  const handleJumpToFirst = () => {
    if (numPages <= 1) return;
    showBubble();
    thumbY.setValue(0);
    onPageChange(1);
    setScrubPage(1);
    scheduleHideBubble(1200);
  };

  const handleJumpToLast = () => {
    if (numPages <= 1) return;
    showBubble();
    thumbY.setValue(availableTravel);
    onPageChange(numPages);
    setScrubPage(numPages);
    scheduleHideBubble(1200);
  };

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (scrubThrottleTimer.current) clearTimeout(scrubThrottleTimer.current);
    };
  }, []);

  if (!visible || numPages <= 1) {
    return null;
  }

  // Theme-adaptive color palette
  const themeStyles = {
    light: {
      railBg: 'rgba(15, 23, 42, 0.1)',
      railBorder: 'rgba(15, 23, 42, 0.15)',
      thumbBg: isDragging ? '#2563eb' : '#3b82f6',
      thumbGlow: 'rgba(37, 99, 235, 0.45)',
      thumbBorder: '#ffffff',
      bubbleBg: '#0f172a',
      bubbleBorder: '#334155',
      bubbleArrow: '#0f172a',
      pageText: '#f8fafc',
      totalText: '#94a3b8',
      pctBadgeBg: 'rgba(59, 130, 246, 0.25)',
      pctBadgeText: '#60a5fa',
    },
    sepia: {
      railBg: 'rgba(120, 80, 40, 0.14)',
      railBorder: 'rgba(120, 80, 40, 0.22)',
      thumbBg: isDragging ? '#b45309' : '#d97706',
      thumbGlow: 'rgba(180, 83, 9, 0.45)',
      thumbBorder: '#fef3c7',
      bubbleBg: '#292524',
      bubbleBorder: '#57534e',
      bubbleArrow: '#292524',
      pageText: '#fef3c7',
      totalText: '#d6d3d1',
      pctBadgeBg: 'rgba(217, 119, 6, 0.25)',
      pctBadgeText: '#fcd34d',
    },
    night: {
      railBg: 'rgba(255, 255, 255, 0.1)',
      railBorder: 'rgba(255, 255, 255, 0.16)',
      thumbBg: isDragging ? '#7bd0ff' : '#60a5fa',
      thumbGlow: 'rgba(123, 208, 255, 0.5)',
      thumbBorder: '#ffffff',
      bubbleBg: '#091124',
      bubbleBorder: '#233355',
      bubbleArrow: '#091124',
      pageText: '#ffffff',
      totalText: '#8fa0c0',
      pctBadgeBg: 'rgba(123, 208, 255, 0.22)',
      pctBadgeText: '#7bd0ff',
    },
  }[theme];

  const currentPercent = Math.round(((scrubPage - 1) / (numPages - 1 || 1)) * 100);
  const activeThumbnail = thumbnails[scrubPage];

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
      {/* Draggable Vertical Scrubber Rail Track */}
      <Animated.View
        ref={trackRef}
        style={[
          styles.trackWrapper,
          {
            opacity: railOpacity,
          },
        ]}
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
        {/* Subtle Vertical Rail Guide */}
        <View
          style={[
            styles.railLine,
            {
              backgroundColor: themeStyles.railBg,
              borderColor: themeStyles.railBorder,
            },
          ]}
        />

        {/* Top Micro Marker (Jump to Page 1) */}
        <TouchableOpacity
          onPress={handleJumpToFirst}
          style={styles.topMicroLabel}
          hitSlop={{ top: 8, bottom: 8, left: 10, right: 10 }}
          accessibilityLabel="Jump to first page"
        >
          <Text style={[styles.microText, { color: themeStyles.totalText }]}>1</Text>
        </TouchableOpacity>

        {/* Bottom Micro Marker (Jump to Last Page) */}
        <TouchableOpacity
          onPress={handleJumpToLast}
          style={styles.bottomMicroLabel}
          hitSlop={{ top: 8, bottom: 8, left: 10, right: 10 }}
          accessibilityLabel="Jump to last page"
        >
          <Text style={[styles.microText, { color: themeStyles.totalText }]}>
            {numPages}
          </Text>
        </TouchableOpacity>

        {/* Draggable Bar / Thumb Capsule */}
        <Animated.View
          style={[
            styles.thumbHandleWrapper,
            {
              transform: [{ translateY: thumbY }],
            },
          ]}
          pointerEvents="none"
        >
          <View
            style={[
              styles.thumbBar,
              {
                backgroundColor: themeStyles.thumbBg,
                borderColor: themeStyles.thumbBorder,
                shadowColor: themeStyles.thumbGlow,
                width: isDragging ? 10 : 7,
              },
            ]}
          >
            {/* Native Gripper Ribs */}
            <View style={styles.gripLinesContainer}>
              <View style={styles.gripLine} />
              <View style={styles.gripLine} />
              <View style={styles.gripLine} />
            </View>
          </View>
        </Animated.View>
      </Animated.View>

      {/* Floating Page Number Bubble Callout (anchored directly to Thumb Y) */}
      <Animated.View
        style={[
          styles.bubbleWrapper,
          {
            transform: [
              { translateY: thumbY },
              { scale: bubbleScale },
            ],
            opacity: bubbleOpacity,
          },
        ]}
        pointerEvents="none"
      >
        <View
          style={[
            styles.bubbleCard,
            {
              backgroundColor: themeStyles.bubbleBg,
              borderColor: themeStyles.bubbleBorder,
            },
          ]}
        >
          {/* Mini Page Thumbnail Preview Card if available */}
          {activeThumbnail ? (
            <View style={styles.thumbnailPreviewWrap}>
              <Image
                source={{ uri: activeThumbnail }}
                style={styles.thumbnailImage}
                resizeMode="cover"
              />
              <View style={styles.thumbPageBadge}>
                <Text style={styles.thumbPageBadgeText}>P. {scrubPage}</Text>
              </View>
            </View>
          ) : null}

          {/* Header Row: Label & Progress % */}
          <View style={styles.bubbleHeaderRow}>
            <View style={styles.bubbleLabelGroup}>
              <Ionicons name="document-text" size={10} color={themeStyles.pctBadgeText} />
              <Text style={[styles.bubblePageLabel, { color: themeStyles.totalText }]}>
                PAGE
              </Text>
            </View>
            <View
              style={[
                styles.pctBadge,
                { backgroundColor: themeStyles.pctBadgeBg },
              ]}
            >
              <Text
                style={[
                  styles.pctBadgeText,
                  { color: themeStyles.pctBadgeText },
                ]}
              >
                {currentPercent}%
              </Text>
            </View>
          </View>

          {/* Large Numbers: e.g. "12 / 48" */}
          <View style={styles.bubbleNumbersRow}>
            <Text style={[styles.bubblePageNumber, { color: themeStyles.pageText }]}>
              {scrubPage}
            </Text>
            <Text style={[styles.bubbleTotalNumber, { color: themeStyles.totalText }]}>
              {' '}/ {numPages}
            </Text>
          </View>

          {/* Scrubbing status line */}
          <View style={styles.scrubbingIndicatorRow}>
            <Ionicons name="swap-vertical" size={10} color={themeStyles.pctBadgeText} />
            <Text style={[styles.scrubHint, { color: themeStyles.totalText }]}>
              {isDragging ? 'Dragging to scrub' : 'Scrubber bar'}
            </Text>
          </View>

          {/* Callout Arrow Pointer towards Draggable Bar */}
          <View
            style={[
              styles.bubbleArrow,
              {
                borderLeftColor: themeStyles.bubbleBg,
              },
            ]}
          />
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 0,
    width: TOUCH_AREA_WIDTH,
    zIndex: 9999,
  },
  trackWrapper: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    right: 0,
    width: TOUCH_AREA_WIDTH,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  railLine: {
    position: 'absolute',
    top: 18,
    bottom: 18,
    right: 14,
    width: 3,
    borderRadius: 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  topMicroLabel: {
    position: 'absolute',
    top: 0,
    right: 11,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomMicroLabel: {
    position: 'absolute',
    bottom: 0,
    right: 9,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  microText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  thumbHandleWrapper: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: TOUCH_AREA_WIDTH,
    height: THUMB_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbBar: {
    height: THUMB_HEIGHT - 6,
    borderRadius: 5,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: -2, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
  gripLinesContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  gripLine: {
    width: 4,
    height: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderRadius: 1,
  },
  bubbleWrapper: {
    position: 'absolute',
    right: TOUCH_AREA_WIDTH + 2,
    top: 0,
    height: THUMB_HEIGHT,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  bubbleCard: {
    minWidth: 122,
    maxWidth: BUBBLE_WIDTH,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1.2,
    flexDirection: 'column',
    shadowColor: '#000000',
    shadowOffset: { width: -3, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 14,
    position: 'relative',
  },
  bubbleArrow: {
    position: 'absolute',
    right: -7,
    top: '50%',
    marginTop: -6,
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftWidth: 7,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  thumbnailPreviewWrap: {
    width: '100%',
    height: 52,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 6,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.15)',
    position: 'relative',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbPageBadge: {
    position: 'absolute',
    bottom: 3,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  thumbPageBadgeText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '700',
  },
  bubbleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
    gap: 8,
  },
  bubbleLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bubblePageLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  pctBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 5,
  },
  pctBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  bubbleNumbersRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  bubblePageNumber: {
    fontSize: 21,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  bubbleTotalNumber: {
    fontSize: 12,
    fontWeight: '600',
  },
  scrubbingIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  scrubHint: {
    fontSize: 8.5,
    fontWeight: '600',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
});
