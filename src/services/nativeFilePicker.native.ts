import { NativeModules, Platform } from "react-native";
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
  return (await allFilesAccess?.hasAllFilesAccess()) ?? false;
}

export async function openAllFilesAccessSettings(): Promise<void> {
  if (Platform.OS !== "android") return;
  if (!allFilesAccess)
    throw new Error("Android all-files access module is unavailable");
  await allFilesAccess.openAllFilesAccessSettings();
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
    const files =
      await FileSystem.StorageAccessFramework.readDirectoryAsync(dirUri);
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

      let pageCount = 1;
      try {
        const bytes = await readNativePdfBytes(fileUri);
        if (bytes) {
          const info = await extractPdfInfoFromBytesAsync(bytes);
          if (info.pageCount && info.pageCount > 0) {
            pageCount = info.pageCount;
          }
        }
      } catch {}

      discovered.push({
        id: `saf-${fileUri}`,
        name: realName,
        size,
        uri: fileUri,
        lastModified,
        folder: "Documents",
        pageCount,
      });
    }
  } catch (err) {
    console.warn("SAF scan directory note:", err);
  }
}

/**
 * Reads binary ArrayBuffer from a native device file URI or absolute path
 */
export async function readNativePdfBytes(
  fileUriOrPath: string,
): Promise<ArrayBuffer | null> {
  // 1. Content URI (SAF on Android)
  if (fileUriOrPath.startsWith("content://")) {
    try {
      const base64 = await FileSystem.readAsStringAsync(fileUriOrPath, {
        encoding: "base64" as any,
      });
      if (base64) {
        return base64ToArrayBuffer(base64);
      }
    } catch {
      // fallback
    }
  }

  const cleanPath = fileUriOrPath.replace("file://", "");

  // 2. Try ReactNativeBlobUtil
  try {
    const exists = await ReactNativeBlobUtil.fs.exists(cleanPath);
    if (exists) {
      const base64 = await ReactNativeBlobUtil.fs.readFile(cleanPath, "base64");
      if (base64) {
        return base64ToArrayBuffer(base64);
      }
    }
  } catch {
    // fallback
  }

  // 3. Try fetch
  try {
    const res = await fetch(
      fileUriOrPath.startsWith("file://")
        ? fileUriOrPath
        : `file://${cleanPath}`,
    );
    if (res.ok) {
      return await res.arrayBuffer();
    }
  } catch {
    // fallback
  }

  // 4. Try FileSystem
  try {
    const uri = fileUriOrPath.startsWith("file://")
      ? fileUriOrPath
      : `file://${cleanPath}`;
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: "base64" as any,
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
  folder: "Downloads" | "Documents" | "Scans" | "Books",
  depth: number,
  maxDepth: number,
  visitedDirs: Set<string>,
  discovered: DiscoveredPdfItem[],
): Promise<void> {
  if (depth > maxDepth) return;
  const cleanDir = dirPath.replace(/\/+$/, "");
  if (visitedDirs.has(cleanDir)) return;
  visitedDirs.add(cleanDir);

  try {
    const files = await ReactNativeBlobUtil.fs.ls(cleanDir);
    if (!files || !Array.isArray(files)) return;

    for (const item of files) {
      if (!item || item.startsWith(".")) continue;
      // Skip system, trash, and thumbnail folders
      if (
        item === "lost+found" ||
        item === ".trashed" ||
        item === "thumbnails" ||
        item.toLowerCase().includes("cache")
      ) {
        continue;
      }

      const fullPath = `${cleanDir}/${item}`;
      if (/\/Android\/(data|obb)(\/|$)/i.test(fullPath)) continue;

      const childFolder =
        depth === 1
          ? /download/i.test(item)
            ? "Downloads"
            : /book/i.test(item)
              ? "Books"
              : /scan/i.test(item)
                ? "Scans"
                : folder
          : folder;
      try {
        const itemIsDir = await ReactNativeBlobUtil.fs.isDir(fullPath);
        if (itemIsDir) {
          // Recurse into subfolder (e.g. Documents/Documents)
          await scanDirectoryRecursive(
            fullPath,
            childFolder,
            depth + 1,
            maxDepth,
            visitedDirs,
            discovered,
          );
        } else if (item.toLowerCase().endsWith(".pdf")) {
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
          if (!realName || isJunkDocument(realName, fileUri)) {
            continue;
          }

          // Deduplication: check if already discovered by canonical URI or by name + size
          const isDuplicate = discovered.some(
            (d) =>
              d.uri === fileUri ||
              (d.name.toLowerCase() === realName.toLowerCase() &&
                Math.abs(d.size - size) < 1024),
          );
          if (isDuplicate) continue;

          registerKnownPdfName(fileUri, realName);

          let pageCount = 1;
          try {
            const bytes = await readNativePdfBytes(fileUri);
            if (bytes) {
              const info = await extractPdfInfoFromBytesAsync(bytes);
              if (info.pageCount && info.pageCount > 0) {
                pageCount = info.pageCount;
              }
            }
          } catch {}

          discovered.push({
            id: `native-${fullPath}`,
            name: realName,
            size,
            uri: fileUri,
            lastModified,
            folder,
            pageCount,
          });
        }
      } catch {
        // Individual item read error, continue
      }
    }
  } catch {
    // Directory listing failed or not permitted, continue
  }
}

/**
 * Automatically scans device filesystem for authentic user PDF documents.
 * Discovers PDFs in Downloads, Documents, nested subfolders (e.g. Documents/Documents), SDCard, and app storage.
 * Explicitly ignores internal temp cache directories and purges legacy junk files.
 */
export async function autoScanDevicePdfs(): Promise<DiscoveredPdfItem[]> {
  const discovered: DiscoveredPdfItem[] = [];
  const visitedDirs = new Set<string>();

  try {
    // Scan via a previously selected StorageAccessFramework directory
    const savedSafUri = await getSavedSafDirectoryUri();
    if (savedSafUri) {
      await scanSafDirectory(savedSafUri, discovered);
    }

    // Scan shared storage only after Android grants all-files access.
    if (Platform.OS === "android" && (await hasAllFilesAccess())) {
      const rootCandidates: Array<{
        path: string;
        folder: "Downloads" | "Documents" | "Scans" | "Books";
      }> = [];

      try {
        const fsDirs = ReactNativeBlobUtil.fs.dirs;
        if ((fsDirs as any).LegacyDownloadDir) {
          rootCandidates.push({
            path: (fsDirs as any).LegacyDownloadDir,
            folder: "Downloads",
          });
        }
        if ((fsDirs as any).LegacySDCardDir) {
          rootCandidates.push({
            path: `${(fsDirs as any).LegacySDCardDir}/Documents`,
            folder: "Documents",
          });
          rootCandidates.push({
            path: `${(fsDirs as any).LegacySDCardDir}/Documents/Documents`,
            folder: "Documents",
          });
          rootCandidates.push({
            path: `${(fsDirs as any).LegacySDCardDir}/Download`,
            folder: "Downloads",
          });
          rootCandidates.push({
            path: `${(fsDirs as any).LegacySDCardDir}/Downloads`,
            folder: "Downloads",
          });
          rootCandidates.push({
            path: `${(fsDirs as any).LegacySDCardDir}/PDF`,
            folder: "Documents",
          });
          rootCandidates.push({
            path: `${(fsDirs as any).LegacySDCardDir}/Books`,
            folder: "Books",
          });
        }
      } catch {
        // ignore
      }

      // Explicit Android mount points
      rootCandidates.push({ path: "/storage/emulated/0", folder: "Documents" });
      rootCandidates.push({
        path: "/storage/emulated/0/Documents/Documents",
        folder: "Documents",
      });
      rootCandidates.push({
        path: "/storage/emulated/0/Documents",
        folder: "Documents",
      });
      rootCandidates.push({
        path: "/storage/emulated/0/Download/Documents",
        folder: "Documents",
      });
      rootCandidates.push({
        path: "/storage/emulated/0/Download",
        folder: "Downloads",
      });
      rootCandidates.push({
        path: "/storage/emulated/0/Downloads",
        folder: "Downloads",
      });
      rootCandidates.push({
        path: "/storage/emulated/0/PDF",
        folder: "Documents",
      });
      rootCandidates.push({
        path: "/storage/emulated/0/Books",
        folder: "Books",
      });
      rootCandidates.push({
        path: "/sdcard/Documents/Documents",
        folder: "Documents",
      });
      rootCandidates.push({ path: "/sdcard/Documents", folder: "Documents" });
      rootCandidates.push({ path: "/sdcard/Download", folder: "Downloads" });
      rootCandidates.push({ path: "/sdcard/Downloads", folder: "Downloads" });

      for (const { path, folder } of rootCandidates) {
        if (!path) continue;
        await scanDirectoryRecursive(
          path,
          folder,
          1,
          32,
          visitedDirs,
          discovered,
        );
      }
    }

    // Scan permanent app document storage for non-temporary user PDF files
    // NOTE: PURGE ANY LEGACY JUNK FILES (expo-file, Document.pdf, device-pdf) from disk!
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
          )
            continue;

          // PURGE LEGACY JUNK CACHE FILES FROM PERMANENT APP STORAGE!
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
            } catch {
              // ignore
            }

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

            let pageCount = 1;
            try {
              const bytes = await readNativePdfBytes(fileUri);
              if (bytes) {
                const info = await extractPdfInfoFromBytesAsync(bytes);
                if (info.pageCount && info.pageCount > 0) {
                  pageCount = info.pageCount;
                }
              }
            } catch {}

            discovered.push({
              id: `app-doc-${file}`,
              name: realName,
              size,
              uri: fileUri,
              lastModified,
              folder: "Documents",
              pageCount,
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
    let buffer: ArrayBuffer | null = null;

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

    if (!buffer) {
      throw new Error(
        "Unable to read selected PDF file data from native device",
      );
    }

    // Copy to permanent documentDirectory under its real authentic filename
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
    if (buffer) {
      const info = await extractPdfInfoFromBytesAsync(buffer);
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
    console.warn("Native scan error:", err);
    return [];
  }
}
