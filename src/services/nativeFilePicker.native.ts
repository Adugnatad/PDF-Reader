import { PermissionsAndroid, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import ReactNativeBlobUtil from 'react-native-blob-util';
import {
  isUuidOrHash,
  cleanDocumentName,
  registerKnownPdfName,
  getKnownPdfName,
  extractPdfInfoFromBytesAsync,
  extractPdfInfoFromBytes,
} from '../utils/pdfNameResolver';

export interface PickedFileResult {
  name: string;
  size: number;
  buffer: ArrayBuffer;
  uri?: string;
  pageCount?: number;
}

export interface DiscoveredPdfItem {
  id: string;
  name: string;
  size: number;
  uri: string;
  lastModified?: number;
  folder: 'Downloads' | 'Documents' | 'Scans' | 'Books';
  pageCount?: number;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  if (typeof Buffer !== 'undefined') {
    const buf = Buffer.from(base64, 'base64');
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  }
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Requests Android storage read permissions safely
 */
async function requestStoragePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const hasRead = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
    );
    if (hasRead) return true;

    const res = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      {
        title: 'Device Document Storage',
        message:
          'DocuFlow scans your device to display your PDF documents automatically on the home screen.',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'Allow',
      }
    );
    return res === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

/**
 * Reads binary ArrayBuffer from a native device file URI or absolute path
 */
export async function readNativePdfBytes(fileUriOrPath: string): Promise<ArrayBuffer | null> {
  const cleanPath = fileUriOrPath.replace('file://', '');

  // 1. Try ReactNativeBlobUtil
  try {
    const exists = await ReactNativeBlobUtil.fs.exists(cleanPath);
    if (exists) {
      const base64 = await ReactNativeBlobUtil.fs.readFile(cleanPath, 'base64');
      if (base64) {
        return base64ToArrayBuffer(base64);
      }
    }
  } catch {
    // fallback
  }

  // 2. Try fetch
  try {
    const res = await fetch(fileUriOrPath.startsWith('file://') ? fileUriOrPath : `file://${cleanPath}`);
    if (res.ok) {
      return await res.arrayBuffer();
    }
  } catch {
    // fallback
  }

  // 3. Try FileSystem
  try {
    const uri = fileUriOrPath.startsWith('file://') ? fileUriOrPath : `file://${cleanPath}`;
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64' as any,
    });
    if (base64) {
      return base64ToArrayBuffer(base64);
    }
  } catch {
    // failed
  }

  return null;
}

/**
 * Automatically scans device filesystem for all PDF documents.
 * Discovers PDFs in Downloads, Documents, SDCard, app document storage, and cache.
 */
export async function autoScanDevicePdfs(): Promise<DiscoveredPdfItem[]> {
  const discovered: DiscoveredPdfItem[] = [];
  const visitedPaths = new Set<string>();

  try {
    // 1. Request Android storage permissions
    try {
      await requestStoragePermission();
    } catch {
      // Continue
    }

    // 2. Scan Expo FileSystem directories (permanent documents & cache)
    const expoScanDirs: Array<{ uri: string; folder: 'Downloads' | 'Documents' | 'Scans' | 'Books' }> = [];
    if (FileSystem.documentDirectory) {
      expoScanDirs.push({ uri: FileSystem.documentDirectory, folder: 'Documents' });
    }
    if (FileSystem.cacheDirectory) {
      expoScanDirs.push({ uri: FileSystem.cacheDirectory, folder: 'Documents' });
      expoScanDirs.push({ uri: `${FileSystem.cacheDirectory}DocumentPicker/`, folder: 'Documents' });
    }

    for (const { uri: dirUri, folder } of expoScanDirs) {
      try {
        const files = await FileSystem.readDirectoryAsync(dirUri);
        for (const file of files) {
          if (file.startsWith('.')) continue;
          const fileUri = `${dirUri}${file}`;

          if (file.toLowerCase().endsWith('.pdf')) {
            if (discovered.some((d) => d.uri === fileUri || d.id === `expo-${fileUri}`)) {
              continue;
            }

            let size = 0;
            let lastModified: number | undefined;
            try {
              const info = await FileSystem.getInfoAsync(fileUri);
              if (info.exists) {
                size = (info as any).size || 0;
                lastModified = (info as any).modificationTime;
              }
            } catch {
              // ignore
            }

            let displayName = cleanDocumentName(file);
            let pageCount = 1;

            const known = getKnownPdfName(fileUri);
            if (known) {
              displayName = known;
            } else if (isUuidOrHash(file)) {
              // Read authentic PDF metadata using pdf-lib
              try {
                const buffer = await readNativePdfBytes(fileUri);
                if (buffer) {
                  const info = await extractPdfInfoFromBytesAsync(buffer);
                  if (info.title) displayName = info.title;
                  if (info.pageCount) pageCount = info.pageCount;
                }
              } catch {
                // ignore
              }
            }

            registerKnownPdfName(fileUri, displayName);

            discovered.push({
              id: `expo-${fileUri}`,
              name: displayName,
              size,
              uri: fileUri,
              lastModified,
              folder,
              pageCount,
            });
          }
        }
      } catch {
        // Directory may not exist yet, continue
      }
    }

    // 3. Scan Android standard directories
    const candidateDirs: Array<{
      path: string;
      folder: 'Downloads' | 'Documents' | 'Scans' | 'Books';
    }> = [];

    if (Platform.OS === 'android') {
      try {
        const fsDirs = ReactNativeBlobUtil.fs.dirs;
        if (fsDirs.DownloadDir) candidateDirs.push({ path: fsDirs.DownloadDir, folder: 'Downloads' });
        if (fsDirs.DocumentDir) candidateDirs.push({ path: fsDirs.DocumentDir, folder: 'Documents' });
        if (fsDirs.SDCardDir) {
          candidateDirs.push({ path: `${fsDirs.SDCardDir}/Download`, folder: 'Downloads' });
          candidateDirs.push({ path: `${fsDirs.SDCardDir}/Documents`, folder: 'Documents' });
          candidateDirs.push({ path: `${fsDirs.SDCardDir}/PDF`, folder: 'Documents' });
          candidateDirs.push({ path: `${fsDirs.SDCardDir}/Books`, folder: 'Books' });
        }
      } catch {
        // ignore
      }

      candidateDirs.push({ path: '/storage/emulated/0/Download', folder: 'Downloads' });
      candidateDirs.push({ path: '/storage/emulated/0/Documents', folder: 'Documents' });
      candidateDirs.push({ path: '/storage/emulated/0/Download/Telegram', folder: 'Downloads' });
      candidateDirs.push({ path: '/storage/emulated/0/Download/WhatsApp', folder: 'Downloads' });
      candidateDirs.push({ path: '/storage/emulated/0/PDF', folder: 'Documents' });
      candidateDirs.push({ path: '/storage/emulated/0/Books', folder: 'Books' });
    }

    for (const { path: rawPath, folder } of candidateDirs) {
      if (!rawPath) continue;
      const dirPath = rawPath.endsWith('/') ? rawPath.slice(0, -1) : rawPath;
      if (visitedPaths.has(dirPath)) continue;
      visitedPaths.add(dirPath);

      try {
        const exists = await ReactNativeBlobUtil.fs.exists(dirPath);
        if (!exists) continue;

        const isDirectory = await ReactNativeBlobUtil.fs.isDir(dirPath);
        if (!isDirectory) continue;

        const files = await ReactNativeBlobUtil.fs.ls(dirPath);
        for (const filename of files) {
          if (filename.startsWith('.')) continue;

          const fullPath = `${dirPath}/${filename}`;
          const isPdf = filename.toLowerCase().endsWith('.pdf');
          const fileUri = `file://${fullPath}`;

          if (isPdf) {
            if (discovered.some((d) => d.uri === fileUri)) continue;

            let size = 0;
            let lastModified: number | undefined;
            try {
              const stat = await ReactNativeBlobUtil.fs.stat(fullPath);
              size = stat.size || 0;
              lastModified = stat.lastModified;
            } catch {
              // ignore
            }

            let displayName = cleanDocumentName(filename);
            let pageCount = 1;

            const known = getKnownPdfName(fileUri);
            if (known) {
              displayName = known;
            } else if (isUuidOrHash(filename)) {
              try {
                const buffer = await readNativePdfBytes(fullPath);
                if (buffer) {
                  const info = await extractPdfInfoFromBytesAsync(buffer);
                  if (info.title) displayName = info.title;
                  if (info.pageCount) pageCount = info.pageCount;
                }
              } catch {
                // ignore
              }
            }

            registerKnownPdfName(fileUri, displayName);

            discovered.push({
              id: `native-${fullPath}`,
              name: displayName,
              size,
              uri: fileUri,
              lastModified,
              folder,
              pageCount,
            });
          }
        }
      } catch {
        // Move on to next directory
      }
    }
  } catch (err) {
    console.warn('Auto scan native device note:', err);
  }

  return discovered;
}

/**
 * Loads a PDF directly from native iOS / Android device storage via DocumentPicker.
 * Copies file into permanent app document storage under its exact authentic name.
 */
export async function pickPdfFromDevice(): Promise<PickedFileResult | null> {
  try {
    const res = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'application/*'],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (res.canceled || !res.assets || res.assets.length === 0) {
      return null;
    }

    const asset = res.assets[0];
    const name = cleanDocumentName(asset.name || 'document.pdf');
    let buffer: ArrayBuffer | null = null;

    try {
      const response = await fetch(asset.uri);
      buffer = await response.arrayBuffer();
    } catch {
      try {
        const base64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: 'base64' as any,
        });
        buffer = base64ToArrayBuffer(base64);
      } catch (err) {
        console.error('Error reading native file URI:', err);
      }
    }

    if (!buffer) {
      throw new Error('Unable to read selected PDF file data from native device');
    }

    // Copy to permanent documentDirectory under its real filename
    let permanentUri = asset.uri;
    if (FileSystem.documentDirectory && name) {
      try {
        const targetPath = `${FileSystem.documentDirectory}${name}`;
        await FileSystem.copyAsync({ from: asset.uri, to: targetPath });
        permanentUri = targetPath;
      } catch (copyErr) {
        console.warn('Document copy note:', copyErr);
      }
    }

    let pageCount: number | undefined;
    if (buffer) {
      const info = extractPdfInfoFromBytes(buffer);
      pageCount = info.pageCount;
    }

    registerKnownPdfName(permanentUri, name);
    registerKnownPdfName(asset.uri, name);

    return {
      name,
      size: asset.size || buffer.byteLength,
      buffer,
      uri: permanentUri,
      pageCount,
    };
  } catch (err) {
    console.error('Native document picker error:', err);
    throw err;
  }
}

/**
 * Scans device storage without opening any UI pickers.
 * Returns all discovered PDF documents on the device.
 */
export async function scanDeviceStorage(): Promise<PickedFileResult[]> {
  try {
    const autoDiscovered = await autoScanDevicePdfs();
    const results: PickedFileResult[] = [];
    for (const item of autoDiscovered) {
      const buffer = await readNativePdfBytes(item.uri);
      if (buffer) {
        results.push({
          name: item.name,
          size: item.size || buffer.byteLength,
          buffer,
          uri: item.uri,
          pageCount: item.pageCount,
        });
      }
    }
    return results;
  } catch (err) {
    console.warn('Native scan error:', err);
    return [];
  }
}
