import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { View, StyleSheet, Platform, Dimensions, StatusBar, ViewStyle, StyleProp } from 'react-native';

export interface EdgeInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface SafeAreaViewProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  edges?: readonly ('top' | 'right' | 'bottom' | 'left')[];
  mode?: 'padding' | 'margin';
}

const defaultInsets: EdgeInsets = {
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

const SafeAreaInsetsContext = createContext<EdgeInsets | null>(null);

export const SafeAreaProvider: React.FC<{
  children?: React.ReactNode;
  initialMetrics?: any;
  style?: StyleProp<ViewStyle>;
}> = ({ children, style }) => {
  const [insets, setInsets] = useState<EdgeInsets>(() => {
    if (Platform.OS === 'android') {
      const screen = Dimensions.get('screen');
      const window = Dimensions.get('window');
      const navBarDiff = Math.max(0, screen.height - window.height);
      const statusBarHeight = StatusBar.currentHeight || 24;
      return {
        top: statusBarHeight,
        left: 0,
        right: 0,
        bottom: navBarDiff > 0 ? navBarDiff : 48,
      };
    } else if (Platform.OS === 'ios') {
      return {
        top: 47,
        left: 0,
        right: 0,
        bottom: 34,
      };
    }
    return defaultInsets;
  });

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // In web browser, measure CSS env(safe-area-inset-*)
      const div = document.createElement('div');
      div.style.position = 'fixed';
      div.style.top = '0';
      div.style.left = '0';
      div.style.width = '0';
      div.style.height = '0';
      div.style.visibility = 'hidden';
      div.style.paddingTop = 'env(safe-area-inset-top, 0px)';
      div.style.paddingBottom = 'env(safe-area-inset-bottom, 0px)';
      div.style.paddingLeft = 'env(safe-area-inset-left, 0px)';
      div.style.paddingRight = 'env(safe-area-inset-right, 0px)';
      document.body.appendChild(div);

      const updateInsets = () => {
        const computed = window.getComputedStyle(div);
        const top = parseInt(computed.paddingTop || '0', 10) || 0;
        const bottom = parseInt(computed.paddingBottom || '0', 10) || 0;
        const left = parseInt(computed.paddingLeft || '0', 10) || 0;
        const right = parseInt(computed.paddingRight || '0', 10) || 0;
        setInsets({ top, bottom, left, right });
      };

      updateInsets();
      window.addEventListener('resize', updateInsets);
      return () => {
        window.removeEventListener('resize', updateInsets);
        div.remove();
      };
    }
  }, []);

  return (
    <SafeAreaInsetsContext.Provider value={insets}>
      <View style={[styles.provider, style]}>{children}</View>
    </SafeAreaInsetsContext.Provider>
  );
};

export const SafeAreaConsumer = SafeAreaInsetsContext.Consumer;

export function useSafeAreaInsets(): EdgeInsets {
  const insets = useContext(SafeAreaInsetsContext);
  if (insets) {
    return insets;
  }
  // Native fallback when provider not mounted
  if (Platform.OS === 'android') {
    const screen = Dimensions.get('screen');
    const window = Dimensions.get('window');
    const navBarDiff = Math.max(0, screen.height - window.height);
    return {
      top: StatusBar.currentHeight || 24,
      left: 0,
      right: 0,
      bottom: navBarDiff > 0 ? navBarDiff : 48,
    };
  } else if (Platform.OS === 'ios') {
    return {
      top: 47,
      left: 0,
      right: 0,
      bottom: 34,
    };
  }
  return defaultInsets;
}

export function useSafeAreaFrame() {
  const window = Dimensions.get('window');
  return {
    x: 0,
    y: 0,
    width: window.width,
    height: window.height,
  };
}

export const SafeAreaView = React.forwardRef<View, SafeAreaViewProps>(({
  children,
  style,
  edges = ['top', 'bottom', 'left', 'right'],
  mode = 'padding',
  ...rest
}, ref) => {
  const insets = useSafeAreaInsets();
  const flatStyle = StyleSheet.flatten(style) || {};

  const incTop = edges.includes('top');
  const incBottom = edges.includes('bottom');
  const incLeft = edges.includes('left');
  const incRight = edges.includes('right');

  const insetsStyle: ViewStyle = mode === 'margin' ? {
    marginTop: (Number(flatStyle.marginTop ?? flatStyle.marginVertical ?? flatStyle.margin ?? 0)) + (incTop ? insets.top : 0),
    marginBottom: (Number(flatStyle.marginBottom ?? flatStyle.marginVertical ?? flatStyle.margin ?? 0)) + (incBottom ? insets.bottom : 0),
    marginLeft: (Number(flatStyle.marginLeft ?? flatStyle.marginHorizontal ?? flatStyle.margin ?? 0)) + (incLeft ? insets.left : 0),
    marginRight: (Number(flatStyle.marginRight ?? flatStyle.marginHorizontal ?? flatStyle.margin ?? 0)) + (incRight ? insets.right : 0),
  } : {
    paddingTop: (Number(flatStyle.paddingTop ?? flatStyle.paddingVertical ?? flatStyle.padding ?? 0)) + (incTop ? insets.top : 0),
    paddingBottom: (Number(flatStyle.paddingBottom ?? flatStyle.paddingVertical ?? flatStyle.padding ?? 0)) + (incBottom ? insets.bottom : 0),
    paddingLeft: (Number(flatStyle.paddingLeft ?? flatStyle.paddingHorizontal ?? flatStyle.padding ?? 0)) + (incLeft ? insets.left : 0),
    paddingRight: (Number(flatStyle.paddingRight ?? flatStyle.paddingHorizontal ?? flatStyle.padding ?? 0)) + (incRight ? insets.right : 0),
  };

  return (
    <View ref={ref} style={[style, insetsStyle]} {...rest}>
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  provider: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});

export default {
  SafeAreaProvider,
  SafeAreaConsumer,
  SafeAreaInsetsContext,
  useSafeAreaInsets,
  useSafeAreaFrame,
  SafeAreaView,
};
