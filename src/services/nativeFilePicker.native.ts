import { PermissionsAndroid, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import ReactNativeBlobUtil from 'react-native-blob-util';
import {
  isUuidOrHash,
  resolvePdfDisplayName,
  registerKnownPdfName,
  getKnownPdfName,
  cleanDocumentName,
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
          'PDF Reader scans your device to display your PDF documents automatically on the home screen.',
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
 * Automatically scans device filesystem (Android Downloads, Documents, SDCard, and iOS Documents)
 * for all PDF documents. Preserves real filenames and reads page counts.
 */
export async function autoScanDevicePdfs(): Promise<DiscoveredPdfItem[]> {
  const discovered: DiscoveredPdfItem[] = [];
  const visitedPaths = new Set<string>();

  try {
    // 1. Request permissions if Android (safe and non-blocking)
    try {
      await requestStoragePermission();
    } catch {
      // Continue scanning
    }

    // 2. Build list of candidate directories (excluding temporary cache)
    const candidateDirs: Array<{
      path: string;
      folder: 'Downloads' | 'Documents' | 'Scans' | 'Books';
    }> = [];

    if (Platform.OS === 'android') {
      try {
        const fsDirs = ReactNativeBlobUtil.fs.dirs;
        if (fsDirs.DownloadDir) {
          candidateDirs.push({ path: fsDirs.DownloadDir, folder: 'Downloads' });
        }
        if (fsDirs.DocumentDir) {
          candidateDirs.push({ path: fsDirs.DocumentDir, folder: 'Documents' });
        }
        if (fsDirs.SDCardDir) {
          candidateDirs.push({ path: `${fsDirs.SDCardDir}/Download`, folder: 'Downloads' });
          candidateDirs.push({ path: `${fsDirs.SDCardDir}/Documents`, folder: 'Documents' });
          candidateDirs.push({ path: `${fsDirs.SDCardDir}/PDF`, folder: 'Documents' });
          candidateDirs.push({ path: `${fsDirs.SDCardDir}/Books`, folder: 'Books' });
        }
      } catch (e) {
        console.warn('BlobUtil dirs note:', e);
      }

      // Standard Android public user directories
      candidateDirs.push({ path: '/storage/emulated/0/Download', folder: 'Downloads' });
      candidateDirs.push({ path: '/storage/emulated/0/Documents', folder: 'Documents' });
      candidateDirs.push({ path: '/storage/emulated/0/Download/Telegram', folder: 'Downloads' });
      candidateDirs.push({ path: '/storage/emulated/0/Download/WhatsApp', folder: 'Downloads' });
      candidateDirs.push({ path: '/storage/emulated/0/PDF', folder: 'Documents' });
      candidateDirs.push({ path: '/storage/emulated/0/Books', folder: 'Books' });
    }

    // Permanent iOS and app document directories
    if (FileSystem.documentDirectory) {
      const cleanDoc = FileSystem.documentDirectory.replace('file://', '');
      candidateDirs.push({ path: cleanDoc, folder: 'Documents' });
    }

    // 3. Scan each candidate directory
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

          if (isPdf) {
            try {
              const stat = await ReactNativeBlobUtil.fs.stat(fullPath);
              const fileUri = `file://${fullPath}`;
              let displayName = cleanDocumentName(filename);
              let pageCount = 1;

              // Check if URI is already mapped to a user-specified name
              const known = getKnownPdfName(fileUri);
              if (known) {
                displayName = known;
              } else if (isUuidOrHash(filename)) {
                // If it is an anonymous UUID, resolve title or fallback
                try {
                  const buffer = await readNativePdfBytes(fullPath);
                  if (buffer) {
                    const resolved = resolvePdfDisplayName(filename, fileUri, buffer, stat.size);
                    displayName = resolved.name;
                    if (resolved.pageCount) pageCount = resolved.pageCount;
                  }
                } catch {
                  // fallback
                }
              }

              registerKnownPdfName(fileUri, displayName);

              discovered.push({
                id: `native-pdf-${fullPath}`,
                name: displayName,
                size: stat.size || 0,
                uri: fileUri,
                lastModified: stat.lastModified,
                folder,
                pageCount,
              });
            } catch {
              const fileUri = `file://${fullPath}`;
              discovered.push({
                id: `native-pdf-${fullPath}`,
                name: cleanDocumentName(filename),
                size: 0,
                uri: fileUri,
                folder,
                pageCount: 1,
              });
            }
          } else {
            // Check subdirectories 1 level deep (e.g. Download/Invoices)
            try {
              const subIsDir = await ReactNativeBlobUtil.fs.isDir(fullPath);
              if (subIsDir && !visitedPaths.has(fullPath) && !filename.startsWith('.')) {
                visitedPaths.add(fullPath);
                const subFiles = await ReactNativeBlobUtil.fs.ls(fullPath);
                for (const subFile of subFiles) {
                  if (subFile.toLowerCase().endsWith('.pdf')) {
                    const subFullPath = `${fullPath}/${subFile}`;
                    try {
                      const subStat = await ReactNativeBlobUtil.fs.stat(subFullPath);
                      const fileUri = `file://${subFullPath}`;
                      let displayName = cleanDocumentName(subFile);
                      let pageCount = 1;

                      const known = getKnownPdfName(fileUri);
                      if (known) {
                        displayName = known;
                      } else if (isUuidOrHash(subFile)) {
                        try {
                          const buffer = await readNativePdfBytes(subFullPath);
                          if (buffer) {
                            const resolved = resolvePdfDisplayName(subFile, fileUri, buffer, subStat.size);
                            displayName = resolved.name;
                            if (resolved.pageCount) pageCount = resolved.pageCount;
                          }
                        } catch {
                          // fallback
                        }
                      }

                      registerKnownPdfName(fileUri, displayName);

                      discovered.push({
                        id: `native-pdf-${subFullPath}`,
                        name: displayName,
                        size: subStat.size || 0,
                        uri: fileUri,
                        lastModified: subStat.lastModified,
                        folder,
                        pageCount,
                      });
                    } catch {
                      const fileUri = `file://${subFullPath}`;
                      discovered.push({
                        id: `native-pdf-${subFullPath}`,
                        name: cleanDocumentName(subFile),
                        size: 0,
                        uri: fileUri,
                        folder,
                        pageCount: 1,
                      });
                    }
                  }
                }
              }
            } catch {
              // ignore
            }
          }
        }
      } catch {
        // Move on to next directory
      }
    }

    // 4. Scan Expo FileSystem.documentDirectory (permanent app storage)
    if (FileSystem.documentDirectory) {
      try {
        const expoFiles = await FileSystem.readDirectoryAsync(FileSystem.documentDirectory);
        for (const file of expoFiles) {
          if (file.toLowerCase().endsWith('.pdf')) {
            const fileUri = `${FileSystem.documentDirectory}${file}`;
            if (!discovered.some((d) => d.name === file || d.uri === fileUri)) {
              let displayName = cleanDocumentName(file);
              let pageCount = 1;
              let size = 0;

              try {
                const info = await FileSystem.getInfoAsync(fileUri);
                size = info.exists ? (info.size || 0) : 0;
              } catch {
                // ignore
              }

              const known = getKnownPdfName(fileUri);
              if (known) {
                displayName = known;
              } else if (isUuidOrHash(file)) {
                try {
                  const buffer = await readNativePdfBytes(fileUri);
                  if (buffer) {
                    const resolved = resolvePdfDisplayName(file, fileUri, buffer, size);
                    displayName = resolved.name;
                    if (resolved.pageCount) pageCount = resolved.pageCount;
                  }
                } catch {
                  // fallback
                }
              }

              registerKnownPdfName(fileUri, displayName);

              discovered.push({
                id: `expo-doc-${file}`,
                name: displayName,
                size,
                uri: fileUri,
                folder: 'Documents',
                pageCount,
              });
            }
          }
        }
      } catch {
        // ignore
      }
    }
  } catch (err) {
    console.warn('Auto scan native device note:', err);
  }

  return discovered;
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
 * Loads a PDF directly from native iOS / Android device storage.
 * Copies the file into permanent app document storage under its exact authentic name.
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
 * Scans device storage: first checks standard device folders automatically;
 * falls back to multi-file picker if user wishes to select specific folders.
 */
export async function scanDeviceStorage(): Promise<PickedFileResult[]> {
  try {
    // 1. Run automatic filesystem scan
    const autoDiscovered = await autoScanDevicePdfs();
    if (autoDiscovered.length > 0) {
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
      if (results.length > 0) {
        return results;
      }
    }

    // 2. If nothing found in standard locations, allow user to pick multiple files
    const res = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'application/*'],
      copyToCacheDirectory: true,
      multiple: true,
    });

    if (res.canceled || !res.assets || res.assets.length === 0) {
      return [];
    }

    const results: PickedFileResult[] = [];
    for (const asset of res.assets) {
      try {
        const name = cleanDocumentName(asset.name || 'document.pdf');
        let buffer: ArrayBuffer | null = null;
        try {
          const response = await fetch(asset.uri);
          buffer = await response.arrayBuffer();
        } catch {
          const base64 = await FileSystem.readAsStringAsync(asset.uri, {
            encoding: 'base64' as any,
          });
          buffer = base64ToArrayBuffer(base64);
        }

        if (buffer) {
          let permanentUri = asset.uri;
          if (FileSystem.documentDirectory && name) {
            try {
              const targetPath = `${FileSystem.documentDirectory}${name}`;
              await FileSystem.copyAsync({ from: asset.uri, to: targetPath });
              permanentUri = targetPath;
            } catch {
              // fallback
            }
          }

          let pageCount: number | undefined;
          const info = extractPdfInfoFromBytes(buffer);
          pageCount = info.pageCount;

          registerKnownPdfName(permanentUri, name);
          registerKnownPdfName(asset.uri, name);

          results.push({
            name,
            size: asset.size || buffer.byteLength,
            buffer,
            uri: permanentUri,
            pageCount,
          });
        }
      } catch (err) {
        console.warn('Failed reading scanned asset:', err);
      }
    }
    return results;
  } catch (err) {
    console.warn('Native scan error:', err);
    return [];
  }
}
