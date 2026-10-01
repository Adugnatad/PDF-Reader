/**
 * Storage Helper (Native Android / iOS Platform)
 * Uses FileSystem.documentDirectory for permanent document metadata
 */
import * as FileSystem from 'expo-file-system/legacy';

const REGISTRY_FILE = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}docuflow_registry.json`
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
