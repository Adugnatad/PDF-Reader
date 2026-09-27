import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Slot, useRouter, usePathname } from 'expo-router';
import { ToastProvider, useToast } from '../src/context/ToastContext';

function RootLayoutContent() {
  const router = useRouter();
  const pathname = usePathname();
  const { showToast } = useToast();
  const [deviceFrameMode, setDeviceFrameMode] = useState<boolean>(false);

  const isHome = pathname === '/' || pathname === '';
  const isPdf = pathname.startsWith('/pdf');
  const isSpreadsheet = pathname.startsWith('/spreadsheet');

  return (
    <View style={styles.root}>
      {/* Top Floating Quick Navigation Bar */}
      <View style={styles.navigationBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.navButtonsRow}
        >
          <Text style={styles.screenLabel}>SCREENS:</Text>

          <TouchableOpacity
            onPress={() => router.push('/')}
            style={[styles.navBtn, isHome ? styles.navBtnActive : styles.navBtnInactive]}
            activeOpacity={0.7}
          >
            <Ionicons
              name="folder"
              size={15}
              color={isHome ? '#0d0096' : '#dae2fd'}
            />
            <Text style={[styles.navBtnText, isHome ? styles.navBtnTextActive : styles.navBtnTextInactive]}>
              Screen 1: Files
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/pdf')}
            style={[styles.navBtn, isPdf ? styles.navBtnActive : styles.navBtnInactive]}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name="auto-stories"
              size={15}
              color={isPdf ? '#0d0096' : '#dae2fd'}
            />
            <Text style={[styles.navBtnText, isPdf ? styles.navBtnTextActive : styles.navBtnTextInactive]}>
              Screen 2: PDF Reader
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/spreadsheet')}
            style={[styles.navBtn, isSpreadsheet ? styles.navBtnActive : styles.navBtnInactive]}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name="table-chart"
              size={15}
              color={isSpreadsheet ? '#0d0096' : '#dae2fd'}
            />
            <Text style={[styles.navBtnText, isSpreadsheet ? styles.navBtnTextActive : styles.navBtnTextInactive]}>
              Screen 3: Excel Sheet
            </Text>
          </TouchableOpacity>
        </ScrollView>

        <TouchableOpacity
          onPress={() => {
            const nextMode = !deviceFrameMode;
            setDeviceFrameMode(nextMode);
            showToast(nextMode ? 'Switched to Mobile Phone Frame' : 'Switched to Full Screen Fluid');
          }}
          style={styles.frameToggleBtn}
          activeOpacity={0.7}
        >
          <Ionicons
            name={deviceFrameMode ? 'expand-outline' : 'phone-portrait-outline'}
            size={16}
            color="#c7c4d7"
          />
          <Text style={styles.frameToggleText}>
            {deviceFrameMode ? 'Full View' : 'Phone Frame'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Viewport Container */}
      <View style={[styles.viewportWrapper, deviceFrameMode && styles.viewportWrapperFrame]}>
        <View style={[styles.viewportContainer, deviceFrameMode ? styles.phoneFrame : styles.fluidFrame]}>
          {/* Simulated Mobile Status Bar (Visible in phone frame mode) */}
          {deviceFrameMode && (
            <View style={styles.statusBarMock}>
              <Text style={styles.statusBarTime}>9:41</Text>
              <View style={styles.dynamicIsland} />
              <View style={styles.statusIcons}>
                <Ionicons name="stats-chart" size={12} color="#ffffff" />
                <Ionicons name="wifi" size={12} color="#ffffff" />
                <Ionicons name="battery-full" size={14} color="#ffffff" />
              </View>
            </View>
          )}

          {/* Expo Router Slot renders the matched route file */}
          <View style={styles.screenRenderer}>
            <Slot />
          </View>
        </View>
      </View>
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
    backgroundColor: '#060e20',
    minHeight: '100%' as any,
  },
  navigationBar: {
    backgroundColor: '#0b1326',
    borderBottomWidth: 1,
    borderBottomColor: '#2d3449',
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 50,
  },
  navButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  screenLabel: {
    color: '#908fa0',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginRight: 4,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  navBtnActive: {
    backgroundColor: '#c0c1ff',
  },
  navBtnInactive: {
    backgroundColor: '#171f33',
    borderWidth: 1,
    borderColor: '#2d3449',
  },
  navBtnText: {
    fontSize: 12,
  },
  navBtnTextActive: {
    color: '#0d0096',
    fontWeight: '700',
  },
  navBtnTextInactive: {
    color: '#dae2fd',
    fontWeight: '500',
  },
  frameToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#171f33',
    borderWidth: 1,
    borderColor: '#2d3449',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginLeft: 8,
  },
  frameToggleText: {
    color: '#c7c4d7',
    fontSize: 11,
    fontWeight: '500',
  },
  viewportWrapper: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
  },
  viewportWrapperFrame: {
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  viewportContainer: {
    width: '100%',
    backgroundColor: '#0b1326',
    flex: 1,
  },
  fluidFrame: {
    maxWidth: 720,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
  phoneFrame: {
    maxWidth: 420,
    borderRadius: 36,
    borderWidth: 6,
    borderColor: '#222a3d',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 25 },
    shadowOpacity: 0.8,
    shadowRadius: 60,
    elevation: 24,
  },
  statusBarMock: {
    backgroundColor: '#0b1326',
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 50,
  },
  statusBarTime: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  dynamicIsland: {
    width: 80,
    height: 16,
    backgroundColor: '#000000',
    borderRadius: 999,
  },
  statusIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  screenRenderer: {
    flex: 1,
  },
});
