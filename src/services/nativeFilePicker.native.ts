import { Linking, NativeModules, Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import ReactNativeBlobUtil from "react-native-blob-util";
import {
  isUuidOrHash,
  cleanDocumentName,
  registerKnownPdfName,
  getKnownPdfName,
  extractPdfInfoFromBytes,
  extractPdfInfoFromBytesAsync,
  isJunkDocument,
} from "../utils/pdfNameResolver";

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
  folder: "Downloads" | "Documents" | "Scans" | "Books";
  pageCount?: number;
}

const SAF_URI_FILE = `${FileSystem.documentDirectory}docuflow_saf_dir.txt`;

const allFilesAccess = NativeModules.AllFilesAccess as
  | {
      hasAllFilesAccess: () => Promise<boolean>;
      openAllFilesAccessSettings: () => Promise<boolean>;
    }
  | undefined;

export async function hasAllFilesAccess(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  if (allFilesAccess?.hasAllFilesAccess) {
    try {
      return await allFilesAccess.hasAllFilesAccess();
    } catch {}
  }
  return true;
}

export async function openAllFilesAccessSettings(): Promise<void> {
  if (Platform.OS !== "android") return;
  if (allFilesAccess?.openAllFilesAccessSettings) {
    try {
      await allFilesAccess.openAllFilesAccessSettings();
      return;
    } catch {}
  }
  try {
    await Linking.openSettings();
  } catch (err) {
    console.warn("Could not open settings:", err);
  }
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  if (typeof Buffer !== "undefined") {
    const buf = Buffer.from(base64, "base64");
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
 * Get previously granted StorageAccessFramework directory URI
 */
export async function getSavedSafDirectoryUri(): Promise<string | null> {
  if (Platform.OS !== "android") return null;
  try {
    const info = await FileSystem.getInfoAsync(SAF_URI_FILE);
    if (info.exists) {
      const uri = await FileSystem.readAsStringAsync(SAF_URI_FILE);
      return uri.trim() || null;
    }
  } catch {}
  return null;
}

/**
 * Save granted StorageAccessFramework directory URI
 */
export async function saveSafDirectoryUri(uri: string): Promise<void> {
  if (Platform.OS !== "android" || !uri) return;
  try {
    await FileSystem.writeAsStringAsync(SAF_URI_FILE, uri.trim());
  } catch {}
}

/**
 * Scans a folder via Android StorageAccessFramework (SAF)
 */
async function scanSafDirectory(
  dirUri: string,
  discovered: DiscoveredPdfItem[],
): Promise<void> {
  if (Platform.OS !== "android" || !FileSystem.StorageAccessFramework) return;
  try {
    const files = await Promise.race([
      FileSystem.StorageAccessFramework.readDirectoryAsync(dirUri),
      new Promise<string[]>((_, reject) =>
        setTimeout(() => reject(new Error("SAF readDirectory timeout")), 4000),
      ),
    ]);
    for (const fileUri of files) {
      const decoded = decodeURIComponent(fileUri);
      if (!decoded.toLowerCase().endsWith(".pdf")) continue;

      // Extract filename from the end of the URI
      const parts = decoded.split("/");
      const lastPart = parts.pop() || "";
      const subParts = lastPart.split(":");
      const filenameWithSubdir = subParts.pop() || lastPart;
      const cleanFilename = filenameWithSubdir.split("/").pop() || lastPart;

      const realName = cleanDocumentName(cleanFilename);
      if (!realName || isJunkDocument(realName, fileUri)) continue;

      let size = 0;
      let lastModified: number | undefined;
      try {
        const info = await FileSystem.getInfoAsync(fileUri);
        if (info.exists) {
          size = (info as any).size || 0;
          lastModified = (info as any).modificationTime;
        }
      } catch {}

      if (size <= 10) continue;

      const isDuplicate = discovered.some(
        (d) =>
          d.uri === fileUri ||
          (d.name.toLowerCase() === realName.toLowerCase() &&
            Math.abs(d.size - size) < 1024),
      );
      if (isDuplicate) continue;

      registerKnownPdfName(fileUri, realName);

      discovered.push({
        id: `saf-${fileUri}`,
        name: realName,
        size,
        uri: fileUri,
        lastModified,
        folder: "Documents",
        pageCount: 1,
      });
    }
  } catch (err) {
    console.warn("SAF scan directory note:", err);
  }
}

export const MAX_SAFE_BUFFER_BYTES = 25 * 1024 * 1024; // 25 MB safety limit

/**
 * Reads binary ArrayBuffer from a native device file URI or absolute path.
 * Enforces memory safety checks to prevent Android OutOfMemory crashes on large files.
 */
export async function readNativePdfBytes(
  fileUriOrPath: string,
): Promise<ArrayBuffer | null> {
  const cleanPath = fileUriOrPath.replace("file://", "");

  // 1. Check file size first: Never load large files (> 25MB) into JS Base64 memory
  try {
    let fileSize = 0;
    try {
      const stat = await ReactNativeBlobUtil.fs.stat(cleanPath);
      fileSize =
        typeof stat.size === "string" ? parseInt(stat.size, 10) : stat.size || 0;
    } catch {
      try {
        const info = await FileSystem.getInfoAsync(fileUriOrPath);
        fileSize = (info as any).size || 0;
      } catch {}
    }

    if (fileSize > MAX_SAFE_BUFFER_BYTES) {
      console.warn(
        `[Memory Guard] Skipping in-memory Base64 read of large file (${(
          fileSize /
          (1024 * 1024)
        ).toFixed(1)} MB). Native streaming from disk is used.`
      );
      return null;
    }
  } catch {}

  // 2. Try fetch first (streams directly into native binary ArrayBuffer without huge Java Base64 string)
  try {
    const fetchUri =
      fileUriOrPath.startsWith("file://") ||
      fileUriOrPath.startsWith("content://")
        ? fileUriOrPath
        : `file://${cleanPath}`;
    const res = await fetch(fetchUri);
    if (res.ok) {
      return await res.arrayBuffer();
    }
  } catch {}

  // 3. For small files only (<= 25MB), fallback to ReactNativeBlobUtil
  try {
    const exists = await ReactNativeBlobUtil.fs.exists(cleanPath);
    if (exists) {
      const base64 = await ReactNativeBlobUtil.fs.readFile(cleanPath, "base64");
      if (base64) {
        return base64ToArrayBuffer(base64);
      }
    }
  } catch {}

  // 4. Content URI fallback for small files
  if (fileUriOrPath.startsWith("content://")) {
    try {
      const base64 = await FileSystem.readAsStringAsync(fileUriOrPath, {
        encoding: "base64" as any,
      });
      if (base64) {
        return base64ToArrayBuffer(base64);
      }
    } catch {}
  }

  return null;
}

const SKIP_DIR_REGEX =
  /^(android|data|obb|dcim|camera|pictures|photos|movies|music|audio|podcasts|ringtones|alarms|notifications|\.thumbnails|\.trashed|lost\+found|cache|tmp|node_modules|miui|tencent|\.git)$/i;

const NON_DOC_EXTENSIONS =
  /\.(jpe?g|png|gif|webp|bmp|svg|mp4|mkv|mov|avi|wmv|mp3|wav|ogg|flac|m4a|aac|zip|rar|7z|tar|gz|apk|exe|bin|iso|dmg)$/i;

async function safeLstat(
  dirPath: string,
  timeoutMs = 2500,
): Promise<any[] | null> {
  try {
    const lstatPromise = ReactNativeBlobUtil.fs.lstat(dirPath);
    const timeout = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), timeoutMs),
    );
    return await Promise.race([lstatPromise, timeout]);
  } catch {
    return null;
  }
}

async function safeLs(
  dirPath: string,
  timeoutMs = 2000,
): Promise<string[] | null> {
  try {
    const lsPromise = ReactNativeBlobUtil.fs.ls(dirPath);
    const timeout = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), timeoutMs),
    );
    return await Promise.race([lsPromise, timeout]);
  } catch {
    return null;
  }
}

/**
 * Recursively scans a targeted Android directory up to maxDepth levels.
 * Leverages native batch lstat for near-instantaneous discovery without bridge saturation.
 */
async function scanDirectoryRecursive(
  dirPath: string,
  folder: "Downloads" | "Documents" | "Scans" | "Books",
  depth: number,
  maxDepth: number,
  visitedDirs: Set<string>,
  discovered: DiscoveredPdfItem[],
): Promise<void> {
  if (depth > maxDepth) return;
  const cleanDir = dirPath.replace(/\/+$/, "");
  if (!cleanDir || visitedDirs.has(cleanDir)) return;
  visitedDirs.add(cleanDir);

  // 1. First try fast batch lstat (returns name, type, size, lastModified in ONE call)
  try {
    const stats = await safeLstat(cleanDir, 2500);
    if (stats && Array.isArray(stats) && stats.length > 0) {
      const subdirs: string[] = [];

      for (const item of stats) {
        const itemName = item.filename || item.path?.split("/").pop() || "";
        if (!itemName || itemName.startsWith(".")) continue;

        if (item.type === "directory") {
          if (
            SKIP_DIR_REGEX.test(itemName) ||
            itemName.toLowerCase().includes("cache")
          ) {
            continue;
          }
          if (depth < maxDepth) {
            subdirs.push(item.path || `${cleanDir}/${itemName}`);
          }
        } else {
          // File
          if (itemName.toLowerCase().endsWith(".pdf")) {
            const rawSize = item.size;
            const size =
              typeof rawSize === "string"
                ? parseInt(rawSize, 10)
                : rawSize || 0;
            if (size <= 10) continue;

            const realName = cleanDocumentName(itemName);
            const fullPath = item.path || `${cleanDir}/${itemName}`;
            const fileUri = `file://${fullPath}`;
            if (!realName || isJunkDocument(realName, fileUri)) continue;

            const isDuplicate = discovered.some(
              (d) =>
                d.uri === fileUri ||
                (d.name.toLowerCase() === realName.toLowerCase() &&
                  Math.abs(d.size - size) < 1024),
            );
            if (isDuplicate) continue;

            registerKnownPdfName(fileUri, realName);

            discovered.push({
              id: `native-${fullPath}`,
              name: realName,
              size,
              uri: fileUri,
              lastModified: item.lastModified
                ? Number(item.lastModified)
                : undefined,
              folder,
              pageCount: 1,
            });
          }
        }
      }

      // Recurse into subdirectories
      for (const subdir of subdirs) {
        const childFolder =
          /download/i.test(subdir)
            ? "Downloads"
            : /book/i.test(subdir)
              ? "Books"
              : /scan/i.test(subdir)
                ? "Scans"
                : folder;
        await scanDirectoryRecursive(
          subdir,
          childFolder,
          depth + 1,
          maxDepth,
          visitedDirs,
          discovered,
        );
      }
      return;
    }
  } catch {
    // Fall back to safeLs below
  }

  // 2. Fallback: safeLs
  try {
    const files = await safeLs(cleanDir, 2000);
    if (!files || !Array.isArray(files)) return;

    const subdirs: string[] = [];

    for (const item of files) {
      if (!item || item.startsWith(".")) continue;
      if (
        SKIP_DIR_REGEX.test(item) ||
        item.toLowerCase().includes("cache")
      ) {
        continue;
      }

      const fullPath = `${cleanDir}/${item}`;
      if (/\/Android\/(data|obb)(\/|$)/i.test(fullPath)) continue;

      if (item.toLowerCase().endsWith(".pdf")) {
        const fileUri = `file://${fullPath}`;
        let size = 0;
        let lastModified: number | undefined;
        try {
          const stat = await ReactNativeBlobUtil.fs.stat(fullPath);
          size =
            typeof stat.size === "string"
              ? parseInt(stat.size, 10)
              : stat.size || 0;
          lastModified = stat.lastModified
            ? Number(stat.lastModified)
            : undefined;
        } catch {}

        if (size <= 10) continue;
        const realName = cleanDocumentName(item);
        if (!realName || isJunkDocument(realName, fileUri)) continue;

        const isDuplicate = discovered.some(
          (d) =>
            d.uri === fileUri ||
            (d.name.toLowerCase() === realName.toLowerCase() &&
              Math.abs(d.size - size) < 1024),
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
      } else if (depth < maxDepth && !NON_DOC_EXTENSIONS.test(item)) {
        // Fast probe: only check isDir if it's not a known file extension
        const itemIsDir = await Promise.race([
          ReactNativeBlobUtil.fs.isDir(fullPath),
          new Promise<boolean>((resolve) =>
            setTimeout(() => resolve(false), 500),
          ),
        ]).catch(() => false);

        if (itemIsDir) {
          subdirs.push(fullPath);
        }
      }
    }

    for (const subdir of subdirs) {
      const childFolder =
        /download/i.test(subdir)
          ? "Downloads"
          : /book/i.test(subdir)
            ? "Books"
            : /scan/i.test(subdir)
              ? "Scans"
              : folder;
      await scanDirectoryRecursive(
        subdir,
        childFolder,
        depth + 1,
        maxDepth,
        visitedDirs,
        discovered,
      );
    }
  } catch {
    // Directory listing failed or not permitted, continue
  }
}

/**
 * Automatically scans device filesystem for authentic user PDF documents.
 * Discovers PDFs in Downloads, Documents, PDF, Books, SDCard, storage root, and app storage.
 */
export async function autoScanDevicePdfs(): Promise<DiscoveredPdfItem[]> {
  const discovered: DiscoveredPdfItem[] = [];
  const scanTask = internalAutoScanDevicePdfs(discovered);
  const timeoutPromise = new Promise<DiscoveredPdfItem[]>((resolve) =>
    setTimeout(() => resolve(discovered), 10000),
  );
  return Promise.race([scanTask, timeoutPromise]);
}

async function internalAutoScanDevicePdfs(
  discovered: DiscoveredPdfItem[] = [],
): Promise<DiscoveredPdfItem[]> {
  const visitedDirs = new Set<string>();

  try {
    // 1. Scan via a previously selected StorageAccessFramework directory
    const savedSafUri = await getSavedSafDirectoryUri();
    if (savedSafUri) {
      await scanSafDirectory(savedSafUri, discovered);
    }

    // 2. Scan Android document, download, and storage locations
    if (Platform.OS === "android") {
      const targetDirs: Array<{
        path: string;
        folder: "Downloads" | "Documents" | "Scans" | "Books";
        maxDepth: number;
      }> = [];

      try {
        const fsDirs = ReactNativeBlobUtil.fs.dirs;
        if (fsDirs.DownloadDir) {
          targetDirs.push({
            path: fsDirs.DownloadDir,
            folder: "Downloads",
            maxDepth: 6,
          });
        }
        if (fsDirs.DocumentDir) {
          targetDirs.push({
            path: fsDirs.DocumentDir,
            folder: "Documents",
            maxDepth: 6,
          });
        }
        if (fsDirs.SDCardDir) {
          targetDirs.push({
            path: fsDirs.SDCardDir,
            folder: "Documents",
            maxDepth: 6,
          });
        }
        if ((fsDirs as any).LegacyDownloadDir) {
          targetDirs.push({
            path: (fsDirs as any).LegacyDownloadDir,
            folder: "Downloads",
            maxDepth: 6,
          });
        }
        if ((fsDirs as any).LegacySDCardDir) {
          targetDirs.push({
            path: `${(fsDirs as any).LegacySDCardDir}/Download`,
            folder: "Downloads",
            maxDepth: 6,
          });
          targetDirs.push({
            path: `${(fsDirs as any).LegacySDCardDir}/Downloads`,
            folder: "Downloads",
            maxDepth: 6,
          });
          targetDirs.push({
            path: `${(fsDirs as any).LegacySDCardDir}/Documents`,
            folder: "Documents",
            maxDepth: 6,
          });
          targetDirs.push({
            path: `${(fsDirs as any).LegacySDCardDir}/PDF`,
            folder: "Documents",
            maxDepth: 6,
          });
        }
      } catch {
        // ignore
      }

      // Explicit Android document & download locations
      targetDirs.push({
        path: "/storage/emulated/0/Download",
        folder: "Downloads",
        maxDepth: 6,
      });
      targetDirs.push({
        path: "/storage/emulated/0/Downloads",
        folder: "Downloads",
        maxDepth: 6,
      });
      targetDirs.push({
        path: "/storage/emulated/0/Documents",
        folder: "Documents",
        maxDepth: 6,
      });
      targetDirs.push({
        path: "/storage/emulated/0/PDF",
        folder: "Documents",
        maxDepth: 6,
      });
      targetDirs.push({
        path: "/storage/emulated/0/Books",
        folder: "Books",
        maxDepth: 6,
      });
      // User root storage crawl (finds PDFs anywhere in device storage root)
      targetDirs.push({
        path: "/storage/emulated/0",
        folder: "Documents",
        maxDepth: 6,
      });
      targetDirs.push({ path: "/sdcard/Download", folder: "Downloads", maxDepth: 6 });
      targetDirs.push({ path: "/sdcard/Downloads", folder: "Downloads", maxDepth: 6 });
      targetDirs.push({ path: "/sdcard/Documents", folder: "Documents", maxDepth: 6 });
      targetDirs.push({ path: "/sdcard", folder: "Documents", maxDepth: 6 });

      for (const { path, folder, maxDepth } of targetDirs) {
        if (!path) continue;
        await scanDirectoryRecursive(
          path,
          folder,
          1,
          maxDepth,
          visitedDirs,
          discovered,
        );
      }
    }

    // 3. Scan permanent app document storage for non-temporary user PDF files
    if (FileSystem.documentDirectory) {
      try {
        const appFiles = await FileSystem.readDirectoryAsync(
          FileSystem.documentDirectory,
        );
        for (const file of appFiles) {
          if (
            !file ||
            file.startsWith(".") ||
            file.endsWith(".json") ||
            file.endsWith(".txt")
          ) {
            continue;
          }

          // Purge legacy junk cache files
          if (isJunkDocument(file)) {
            try {
              await FileSystem.deleteAsync(
                `${FileSystem.documentDirectory}${file}`,
                { idempotent: true },
              );
            } catch {}
            continue;
          }

          if (file.toLowerCase().endsWith(".pdf")) {
            const fileUri = `${FileSystem.documentDirectory}${file}`;
            let size = 0;
            let lastModified: number | undefined;
            try {
              const info = await FileSystem.getInfoAsync(fileUri);
              if (info.exists) {
                size = (info as any).size || 0;
                lastModified = (info as any).modificationTime;
              }
            } catch {}

            if (size <= 10) continue;

            const realName = cleanDocumentName(file);
            if (isJunkDocument(realName, fileUri)) continue;

            const isDuplicate = discovered.some(
              (d) =>
                d.uri === fileUri ||
                (d.name.toLowerCase() === realName.toLowerCase() &&
                  Math.abs(d.size - size) < 1024),
            );
            if (isDuplicate) continue;

            registerKnownPdfName(fileUri, realName);

            discovered.push({
              id: `app-doc-${file}`,
              name: realName,
              size,
              uri: fileUri,
              lastModified,
              folder: "Documents",
              pageCount: 1,
            });
          }
        }
      } catch {
        // App documentDirectory read note
      }
    }
  } catch (err) {
    console.warn("Auto scan native device note:", err);
  }

  return discovered;
}

/**
 * Prompts user to select their Documents folder via StorageAccessFramework (Android 11+ safe)
 * and scans all PDF files in that folder.
 */
export async function promptAndScanDeviceStorage(): Promise<
  DiscoveredPdfItem[]
> {
  if (Platform.OS === "android" && FileSystem.StorageAccessFramework) {
    try {
      let initialHint: string | undefined;
      try {
        initialHint =
          FileSystem.StorageAccessFramework.getUriForDirectoryInRoot(
            "Documents",
          );
      } catch {}

      const permissions =
        await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(
          initialHint,
        );
      if (permissions.granted && permissions.directoryUri) {
        await saveSafDirectoryUri(permissions.directoryUri);
        const discovered: DiscoveredPdfItem[] = [];
        await scanSafDirectory(permissions.directoryUri, discovered);
        return discovered;
      }
    } catch (e) {
      console.warn("SAF folder picker note:", e);
    }
  }
  return await autoScanDevicePdfs();
}

/**
 * Loads a PDF directly from native iOS / Android device storage via DocumentPicker.
 * Copies file into permanent app document storage under its exact authentic name.
 */
export async function pickPdfFromDevice(): Promise<PickedFileResult | null> {
  try {
    const res = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "application/*"],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (res.canceled || !res.assets || res.assets.length === 0) {
      return null;
    }

    const asset = res.assets[0];

    // Resolve the real filename
    let rawName = asset.name || "";
    if (
      !rawName ||
      isUuidOrHash(rawName) ||
      rawName.toLowerCase() === "document.pdf"
    ) {
      const decodedUri = decodeURIComponent(asset.uri);
      const parts = decodedUri.split("/");
      const candidate = parts.pop();
      if (
        candidate &&
        candidate.toLowerCase().endsWith(".pdf") &&
        !isUuidOrHash(candidate)
      ) {
        rawName = candidate;
      }
    }

    const name = cleanDocumentName(rawName || "Document.pdf");
    const assetSize = asset.size || 0;
    let buffer: ArrayBuffer | null = null;

    // For files within safe memory limits (<= 25MB), load buffer for metadata
    if (assetSize <= MAX_SAFE_BUFFER_BYTES) {
      try {
        const response = await fetch(asset.uri);
        buffer = await response.arrayBuffer();
      } catch {
        try {
          const base64 = await FileSystem.readAsStringAsync(asset.uri, {
            encoding: "base64" as any,
          });
          buffer = base64ToArrayBuffer(base64);
        } catch (err) {
          console.error("Error reading native file URI:", err);
        }
      }
    } else {
      // Large file (> 25MB): Stream directly from disk!
      // Do not load into JS memory / Base64 to prevent Android 256MB heap crash
      console.warn(
        `[Memory Guard] Picked file is ${(assetSize / (1024 * 1024)).toFixed(
          1
        )} MB. Streaming directly from disk without in-memory Base64.`
      );
      buffer = new ArrayBuffer(0);
    }

    if (!buffer) {
      buffer = new ArrayBuffer(0);
    }

    // Copy to permanent documentDirectory under its real authentic filename via native disk stream
    let permanentUri = asset.uri;
    if (
      FileSystem.documentDirectory &&
      name &&
      !isJunkDocument(name) &&
      !isUuidOrHash(name)
    ) {
      try {
        const targetPath = `${FileSystem.documentDirectory}${name}`;
        await FileSystem.copyAsync({ from: asset.uri, to: targetPath });
        permanentUri = targetPath;
      } catch (copyErr) {
        console.warn("Document copy note:", copyErr);
      }
    }

    let pageCount: number | undefined;
    if (buffer && buffer.byteLength > 0) {
      const info = await extractPdfInfoFromBytesAsync(buffer);
      pageCount = info.pageCount;
    }

    registerKnownPdfName(permanentUri, name);
    registerKnownPdfName(asset.uri, name);

    return {
      name,
      size: assetSize || buffer.byteLength,
      buffer,
      uri: permanentUri,
      pageCount: pageCount || 1,
    };
  } catch (err) {
    console.error("Native document picker error:", err);
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
      results.push({
        name: item.name,
        size: item.size || 0,
        buffer: new ArrayBuffer(0),
        uri: item.uri,
        pageCount: item.pageCount || 1,
      });
    }
    return results;
  } catch (err) {
    console.warn("Native scan error:", err);
    return [];
  }
}
