import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ExpoRouterProvider } from './router-bridge';
import RootLayout from '../app/_layout';

export default function App() {
  return (
    <SafeAreaProvider>
      <ExpoRouterProvider>
        <RootLayout />
      </ExpoRouterProvider>
    </SafeAreaProvider>
  );
}
