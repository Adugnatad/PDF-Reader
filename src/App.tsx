import React from 'react';
import { ExpoRouterProvider } from './router-bridge';
import RootLayout from '../app/_layout';

export default function App() {
  return (
    <ExpoRouterProvider>
      <RootLayout />
    </ExpoRouterProvider>
  );
}
