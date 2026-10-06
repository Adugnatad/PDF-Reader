import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
        'react-native': 'react-native-web',
        'expo-router': path.resolve(import.meta.dirname, 'src/router-bridge.tsx'),
        '@expo/vector-icons': path.resolve(import.meta.dirname, 'src/expo-icons.tsx'),
        'react-native-pdf': path.resolve(import.meta.dirname, 'src/components/react-native-pdf-web.tsx'),
      },
      extensions: ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js'],
    },
    define: {
      global: 'globalThis',
      __DEV__: JSON.stringify(true),
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
