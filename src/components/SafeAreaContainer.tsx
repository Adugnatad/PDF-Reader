import React from 'react';
import {
  StatusBar,
  StyleSheet,
  Platform,
  View,
  Dimensions,
  StyleProp,
  ViewStyle,
  StatusBarStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface SafeAreaContainerProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  backgroundColor?: string;
  statusBarStyle?: StatusBarStyle;
  statusBarColor?: string;
  edges?: Array<'top' | 'bottom' | 'left' | 'right'>;
}

/**
 * Hook to safely read insets even if outside a SafeAreaProvider or on native devices
 * where Android system bars (soft navigation bar / 3-button navigation / gesture pill)
 * need explicit safe clearance.
 */
export function useAppSafeInsets() {
  let contextInsets = { top: 0, bottom: 0, left: 0, right: 0 };
  try {
    contextInsets = useSafeAreaInsets();
  } catch {
    // Fallback if rendered outside SafeAreaProvider
  }

  const screenDim = Dimensions.get('screen');
  const windowDim = Dimensions.get('window');
  // Android soft navigation bar difference (Back, Home, Recents buttons)
  const androidNavBarDiff = Math.max(0, screenDim.height - windowDim.height);
  const androidStatusBar = StatusBar.currentHeight || 24;

  let top = contextInsets.top;
  if (top === 0) {
    if (Platform.OS === 'android') {
      top = androidStatusBar;
    } else if (Platform.OS === 'ios') {
      top = 44;
    }
  }

  let bottom = contextInsets.bottom;
  if (Platform.OS === 'android') {
    // Guarantee clearance for Android system bar options (3-button navigation / gesture bar)
    const minAndroidNav = androidNavBarDiff > 0 ? androidNavBarDiff : 48;
    bottom = Math.max(bottom, minAndroidNav);
  } else if (Platform.OS === 'ios' && bottom === 0) {
    bottom = 24;
  }

  return {
    top,
    bottom,
    left: contextInsets.left,
    right: contextInsets.right,
    rawInsets: contextInsets,
  };
}

/**
 * Universal safe-area container for native devices (iOS notch/dynamic island & Android
 * status bar and 3-button / gesture system navigation bar) as well as mobile web.
 *
 * Guarantees that headers and bottom tab bars never collide with or overlay system bars.
 */
export const SafeAreaContainer: React.FC<SafeAreaContainerProps> = ({
  children,
  style,
  backgroundColor = '#0b1326',
  statusBarStyle = 'light-content',
  statusBarColor = '#0b1326',
  edges = ['top', 'bottom', 'left', 'right'],
}) => {
  const safeInsets = useAppSafeInsets();

  const includeTop = edges.includes('top');
  const includeBottom = edges.includes('bottom');
  const includeLeft = edges.includes('left');
  const includeRight = edges.includes('right');

  const topPadding = includeTop ? safeInsets.top : 0;
  const bottomPadding = includeBottom ? safeInsets.bottom : 0;
  const leftPadding = includeLeft ? safeInsets.left : 0;
  const rightPadding = includeRight ? safeInsets.right : 0;

  return (
    <View
      style={[
        styles.safeArea,
        {
          backgroundColor,
          paddingTop: topPadding,
          paddingBottom: bottomPadding,
          paddingLeft: leftPadding,
          paddingRight: rightPadding,
        },
        Platform.OS === 'web' && {
          paddingTop: includeTop ? 'max(env(safe-area-inset-top, 0px), ' + topPadding + 'px)' : 0,
          paddingBottom: includeBottom ? 'max(env(safe-area-inset-bottom, 0px), ' + bottomPadding + 'px)' : 0,
          paddingLeft: includeLeft ? 'max(env(safe-area-inset-left, 0px), ' + leftPadding + 'px)' : 0,
          paddingRight: includeRight ? 'max(env(safe-area-inset-right, 0px), ' + rightPadding + 'px)' : 0,
        } as any,
        style,
      ]}
    >
      <StatusBar
        barStyle={statusBarStyle}
        backgroundColor={statusBarColor}
        translucent={Platform.OS === 'android'}
      />
      <View style={styles.content}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    width: '100%',
    minHeight: '100%' as any,
  },
  content: {
    flex: 1,
    width: '100%',
  },
});

export default SafeAreaContainer;
