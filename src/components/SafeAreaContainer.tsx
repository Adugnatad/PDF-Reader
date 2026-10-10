import React from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Platform,
  View,
  StyleProp,
  ViewStyle,
  StatusBarStyle,
} from 'react-native';

export interface SafeAreaContainerProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  backgroundColor?: string;
  statusBarStyle?: StatusBarStyle;
  statusBarColor?: string;
  edges?: Array<'top' | 'bottom' | 'left' | 'right'>;
}

/**
 * High-performance safe-area container for native devices (iOS notch/dynamic island & Android status bar/navigation)
 * as well as mobile web viewports with env(safe-area-inset-*).
 */
export const SafeAreaContainer: React.FC<SafeAreaContainerProps> = ({
  children,
  style,
  backgroundColor = '#0b1326',
  statusBarStyle = 'light-content',
  statusBarColor = '#0b1326',
  edges = ['top', 'bottom', 'left', 'right'],
}) => {
  const includeTop = edges.includes('top');
  const includeBottom = edges.includes('bottom');
  const includeLeft = edges.includes('left');
  const includeRight = edges.includes('right');

  const androidStatusBarHeight =
    Platform.OS === 'android' && includeTop ? StatusBar.currentHeight || 0 : 0;

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        { backgroundColor },
        androidStatusBarHeight > 0 && { paddingTop: androidStatusBarHeight },
        Platform.OS === 'web' && {
          paddingTop: includeTop ? 'env(safe-area-inset-top, 0px)' : 0,
          paddingBottom: includeBottom ? 'env(safe-area-inset-bottom, 0px)' : 0,
          paddingLeft: includeLeft ? 'env(safe-area-inset-left, 0px)' : 0,
          paddingRight: includeRight ? 'env(safe-area-inset-right, 0px)' : 0,
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
    </SafeAreaView>
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
