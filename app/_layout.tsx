import React from 'react';
import { StyleSheet } from 'react-native';
import { Slot } from 'expo-router';
import { ToastProvider } from '../src/context/ToastContext';
import { SafeAreaContainer } from '../src/components/SafeAreaContainer';

function RootLayoutContent() {
  return (
    <SafeAreaContainer backgroundColor="#0b1326" style={styles.root}>
      <Slot />
    </SafeAreaContainer>
  );
}

export default function RootLayout() {
  return (
    <ToastProvider>
      <RootLayoutContent />
    </ToastProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0b1326',
    width: '100%',
    minHeight: '100%' as any,
  },
});
