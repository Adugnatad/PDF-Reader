import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  Alert,
  AppState,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Modal,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { DocFile } from "../types";
import { pdfStore } from "../services/pdfStore";
import {
  pickPdfFromDevice,
  promptAndScanDeviceStorage,
  hasAllFilesAccess,
  openAllFilesAccessSettings,
} from "../services/nativeFilePicker";
import { isUuidOrHash, resolvePdfDisplayName } from "../utils/pdfNameResolver";
import { PdfThumbnailPreview } from "./PdfThumbnailPreview";

interface FilesHomeScreenProps {
  files: DocFile[];
  onOpenFile: (file: DocFile) => void;
  onShowToast: (msg: string) => void;
}

export const FilesHomeScreen: React.FC<FilesHomeScreenProps> = ({
  files,
  onOpenFile,
  onShowToast,
}) => {
  const [deviceFiles, setDeviceFiles] = useState<DocFile[]>(files);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "name" | "size" | "pages">(
    "date",
  );
  const [sortAsc, setSortAsc] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState<
    "document" | "recent" | "favorite"
  >("document");
  const [isScanning, setIsScanning] = useState(false);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editingFileName, setEditingFileName] = useState("");
  const accessSettingsOpenedRef = React.useRef(false);

  // Sync with prop changes
  React.useEffect(() => {
    setDeviceFiles(files);
  }, [files]);

  // Subscribe to updates; restore files from the persisted registry without rescanning.
  React.useEffect(() => {
    pdfStore.prewarmAllPdfs();
    const unsub = pdfStore.subscribe(() => {
      setDeviceFiles(pdfStore.getAllFiles());
    });

    return unsub;
  }, []);

  React.useEffect(() => {
    if (Platform.OS !== "android" || Number(Platform.Version) < 30) return;

    const scanOnceIfAccessGranted = async () => {
      if (!(await hasAllFilesAccess())) return;

      setIsScanning(true);
      try {
        const timeoutPromise = new Promise<void>((resolve) =>
          setTimeout(resolve, 8000),
        );
        await Promise.race([
          pdfStore.scanDeviceOnceAfterPermission(),
          timeoutPromise,
        ]);
        setDeviceFiles(pdfStore.getAllFiles());
      } catch (error) {
        console.warn("Could not perform initial device scan:", error);
      } finally {
        setIsScanning(false);
      }
    };

    const requestAccessOnLaunch = async () => {
      if (accessSettingsOpenedRef.current || (await hasAllFilesAccess()))
        return;
      accessSettingsOpenedRef.current = true;
      Alert.alert(
        "Allow access to your files",
        "DocuFlow needs all-files access to find PDFs stored on your device. You can allow it on the next screen.",
        [
          { text: "Not now", style: "cancel" },
          {
            text: "Continue",
            onPress: () => {
              openAllFilesAccessSettings().catch((error) => {
                console.warn(
                  "Could not open all-files access settings:",
                  error,
                );
              });
            },
          },
        ],
      );
    };

    scanOnceIfAccessGranted().catch((error) => {
      console.warn("Could not check file access:", error);
    });
    requestAccessOnLaunch().catch((error) => {
      console.warn("Could not open all-files access settings:", error);
    });
  }, []);

  React.useEffect(() => {
    if (Platform.OS !== "android") return;
    const subscription = AppState.addEventListener("change", async (state) => {
      if (state !== "active" || Number(Platform.Version) < 30) return;
      try {
        if (!(await hasAllFilesAccess())) return;
        setIsScanning(true);
        await pdfStore.scanDeviceOnceAfterPermission();
        setDeviceFiles(pdfStore.getAllFiles());
      } catch (error) {
        console.warn("Could not scan after file access was granted:", error);
      } finally {
        setIsScanning(false);
      }
    });
    return () => subscription.remove();
  }, []);

  // Load PDF file from device (iOS / Android / Web)
  const handleOpenDeviceFile = async () => {
    try {
      const picked = await pickPdfFromDevice();
      if (!picked) return;

      onShowToast(`Opening ${picked.name}...`);
      const newDoc = pdfStore.addDevicePdf(
        { name: picked.name, size: picked.size },
        picked.buffer,
        "Documents",
        picked.uri,
      );
      setDeviceFiles(pdfStore.getAllFiles());
      onShowToast(`Opened ${picked.name}`);
      onOpenFile(newDoc);
    } catch (err: any) {
      onShowToast("Could not load PDF: " + (err?.message || "Error"));
    }
  };

  // Scan device storage / filesystem (iOS / Android / Web)
  const handleScanDeviceStorage = async () => {
    setIsScanning(true);

    try {
      onShowToast("Scanning device for PDF documents...");
      const initialCount = pdfStore.getUserFiles().length;

      // 1. Scan device storage automatically
      const timeoutPromise = new Promise<void>((resolve) =>
        setTimeout(resolve, 10000),
      );
      await Promise.race([
        pdfStore.scanDeviceAutomatically(),
        timeoutPromise,
      ]);

      let currentFiles = pdfStore.getAllFiles();

      // 2. If 0 files found on Android, prompt SAF folder picker
      if (currentFiles.length === 0 && Platform.OS === "android") {
        const safItems = await promptAndScanDeviceStorage();
        if (safItems && safItems.length > 0) {
          pdfStore.registerDiscoveredDevicePdfs(safItems);
          currentFiles = pdfStore.getAllFiles();
        }
      }

      setDeviceFiles(currentFiles);

      if (currentFiles.length > initialCount) {
        const diff = currentFiles.length - initialCount;
        onShowToast(
          `Found ${diff} new PDF document${diff === 1 ? "" : "s"} on device`,
        );
      } else if (currentFiles.length > 0) {
        onShowToast(
          `Scan complete: ${currentFiles.length} document${currentFiles.length === 1 ? "" : "s"} ready`,
        );
      } else {
        onShowToast("No PDF documents found on device");
      }
    } catch (err: any) {
      console.warn("Scan note:", err);
      onShowToast("Device scan completed");
    } finally {
      setIsScanning(false);
    }
  };

  const handleCardPress = (file: DocFile, displayName: string) => {
    pdfStore.recordFileOpened(file.id);
    onOpenFile({ ...file, name: displayName });
  };

  // Toggle favorite
  const handleToggleFavorite = (fileId: string, e: any) => {
    e.stopPropagation?.();
    const newFav = pdfStore.toggleFavorite(fileId);
    setDeviceFiles(pdfStore.getAllFiles());
    onShowToast(newFav ? "Added to favorites" : "Removed from favorites");
  };

  // Remove file from recent documents
  const handleDeleteFile = (fileId: string, fileName: string, e: any) => {
    e.stopPropagation?.();
    pdfStore.deleteDeviceFile(fileId);
    setDeviceFiles(pdfStore.getAllFiles());
    onShowToast(`Removed ${fileName}`);
  };

  // Start renaming a file
  const handleStartRename = (fileId: string, currentName: string, e: any) => {
    e.stopPropagation?.();
    setEditingFileId(fileId);
    setEditingFileName(currentName.replace(/\.pdf$/i, ""));
    setRenameModalVisible(true);
  };

  // Save the renamed file
  const handleConfirmRename = () => {
    if (!editingFileId || !editingFileName.trim()) return;
    const clean = editingFileName.trim();
    const ok = pdfStore.renameDocument(editingFileId, clean);
    if (ok) {
      setDeviceFiles(pdfStore.getAllFiles());
      onShowToast(`Renamed to ${clean}.pdf`);
    }
    setRenameModalVisible(false);
    setEditingFileId(null);
  };

  // Filtered and sorted PDFs
  const filteredFiles = useMemo(() => {
    let list = deviceFiles;

    // Filter based on active bottom tab
    if (activeBottomTab === "favorite") {
      list = list.filter((f) => f.favorite);
    } else if (activeBottomTab === "recent") {
      // For Recent tab: prioritize files opened recently, then fallback to newest
      list = [...list].sort((a, b) => {
        const timeA = a.lastOpenedAt || 0;
        const timeB = b.lastOpenedAt || 0;
        if (timeA !== timeB) return timeB - timeA;
        return b.id.localeCompare(a.id);
      });
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((file) => file.name.toLowerCase().includes(q));
    }

    if (activeBottomTab !== "recent" || sortBy !== "date") {
      list = [...list].sort((a, b) => {
        if (sortBy === "name") {
          return sortAsc
            ? a.name.localeCompare(b.name)
            : b.name.localeCompare(a.name);
        }
        if (sortBy === "size") {
          const sizeA = parseFloat(a.size) || 0;
          const sizeB = parseFloat(b.size) || 0;
          return sortAsc ? sizeA - sizeB : sizeB - sizeA;
        }
        if (sortBy === "pages") {
          const pA = a.pageCount || 0;
          const pB = b.pageCount || 0;
          return sortAsc ? pA - pB : pB - pA;
        }
        // Default date modified
        return sortAsc ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id);
      });
    }

    return list;
  }, [deviceFiles, searchQuery, sortBy, sortAsc, activeBottomTab]);

  const getHeaderTitle = () => {
    switch (activeBottomTab) {
      case "recent":
        return "Recent";
      case "favorite":
        return "Favorites";
      case "document":
      default:
        return "Documents";
    }
  };

  const getHeaderSubtitle = () => {
    const count = filteredFiles.length;
    const label = count === 1 ? "document" : "documents";
    switch (activeBottomTab) {
      case "recent":
        return `${count} recent ${label}`;
      case "favorite":
        return `${count} favorite ${label}`;
      case "document":
      default:
        return `${count} ${label} on device`;
    }
  };

  return (
    <View style={styles.rootContainer}>
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Top Header */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <View style={styles.titleGroup}>
              <View style={styles.appIconBadge}>
                <MaterialIcons name="picture-as-pdf" size={22} color="#ff516a" />
              </View>
              <View>
                <Text style={styles.headerTitle}>{getHeaderTitle()}</Text>
                <Text style={styles.headerSubtitle}>{getHeaderSubtitle()}</Text>
              </View>
            </View>

          {/* Header Quick Actions */}
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.scanBtn}
              onPress={handleScanDeviceStorage}
              activeOpacity={0.75}
              accessibilityLabel="Scan Device"
            >
              <Ionicons
                name={isScanning ? "sync" : "scan-outline"}
                size={16}
                color="#7bd0ff"
              />
              <Text style={styles.scanBtnText}>
                {isScanning ? "Scanning..." : "Scan Device"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.openDeviceBtn}
              onPress={handleOpenDeviceFile}
              activeOpacity={0.75}
              accessibilityLabel="Open PDF File"
            >
              <Ionicons name="folder-open-outline" size={16} color="#0d0096" />
              <Text style={styles.openDeviceBtnText}>Open File</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Ionicons
            name="search"
            size={18}
            color="#908fa0"
            style={styles.searchIcon}
          />
          <TextInput
            placeholder="Search PDF documents..."
            placeholderTextColor="#908fa0"
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
          />
          {searchQuery ? (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              style={styles.clearSearchBtn}
            >
              <Ionicons name="close" size={18} color="#908fa0" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Main Files List Content */}
      <View style={styles.mainContent}>
        {/* Controls Bar */}
        <View style={styles.controlsBar}>
          <View style={styles.fileCountGroup}>
            <Text style={styles.sectionHeading}>All PDFs</Text>
            <Text style={styles.fileCountBadge}>({filteredFiles.length})</Text>
          </View>

          {/* Sort Button & Dropdown */}
          <View style={styles.sortContainer}>
            <TouchableOpacity
              onPress={() => setShowSortMenu(!showSortMenu)}
              style={styles.sortButton}
              activeOpacity={0.7}
            >
              <Ionicons
                name="swap-vertical-outline"
                size={15}
                color="#c7c4d7"
              />
              <Text style={styles.sortButtonText}>
                {sortBy === "date"
                  ? "Date Modified"
                  : sortBy === "name"
                    ? "Name (A-Z)"
                    : sortBy === "size"
                      ? "File Size"
                      : "Page Count"}
              </Text>
            </TouchableOpacity>

            {showSortMenu && (
              <View style={styles.sortDropdown}>
                <TouchableOpacity
                  onPress={() => {
                    setSortBy("date");
                    setSortAsc(!sortAsc);
                    setShowSortMenu(false);
                    onShowToast("Sorted by Date Modified");
                  }}
                  style={styles.sortItem}
                >
                  <Text style={styles.sortItemText}>Date Modified</Text>
                  {sortBy === "date" && (
                    <Ionicons
                      name={sortAsc ? "chevron-up" : "chevron-down"}
                      size={14}
                      color="#7bd0ff"
                    />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setSortBy("name");
                    setSortAsc(!sortAsc);
                    setShowSortMenu(false);
                    onShowToast("Sorted by Name");
                  }}
                  style={styles.sortItem}
                >
                  <Text style={styles.sortItemText}>Name (A-Z)</Text>
                  {sortBy === "name" && (
                    <Ionicons
                      name={sortAsc ? "chevron-up" : "chevron-down"}
                      size={14}
                      color="#7bd0ff"
                    />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setSortBy("size");
                    setSortAsc(!sortAsc);
                    setShowSortMenu(false);
                    onShowToast("Sorted by File Size");
                  }}
                  style={styles.sortItem}
                >
                  <Text style={styles.sortItemText}>File Size</Text>
                  {sortBy === "size" && (
                    <Ionicons
                      name={sortAsc ? "chevron-up" : "chevron-down"}
                      size={14}
                      color="#7bd0ff"
                    />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setSortBy("pages");
                    setSortAsc(!sortAsc);
                    setShowSortMenu(false);
                    onShowToast("Sorted by Page Count");
                  }}
                  style={styles.sortItem}
                >
                  <Text style={styles.sortItemText}>Page Count</Text>
                  {sortBy === "pages" && (
                    <Ionicons
                      name={sortAsc ? "chevron-up" : "chevron-down"}
                      size={14}
                      color="#7bd0ff"
                    />
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* PDF Documents List */}
        <View style={styles.filesList}>
          {filteredFiles.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View
                style={[
                  styles.emptyIconCircle,
                  activeBottomTab === "favorite" && {
                    backgroundColor: "rgba(245, 158, 11, 0.15)",
                    borderColor: "rgba(245, 158, 11, 0.3)",
                  },
                ]}
              >
                <Ionicons
                  name={
                    activeBottomTab === "favorite"
                      ? "star-outline"
                      : activeBottomTab === "recent"
                      ? "time-outline"
                      : "document-text-outline"
                  }
                  size={42}
                  color={activeBottomTab === "favorite" ? "#f59e0b" : "#7bd0ff"}
                />
              </View>
              <Text style={styles.emptyTitle}>
                {searchQuery
                  ? "No matching documents"
                  : activeBottomTab === "favorite"
                  ? "No favorite documents"
                  : activeBottomTab === "recent"
                  ? "No recent documents"
                  : "No PDF documents"}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? `No documents matching "${searchQuery}"`
                  : activeBottomTab === "favorite"
                  ? "Tap the star icon on any PDF document card to add it to your favorites."
                  : activeBottomTab === "recent"
                  ? "Documents you open will appear here for fast access."
                  : "Open any PDF from your device storage to read with smooth full-screen view, zoom, and annotations."}
              </Text>
              {searchQuery ? (
                <TouchableOpacity
                  onPress={() => setSearchQuery("")}
                  style={styles.emptyActionBtn}
                >
                  <Text style={styles.emptyActionBtnText}>Clear Search</Text>
                </TouchableOpacity>
              ) : activeBottomTab !== "document" ? (
                <TouchableOpacity
                  onPress={() => setActiveBottomTab("document")}
                  style={styles.emptyActionPrimaryBtn}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="document-text-outline"
                    size={17}
                    color="#0d0096"
                  />
                  <Text style={styles.emptyActionPrimaryBtnText}>
                    Browse Documents
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={handleOpenDeviceFile}
                  style={styles.emptyActionPrimaryBtn}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="folder-open-outline"
                    size={17}
                    color="#0d0096"
                  />
                  <Text style={styles.emptyActionPrimaryBtnText}>
                    Open PDF from Device
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            filteredFiles.map((file) => {
              const displayName = isUuidOrHash(file.name)
                ? resolvePdfDisplayName(
                    file.name,
                    pdfStore.getNativeUri(file.id),
                    undefined,
                  ).name
                : file.name;

              return (
                <TouchableOpacity
                  key={file.id}
                  onPress={() => handleCardPress(file, displayName)}
                  onPressIn={() => pdfStore.prewarmPdf(file.id)}
                  style={styles.fileCard}
                  activeOpacity={0.7}
                >
                  {/* Real PDF Document Page Preview */}
                  <PdfThumbnailPreview
                    fileId={file.id}
                    fileName={displayName}
                  />

                  {/* Document Information */}
                  <View style={styles.fileDetails}>
                    <Text style={styles.fileName} numberOfLines={1}>
                      {displayName}
                    </Text>
                    <View style={styles.metaRow}>
                      <Text style={styles.metaText}>
                        {file.pageCount === 1
                          ? "1 page"
                          : `${file.pageCount || 1} pages`}
                      </Text>
                      <Text style={styles.metaDot}>•</Text>
                      <Text style={styles.metaText}>{file.size}</Text>
                      <Text style={styles.metaDot}>•</Text>
                      <Text style={styles.metaText}>{file.modified}</Text>
                    </View>
                  </View>

                  {/* Star / Favorite Button */}
                  <TouchableOpacity
                    onPress={(e) => handleToggleFavorite(file.id, e)}
                    style={styles.starBtn}
                    accessibilityLabel="Toggle Favorite"
                  >
                    <Ionicons
                      name={file.favorite ? "star" : "star-outline"}
                      size={18}
                      color={file.favorite ? "#f59e0b" : "#64748b"}
                    />
                  </TouchableOpacity>

                  {/* Rename File Button */}
                  <TouchableOpacity
                    onPress={(e) => handleStartRename(file.id, displayName, e)}
                    style={styles.renameBtn}
                    accessibilityLabel="Rename Document"
                  >
                    <MaterialIcons name="edit" size={17} color="#64748b" />
                  </TouchableOpacity>

                  {/* Remove / Delete File Button */}
                  <TouchableOpacity
                    onPress={(e) => handleDeleteFile(file.id, file.name, e)}
                    style={styles.deleteFileBtn}
                    accessibilityLabel="Remove File"
                  >
                    <Ionicons name="trash-outline" size={16} color="#64748b" />
                  </TouchableOpacity>

                  {/* Chevron Right */}
                  <Ionicons name="chevron-forward" size={18} color="#908fa0" />
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </View>

      {/* Rename Document Modal */}
      <Modal
        visible={renameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.renameCard}>
            <View style={styles.renameHeader}>
              <MaterialIcons name="edit-note" size={24} color="#7bd0ff" />
              <Text style={styles.renameTitle}>Rename Document</Text>
            </View>
            <Text style={styles.renameSubtitle}>
              Enter a new file title for this document.
            </Text>
            <TextInput
              value={editingFileName}
              onChangeText={setEditingFileName}
              placeholder="Document Title"
              placeholderTextColor="#64748b"
              style={styles.renameInput}
              autoFocus
              selectTextOnFocus
              onSubmitEditing={handleConfirmRename}
            />
            <View style={styles.renameActions}>
              <TouchableOpacity
                onPress={() => setRenameModalVisible(false)}
                style={styles.renameCancelBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.renameCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirmRename}
                style={styles.renameSaveBtn}
                activeOpacity={0.8}
              >
                <Text style={styles.renameSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      </ScrollView>

      {/* Bottom Navigation Tab Bar (Document, Recent, Favorite) */}
      <View style={styles.bottomTabBar}>
        {/* Document Tab */}
        <TouchableOpacity
          onPress={() => setActiveBottomTab("document")}
          style={styles.tabBtn}
          activeOpacity={0.7}
          accessibilityLabel="Document Tab"
        >
          <Ionicons
            name={
              activeBottomTab === "document"
                ? "document-text"
                : "document-text-outline"
            }
            size={22}
            color={activeBottomTab === "document" ? "#ff516a" : "#8e9ba0"}
          />
          <Text
            style={[
              styles.tabLabel,
              activeBottomTab === "document" && styles.tabLabelActive,
            ]}
          >
            Document
          </Text>
        </TouchableOpacity>

        {/* Recent Tab */}
        <TouchableOpacity
          onPress={() => setActiveBottomTab("recent")}
          style={styles.tabBtn}
          activeOpacity={0.7}
          accessibilityLabel="Recent Tab"
        >
          <Ionicons
            name={activeBottomTab === "recent" ? "time" : "time-outline"}
            size={22}
            color={activeBottomTab === "recent" ? "#ff516a" : "#8e9ba0"}
          />
          <Text
            style={[
              styles.tabLabel,
              activeBottomTab === "recent" && styles.tabLabelActive,
            ]}
          >
            Recent
          </Text>
        </TouchableOpacity>

        {/* Favorite Tab */}
        <TouchableOpacity
          onPress={() => setActiveBottomTab("favorite")}
          style={styles.tabBtn}
          activeOpacity={0.7}
          accessibilityLabel="Favorite Tab"
        >
          <Ionicons
            name={activeBottomTab === "favorite" ? "star" : "star-outline"}
            size={22}
            color={activeBottomTab === "favorite" ? "#ff516a" : "#8e9ba0"}
          />
          <Text
            style={[
              styles.tabLabel,
              activeBottomTab === "favorite" && styles.tabLabelActive,
            ]}
          >
            Favorite
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: "#0b1326",
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: "#0b1326",
  },
  container: {
    flex: 1,
    backgroundColor: "#0b1326",
  },
  scrollContent: {
    paddingBottom: 24,
  },
  bottomTabBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "#0e1628",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
    paddingVertical: 8,
    paddingBottom: Platform.OS === "ios" ? 22 : 8,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#8e9ba0",
    marginTop: 3,
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    color: "#ff516a",
    fontWeight: "700",
  },
  header: {
    backgroundColor: "rgba(11, 19, 38, 0.95)",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(45, 52, 73, 0.4)",
  },
  titleRow: {
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  titleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  appIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "rgba(255, 81, 106, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 81, 106, 0.3)",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    color: "#908fa0",
    marginTop: 1,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  scanBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#17223b",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#263554",
  },
  scanBtnText: {
    color: "#7bd0ff",
    fontSize: 11,
    fontWeight: "700",
  },
  openDeviceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#7bd0ff",
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 8,
  },
  openDeviceBtnText: {
    color: "#0d0096",
    fontSize: 11,
    fontWeight: "700",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#171f33",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2d3449",
    paddingHorizontal: 12,
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#dae2fd",
    outlineStyle: "none" as any,
  },
  clearSearchBtn: {
    padding: 4,
  },
  mainContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  controlsBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  fileCountGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: "700",
    color: "#dae2fd",
  },
  fileCountBadge: {
    fontSize: 12,
    color: "#908fa0",
  },
  sortContainer: {
    position: "relative",
  },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#171f33",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#2d3449",
  },
  sortButtonText: {
    fontSize: 11,
    color: "#c7c4d7",
    fontWeight: "500",
  },
  sortDropdown: {
    position: "absolute",
    top: 32,
    right: 0,
    width: 140,
    backgroundColor: "#171f33",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2d3449",
    paddingVertical: 4,
    zIndex: 100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  sortItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  sortItemText: {
    fontSize: 11,
    color: "#dae2fd",
    fontWeight: "500",
  },
  filesList: {
    gap: 8,
  },
  fileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#131b2e",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#263554",
    gap: 10,
  },
  typeBadge: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#2e1820",
    borderWidth: 1,
    borderColor: "rgba(255, 81, 106, 0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeLabel: {
    fontSize: 8,
    fontWeight: "800",
    color: "#ffb2b7",
    letterSpacing: 0.5,
  },
  badgeIcon: {
    marginTop: 1,
  },
  fileDetails: {
    flex: 1,
  },
  fileName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#dae2fd",
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 5,
  },
  metaText: {
    fontSize: 10.5,
    color: "#908fa0",
  },
  metaDot: {
    fontSize: 10,
    color: "#64748b",
  },
  starBtn: {
    padding: 6,
  },
  deleteFileBtn: {
    padding: 6,
    marginRight: 2,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 56,
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(123, 208, 255, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(123, 208, 255, 0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    color: "#dae2fd",
    fontSize: 17,
    fontWeight: "700",
  },
  emptySubtitle: {
    color: "#908fa0",
    fontSize: 13,
    textAlign: "center",
    maxWidth: 320,
    lineHeight: 18,
  },
  emptyActionBtn: {
    marginTop: 8,
    backgroundColor: "#17223b",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#263554",
  },
  emptyActionBtnText: {
    color: "#7bd0ff",
    fontSize: 12,
    fontWeight: "700",
  },
  emptyActionPrimaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    backgroundColor: "#7bd0ff",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyActionPrimaryBtnText: {
    color: "#0d0096",
    fontSize: 14,
    fontWeight: "800",
  },
  renameBtn: {
    padding: 6,
    borderRadius: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  renameCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#131b2e",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#263554",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  renameHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  renameTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#dae2fd",
  },
  renameSubtitle: {
    fontSize: 13,
    color: "#908fa0",
    marginBottom: 16,
  },
  renameInput: {
    backgroundColor: "#0b1326",
    borderWidth: 1,
    borderColor: "#263554",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: "#dae2fd",
    fontSize: 15,
    marginBottom: 20,
  },
  renameActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  renameCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#1b253b",
  },
  renameCancelText: {
    color: "#c7c4d7",
    fontSize: 14,
    fontWeight: "600",
  },
  renameSaveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#7bd0ff",
  },
  renameSaveText: {
    color: "#0d0096",
    fontSize: 14,
    fontWeight: "700",
  },
});
