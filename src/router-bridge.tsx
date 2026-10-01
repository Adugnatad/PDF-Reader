import React, { createContext, useContext, useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';

export interface RouterLocation {
  pathname: string;
  params: Record<string, string>;
}

interface RouterContextType {
  location: RouterLocation;
  push: (href: string | { pathname: string; params?: Record<string, any> }) => void;
  replace: (href: string | { pathname: string; params?: Record<string, any> }) => void;
  back: () => void;
  canGoBack: () => boolean;
}

const RouterContext = createContext<RouterContextType>({
  location: { pathname: '/', params: {} },
  push: () => {},
  replace: () => {},
  back: () => {},
  canGoBack: () => false,
});

export const useRouter = () => {
  const ctx = useContext(RouterContext);
  return {
    push: ctx.push,
    replace: ctx.replace,
    back: ctx.back,
    canGoBack: ctx.canGoBack,
    navigate: ctx.push,
  };
};

export const useLocalSearchParams = <T extends Record<string, any> = Record<string, string>>(): T => {
  const ctx = useContext(RouterContext);
  return ctx.location.params as unknown as T;
};

export const usePathname = () => {
  const ctx = useContext(RouterContext);
  return ctx.location.pathname;
};

export const useFocusEffect = (effect: () => void | (() => void)) => {
  useEffect(() => {
    return effect();
  }, [effect]);
};

// Global route components registry loaded from /app
const routeModules: Record<string, any> = import.meta.glob('/app/**/*.{tsx,jsx,ts,js}', { eager: true });

function parseUrl(url: string): RouterLocation {
  const [pathPart, queryPart] = url.split('?');
  const pathname = pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
  const params: Record<string, string> = {};

  if (queryPart) {
    const searchParams = new URLSearchParams(queryPart);
    searchParams.forEach((val, key) => {
      params[key] = val;
    });
  }

  return { pathname: pathname || '/', params };
}

export function ExpoRouterProvider({ children }: { children?: React.ReactNode }) {
  const [history, setHistory] = useState<RouterLocation[]>(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash.replace(/^#/, '');
      return [parseUrl(hash || '/')];
    }
    return [{ pathname: '/', params: {} }];
  });

  const currentLocation = history[history.length - 1] || { pathname: '/', params: {} };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#/, '');
      const parsed = parseUrl(hash || '/');
      setHistory((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.pathname === parsed.pathname && JSON.stringify(last.params) === JSON.stringify(parsed.params)) {
          return prev;
        }
        return [...prev, parsed];
      });
    };

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('hashchange', handleHashChange);
      return () => window.removeEventListener('hashchange', handleHashChange);
    }
  }, []);

  const push = (href: string | { pathname: string; params?: Record<string, any> }) => {
    let target = '';
    if (typeof href === 'string') {
      target = href;
    } else {
      const query = href.params ? '?' + new URLSearchParams(href.params).toString() : '';
      target = `${href.pathname}${query}`;
    }

    const nextLoc = parseUrl(target);
    setHistory((prev) => [...prev, nextLoc]);
    if (typeof window !== 'undefined') {
      window.location.hash = target;
    }
  };

  const replace = (href: string | { pathname: string; params?: Record<string, any> }) => {
    let target = '';
    if (typeof href === 'string') {
      target = href;
    } else {
      const query = href.params ? '?' + new URLSearchParams(href.params).toString() : '';
      target = `${href.pathname}${query}`;
    }

    const nextLoc = parseUrl(target);
    setHistory((prev) => [...prev.slice(0, -1), nextLoc]);
    if (typeof window !== 'undefined') {
      window.location.hash = target;
    }
  };

  const back = () => {
    if (history.length > 1) {
      setHistory((prev) => prev.slice(0, -1));
      if (typeof window !== 'undefined') {
        const prevLoc = history[history.length - 2];
        const query = Object.keys(prevLoc.params).length ? '?' + new URLSearchParams(prevLoc.params).toString() : '';
        window.location.hash = `${prevLoc.pathname}${query}`;
      }
    } else {
      push('/');
    }
  };

  const canGoBack = () => history.length > 1;

  return (
    <RouterContext.Provider value={{ location: currentLocation, push, replace, back, canGoBack }}>
      {children}
    </RouterContext.Provider>
  );
}

// Slot component renders the active route component inside a layout
export function Slot() {
  const { pathname } = usePathname() ? { pathname: usePathname() } : { pathname: '/' };

  // Match / -> /app/index.tsx
  // Match /pdf -> /app/pdf.tsx
  // Match /spreadsheet -> /app/spreadsheet.tsx
  let matchedMod: any = null;

  if (pathname === '/' || pathname === '') {
    matchedMod = routeModules['/app/index.tsx'] || routeModules['/app/index.ts'];
  } else {
    const clean = pathname.replace(/^\//, '');
    matchedMod =
      routeModules[`/app/${clean}.tsx`] ||
      routeModules[`/app/${clean}.ts`] ||
      routeModules[`/app/${clean}/index.tsx`];
  }

  if (!matchedMod) {
    // Fallback to index
    matchedMod = routeModules['/app/index.tsx'] || routeModules['/app/index.ts'];
  }

  const Component = matchedMod?.default || null;

  if (!Component) {
    return null;
  }

  return <Component />;
}

export function Stack({ children }: { children?: React.ReactNode }) {
  return <Slot />;
}

Stack.Screen = function StackScreen() {
  return null;
};

export const Link: React.FC<{
  href: string | { pathname: string; params?: Record<string, any> };
  children: React.ReactNode;
  asChild?: boolean;
}> = ({ href, children, asChild }) => {
  const router = useRouter();
  const handlePress = () => {
    router.push(href);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as any, {
      onPress: handlePress,
    });
  }

  return (
    <View onTouchEnd={handlePress} style={styles.linkWrapper}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  linkWrapper: {
    cursor: 'pointer' as any,
  },
});

export default {
  useRouter,
  useLocalSearchParams,
  usePathname,
  Slot,
  Stack,
  Link,
  ExpoRouterProvider,
};
