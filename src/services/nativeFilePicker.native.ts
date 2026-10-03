import { PermissionsAndroid, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import ReactNativeBlobUtil from 'react-native-blob-util';
import {
  isUuidOrHash,
  cleanDocumentName,
  registerKnownPdfName,
  getKnownPdfName,
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
    const permissions: string[] = [
      PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
    ];
    if ((PermissionsAndroid.PERMISSIONS as any).READ_MEDIA_IMAGES) {
      permissions.push((PermissionsAndroid.PERMISSIONS as any).READ_MEDIA_IMAGES);
    }
    await PermissionsAndroid.requestMultiple(permissions as any);
    return true;
  } catch (e) {
    console.warn('Storage permission request note:', e);
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
 * Recursively scans an Android directory up to maxDepth levels
 */
async function scanDirectoryRecursive(
  dirPath: string,
  folder: 'Downloads' | 'Documents' | 'Scans' | 'Books',
  depth: number,
  maxDepth: number,
  visitedDirs: Set<string>,
  discovered: DiscoveredPdfItem[]
): Promise<void> {
  if (depth > maxDepth) return;
  const cleanDir = dirPath.replace(/\/+$/, '');
  if (visitedDirs.has(cleanDir)) return;
  visitedDirs.add(cleanDir);

  try {
    const exists = await ReactNativeBlobUtil.fs.exists(cleanDir);
    if (!exists) return;
    const isDir = await ReactNativeBlobUtil.fs.isDir(cleanDir);
    if (!isDir) return;

    const files = await ReactNativeBlobUtil.fs.ls(cleanDir);
    for (const item of files) {
      if (!item || item.startsWith('.')) continue;
      // Skip system, trash, and thumbnail folders
      if (
        item === 'Android' ||
        item === 'lost+found' ||
        item === '.trashed' ||
        item === 'thumbnails' ||
        item.toLowerCase().includes('cache')
      ) {
        continue;
      }

      const fullPath = `${cleanDir}/${item}`;
      try {
        const itemIsDir = await ReactNativeBlobUtil.fs.isDir(fullPath);
        if (itemIsDir) {
          // Recurse into subfolder (e.g. Documents/Documents)
          await scanDirectoryRecursive(fullPath, folder, depth + 1, maxDepth, visitedDirs, discovered);
        } else if (item.toLowerCase().endsWith('.pdf')) {
          // Found PDF file on device
          const fileUri = `file://${fullPath}`;

          let size = 0;
          let lastModified: number | undefined;
          try {
            const stat = await ReactNativeBlobUtil.fs.stat(fullPath);
            size = stat.size || 0;
            lastModified = stat.lastModified;
          } catch {
            // ignore
          }

          // Filter out empty or corrupted 0/1 byte temp files
          if (size <= 10) continue;

          // Preserve the authentic name of the file on disk!
          const realName = cleanDocumentName(item);
          if (!realName || realName.startsWith('device-pdf-') || realName.toLowerCase() === 'document.pdf') {
            continue;
          }

          // Deduplication: check if already discovered by canonical URI or by name + size
          const isDuplicate = discovered.some(
            (d) =>
              d.uri === fileUri ||
              (d.name.toLowerCase() === realName.toLowerCase() && Math.abs(d.size - size) < 1024)
          );
          if (isDuplicate) continue;

          registerKnownPdfName(fileUri, realName);

          discovered.push({
            id: `native-${fullPath}`,
            name: realName,
            size,
            uri: fileUri,
            lastModified,
            folder,
            pageCount: 1,
          });
        }
      } catch {
        // Individual item read error, continue
      }
    }
  } catch {
    // Directory listing failed, continue
  }
}

/**
 * Automatically scans device filesystem for authentic user PDF documents.
 * Discovers PDFs in Downloads, Documents, nested subfolders (e.g. Documents/Documents), SDCard, and app storage.
 * Explicitly ignores internal temp cache directories to prevent duplicates and ugly cache names.
 */
export async function autoScanDevicePdfs(): Promise<DiscoveredPdfItem[]> {
  const discovered: DiscoveredPdfItem[] = [];
  const visitedDirs = new Set<string>();

  try {
    // 1. Request Android storage permissions
    await requestStoragePermission();

    // 2. Scan Android user storage directories (with 3 levels of recursive subfolder traversal)
    if (Platform.OS === 'android') {
      const rootCandidates: Array<{
        path: string;
        folder: 'Downloads' | 'Documents' | 'Scans' | 'Books';
      }> = [];

      try {
        const fsDirs = ReactNativeBlobUtil.fs.dirs;
        if (fsDirs.DownloadDir) rootCandidates.push({ path: fsDirs.DownloadDir, folder: 'Downloads' });
        if (fsDirs.DocumentDir) rootCandidates.push({ path: fsDirs.DocumentDir, folder: 'Documents' });
        if (fsDirs.SDCardDir) {
          rootCandidates.push({ path: `${fsDirs.SDCardDir}/Download`, folder: 'Downloads' });
          rootCandidates.push({ path: `${fsDirs.SDCardDir}/Downloads`, folder: 'Downloads' });
          rootCandidates.push({ path: `${fsDirs.SDCardDir}/Documents`, folder: 'Documents' });
          rootCandidates.push({ path: `${fsDirs.SDCardDir}/PDF`, folder: 'Documents' });
          rootCandidates.push({ path: `${fsDirs.SDCardDir}/Books`, folder: 'Books' });
        }
      } catch {
        // ignore
      }

      // Standard Android mount points
      rootCandidates.push({ path: '/storage/emulated/0/Documents', folder: 'Documents' });
      rootCandidates.push({ path: '/storage/emulated/0/Download', folder: 'Downloads' });
      rootCandidates.push({ path: '/storage/emulated/0/Downloads', folder: 'Downloads' });
      rootCandidates.push({ path: '/storage/emulated/0/PDF', folder: 'Documents' });
      rootCandidates.push({ path: '/storage/emulated/0/Books', folder: 'Books' });
      rootCandidates.push({ path: '/sdcard/Documents', folder: 'Documents' });
      rootCandidates.push({ path: '/sdcard/Download', folder: 'Downloads' });
      rootCandidates.push({ path: '/sdcard/Downloads', folder: 'Downloads' });

      for (const { path, folder } of rootCandidates) {
        if (!path) continue;
        await scanDirectoryRecursive(path, folder, 1, 3, visitedDirs, discovered);
      }
    }

    // 3. Scan permanent app document storage (ONLY for non-temporary, real user PDF files)
    // NOTE: NEVER scan FileSystem.cacheDirectory or DocumentPicker cache!
    if (FileSystem.documentDirectory) {
      try {
        const appFiles = await FileSystem.readDirectoryAsync(FileSystem.documentDirectory);
        for (const file of appFiles) {
          if (!file || file.startsWith('.') || file.endsWith('.json')) continue;
          if (file.startsWith('device-pdf-') || file.toLowerCase() === 'document.pdf') continue;

          if (file.toLowerCase().endsWith('.pdf')) {
            const fileUri = `${FileSystem.documentDirectory}${file}`;
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

            if (size <= 10) continue;

            const realName = cleanDocumentName(file);
            const isDuplicate = discovered.some(
              (d) =>
                d.uri === fileUri ||
                (d.name.toLowerCase() === realName.toLowerCase() && Math.abs(d.size - size) < 1024)
            );
            if (isDuplicate) continue;

            registerKnownPdfName(fileUri, realName);

            discovered.push({
              id: `app-doc-${file}`,
              name: realName,
              size,
              uri: fileUri,
              lastModified,
              folder: 'Documents',
              pageCount: 1,
            });
          }
        }
      } catch {
        // App documentDirectory read note
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

    // Resolve the real filename
    let rawName = asset.name || '';
    if (!rawName || isUuidOrHash(rawName) || rawName.toLowerCase() === 'document.pdf') {
      const decodedUri = decodeURIComponent(asset.uri);
      const parts = decodedUri.split('/');
      const candidate = parts.pop();
      if (candidate && candidate.toLowerCase().endsWith('.pdf') && !isUuidOrHash(candidate)) {
        rawName = candidate;
      }
    }

    const name = cleanDocumentName(rawName || 'Document.pdf');
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

    // Copy to permanent documentDirectory under its real authentic filename
    let permanentUri = asset.uri;
    if (FileSystem.documentDirectory && name && !isUuidOrHash(name) && name.toLowerCase() !== 'document.pdf') {
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
