import React, { createContext, useContext, useMemo } from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';

export interface EdgeInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Metrics {
  insets: EdgeInsets;
  frame: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export const SafeAreaInsetsContext = createContext<EdgeInsets>({
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
});

export const initialWindowMetrics: Metrics = {
  frame: { x: 0, y: 0, width: 0, height: 0 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

export function SafeAreaProvider({
  children,
  initialMetrics,
  style,
}: {
  children?: React.ReactNode;
  initialMetrics?: Metrics | null;
  style?: any;
}) {
  const insets: EdgeInsets = useMemo(() => {
    if (initialMetrics?.insets) {
      return initialMetrics.insets;
    }
    return {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    };
  }, [initialMetrics]);

  return (
    <SafeAreaInsetsContext.Provider value={insets}>
      <View style={[styles.provider, style]}>{children}</View>
    </SafeAreaInsetsContext.Provider>
  );
}

export function useSafeAreaInsets(): EdgeInsets {
  const context = useContext(SafeAreaInsetsContext);
  return context || { top: 0, right: 0, bottom: 0, left: 0 };
}

export function useSafeAreaFrame() {
  const width = typeof window !== 'undefined' ? window.innerWidth : 390;
  const height = typeof window !== 'undefined' ? window.innerHeight : 844;
  return { x: 0, y: 0, width, height };
}

export interface SafeAreaViewProps extends ViewProps {
  edges?: readonly ('top' | 'right' | 'bottom' | 'left')[];
  mode?: 'padding' | 'margin';
}

export const SafeAreaView = React.forwardRef<any, SafeAreaViewProps>(
  (
    {
      children,
      style,
      edges = ['top', 'right', 'bottom', 'left'],
      mode = 'padding',
      ...props
    },
    ref
  ) => {
    const insets = useSafeAreaInsets();
    const includeTop = edges.includes('top');
    const includeBottom = edges.includes('bottom');
    const includeLeft = edges.includes('left');
    const includeRight = edges.includes('right');

    const edgeStyle =
      mode === 'margin'
        ? {
            marginTop: includeTop ? insets.top : 0,
            marginBottom: includeBottom ? insets.bottom : 0,
            marginLeft: includeLeft ? insets.left : 0,
            marginRight: includeRight ? insets.right : 0,
          }
        : {
            paddingTop: includeTop ? insets.top : 0,
            paddingBottom: includeBottom ? insets.bottom : 0,
            paddingLeft: includeLeft ? insets.left : 0,
            paddingRight: includeRight ? insets.right : 0,
          };

    return (
      <View ref={ref} style={[styles.safeArea, edgeStyle, style]} {...props}>
        {children}
      </View>
    );
  }
);

SafeAreaView.displayName = 'SafeAreaView';

const styles = StyleSheet.create({
  provider: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  safeArea: {
    flex: 1,
  },
});

export default {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
  SafeAreaInsetsContext,
  initialWindowMetrics,
  useSafeAreaFrame,
};
