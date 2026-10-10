import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Slot } from 'expo-router';
import { ToastProvider } from '../src/context/ToastContext';

function RootLayoutContent() {
  return (
    <View style={styles.root}>
      <Slot />
    </View>
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
