/**
 * Storage Helper (Native Android / iOS Platform)
 * Uses FileSystem.documentDirectory for permanent document metadata and reader settings
 */
import * as FileSystem from 'expo-file-system/legacy';
import { ViewModeSettings } from '../types';

export const DEFAULT_VIEW_SETTINGS: ViewModeSettings = {
  viewMode: 'single',
  reflow: false,
  reflowFontSize: 16,
  theme: 'sepia',
  readingDirection: 'vertical',
};

const REGISTRY_FILE = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}docuflow_registry.json`
  : null;

const VIEW_SETTINGS_FILE = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}docuflow_view_settings.json`
  : null;

export async function saveRegistryToDisk(payload: string): Promise<void> {
  if (REGISTRY_FILE) {
    try {
      await FileSystem.writeAsStringAsync(REGISTRY_FILE, payload);
    } catch (e) {
      console.warn('Native save registry error:', e);
    }
  }
}

export async function loadRegistryFromDisk(): Promise<string | null> {
  if (REGISTRY_FILE) {
    try {
      const info = await FileSystem.getInfoAsync(REGISTRY_FILE);
      if (info.exists) {
        return await FileSystem.readAsStringAsync(REGISTRY_FILE);
      }
    } catch (e) {
      console.warn('Native read registry error:', e);
    }
  }
  return null;
}

export async function saveViewModeSettings(settings: ViewModeSettings): Promise<void> {
  if (VIEW_SETTINGS_FILE) {
    try {
      await FileSystem.writeAsStringAsync(VIEW_SETTINGS_FILE, JSON.stringify(settings));
    } catch (e) {
      console.warn('Native save view settings error:', e);
    }
  }
}

export async function loadViewModeSettings(): Promise<ViewModeSettings | null> {
  if (VIEW_SETTINGS_FILE) {
    try {
      const info = await FileSystem.getInfoAsync(VIEW_SETTINGS_FILE);
      if (info.exists) {
        const text = await FileSystem.readAsStringAsync(VIEW_SETTINGS_FILE);
        const parsed = JSON.parse(text);
        return {
          ...DEFAULT_VIEW_SETTINGS,
          ...parsed,
        };
      }
    } catch (e) {
      console.warn('Native read view settings error:', e);
    }
  }
  return null;
}
