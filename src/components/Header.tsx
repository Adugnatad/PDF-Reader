import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";

export interface HeaderProps {
  title?: string;
  onBack?: () => void;
  showBack?: boolean;
  onShowToast: (msg: string) => void;
  onOpenFileFromDevice?: () => void;
  onOpenSystemViewer?: () => void;
  // Primary top buttons for PDF Reader:
  onRotateHorizontal?: () => void;
  isHorizontal?: boolean;
  onShare?: () => void;
  onPrint?: () => void;
  theme?: "light" | "night" | "sepia";
  onToggleTheme?: () => void;
  // Secondary options & Page counter:
  currentPage?: number;
  numPages?: number;
  searchOpen?: boolean;
  onToggleSearch?: () => void;
  showThumbnails?: boolean;
  onToggleThumbnails?: () => void;
  isBookmarked?: boolean;
  onToggleBookmark?: () => void;
  onOpenViewMode?: () => void;
  onRotate?: () => void;
  onDownload?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title = "Document Reader",
  onBack,
  showBack = true,
  onShowToast,
  onOpenFileFromDevice,
  onOpenSystemViewer,
  onRotateHorizontal,
  isHorizontal = false,
  onShare,
  onPrint,
  theme = "night",
  onToggleTheme,
  currentPage,
  numPages,
  searchOpen,
  onToggleSearch,
  showThumbnails,
  onToggleThumbnails,
  isBookmarked,
  onToggleBookmark,
  onOpenViewMode,
  onRotate,
  onDownload,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const isLight = theme === "light";
  const isNight = theme === "night";

  return (
    <View
      style={[styles.headerContainer, isLight && styles.headerContainerLight]}
    >
      <View style={styles.innerRow}>
        {/* Left Section: Back button & Title with Page Counter */}
        <View style={styles.leftGroup}>
          {showBack && (
            <TouchableOpacity
              accessibilityLabel="Go back"
              onPress={onBack}
              style={[styles.iconButton, isLight && styles.iconButtonLight]}
              activeOpacity={0.7}
            >
              <Ionicons
                name="arrow-back"
                size={20}
                color={isLight ? "#334155" : "#c7c4d7"}
              />
            </TouchableOpacity>
          )}

          <View style={styles.titleWrapper}>
            {/* <Text
              style={[styles.titleText, isLight && styles.titleTextLight]}
              numberOfLines={1}
            >
              {title}
            </Text> */}
            {/* {currentPage && numPages ? (
              <View
                style={[
                  styles.pageCountBadge,
                  isLight && styles.pageCountBadgeLight,
                ]}
              >
                <Text
                  style={[
                    styles.pageCountText,
                    isLight && styles.pageCountTextLight,
                  ]}
                >
                  {currentPage}/{numPages}
                </Text>
              </View>
            ) : null} */}
          </View>
        </View>

        {/* Right Section: Top Options Toolbar */}
        <View style={styles.rightGroup}>
          {/* 1. Button for rotating the screen horizontal */}
          {onRotateHorizontal && (
            <TouchableOpacity
              accessibilityLabel={
                isHorizontal
                  ? "Rotate screen to portrait"
                  : "Rotate screen to landscape"
              }
              onPress={onRotateHorizontal}
              style={[
                styles.iconButton,
                isLight && styles.iconButtonLight,
                isHorizontal && styles.iconButtonActive,
              ]}
              activeOpacity={0.7}
            >
              <MaterialIcons
                name="screen-rotation"
                size={20}
                color={isLight ? "#000" : "#c7c4d7"}
              />
            </TouchableOpacity>
          )}

          {/* 2. Share button */}
          {onShare && (
            <TouchableOpacity
              accessibilityLabel="Share document"
              onPress={onShare}
              style={[styles.iconButton, isLight && styles.iconButtonLight]}
              activeOpacity={0.7}
            >
              <Ionicons
                name="share-social-outline"
                size={20}
                color={isLight ? "#000" : "#c7c4d7"}
              />
            </TouchableOpacity>
          )}

          {/* 3. Print button */}
          {onPrint && (
            <TouchableOpacity
              accessibilityLabel="Print document"
              onPress={onPrint}
              style={[styles.iconButton, isLight && styles.iconButtonLight]}
              activeOpacity={0.7}
            >
              <Ionicons
                name="print-outline"
                size={20}
                color={isLight ? "#000" : "#c7c4d7"}
              />
            </TouchableOpacity>
          )}

          {/* 4. Light and Dark mode switching button */}
          {onToggleTheme && (
            <TouchableOpacity
              accessibilityLabel={
                isNight ? "Switch to light mode" : "Switch to dark mode"
              }
              onPress={onToggleTheme}
              style={[
                styles.iconButton,
                isLight && styles.iconButtonLight,
                isNight && styles.iconButtonDarkActive,
              ]}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isNight ? "sunny" : "moon"}
                size={20}
                color={isLight ? "#000" : "#dae2fd"}
              />
            </TouchableOpacity>
          )}

          {/* Overflow 3-dots Menu for secondary actions */}
          <TouchableOpacity
            accessibilityLabel="More options"
            onPress={() => setMenuOpen(!menuOpen)}
            style={[
              styles.iconButton,
              isLight && styles.iconButtonLight,
              menuOpen && styles.iconButtonActive,
            ]}
            activeOpacity={0.7}
          >
            <Ionicons
              name="ellipsis-vertical"
              size={18}
              color={menuOpen ? "#0d0096" : isLight ? "#000" : "#c7c4d7"}
            />
          </TouchableOpacity>

          {/* Dropdown Menu */}
          {menuOpen && (
            <View
              style={[styles.dropdownMenu, isLight && styles.dropdownMenuLight]}
            >
              {onToggleSearch && (
                <TouchableOpacity
                  onPress={() => {
                    setMenuOpen(false);
                    onToggleSearch();
                  }}
                  style={styles.dropdownItem}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="search-outline"
                    size={16}
                    color={isLight ? "#2563eb" : "#7bd0ff"}
                  />
                  <Text
                    style={[
                      styles.dropdownText,
                      isLight && styles.dropdownTextLight,
                    ]}
                  >
                    {searchOpen ? "Close Search" : "Find in Document"}
                  </Text>
                </TouchableOpacity>
              )}

              {onToggleThumbnails && (
                <TouchableOpacity
                  onPress={() => {
                    setMenuOpen(false);
                    onToggleThumbnails();
                  }}
                  style={styles.dropdownItem}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="grid-outline"
                    size={16}
                    color={isLight ? "#2563eb" : "#7bd0ff"}
                  />
                  <Text
                    style={[
                      styles.dropdownText,
                      isLight && styles.dropdownTextLight,
                    ]}
                  >
                    {showThumbnails ? "Hide Thumbnails" : "Page Thumbnails"}
                  </Text>
                </TouchableOpacity>
              )}

              {onToggleBookmark && (
                <TouchableOpacity
                  onPress={() => {
                    setMenuOpen(false);
                    onToggleBookmark();
                  }}
                  style={styles.dropdownItem}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={isBookmarked ? "bookmark" : "bookmark-outline"}
                    size={16}
                    color="#f59e0b"
                  />
                  <Text
                    style={[
                      styles.dropdownText,
                      isLight && styles.dropdownTextLight,
                    ]}
                  >
                    {isBookmarked ? "Remove Bookmark" : "Bookmark Page"}
                  </Text>
                </TouchableOpacity>
              )}

              {onOpenViewMode && (
                <TouchableOpacity
                  onPress={() => {
                    setMenuOpen(false);
                    onOpenViewMode();
                  }}
                  style={styles.dropdownItem}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="options-outline"
                    size={16}
                    color={isLight ? "#2563eb" : "#7bd0ff"}
                  />
                  <Text
                    style={[
                      styles.dropdownText,
                      isLight && styles.dropdownTextLight,
                    ]}
                  >
                    Reading & Layout Settings
                  </Text>
                </TouchableOpacity>
              )}

              {onRotate && (
                <TouchableOpacity
                  onPress={() => {
                    setMenuOpen(false);
                    onRotate();
                  }}
                  style={styles.dropdownItem}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="reload-outline"
                    size={16}
                    color={isLight ? "#2563eb" : "#7bd0ff"}
                  />
                  <Text
                    style={[
                      styles.dropdownText,
                      isLight && styles.dropdownTextLight,
                    ]}
                  >
                    Rotate Page (90°)
                  </Text>
                </TouchableOpacity>
              )}

              {onDownload && (
                <TouchableOpacity
                  onPress={() => {
                    setMenuOpen(false);
                    onDownload();
                  }}
                  style={styles.dropdownItem}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="download-outline"
                    size={16}
                    color={isLight ? "#2563eb" : "#7bd0ff"}
                  />
                  <Text
                    style={[
                      styles.dropdownText,
                      isLight && styles.dropdownTextLight,
                    ]}
                  >
                    Export / Download
                  </Text>
                </TouchableOpacity>
              )}

              {onOpenSystemViewer && (
                <TouchableOpacity
                  onPress={() => {
                    setMenuOpen(false);
                    onOpenSystemViewer();
                  }}
                  style={styles.dropdownItem}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="open-outline"
                    size={16}
                    color={isLight ? "#2563eb" : "#7bd0ff"}
                  />
                  <Text
                    style={[
                      styles.dropdownText,
                      isLight && styles.dropdownTextLight,
                    ]}
                  >
                    Open in System Reader
                  </Text>
                </TouchableOpacity>
              )}

              {onOpenFileFromDevice && (
                <TouchableOpacity
                  onPress={() => {
                    setMenuOpen(false);
                    onOpenFileFromDevice();
                  }}
                  style={styles.dropdownItem}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="folder-open-outline"
                    size={16}
                    color={isLight ? "#2563eb" : "#7bd0ff"}
                  />
                  <Text
                    style={[
                      styles.dropdownText,
                      isLight && styles.dropdownTextLight,
                    ]}
                  >
                    Open Other PDF
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: "rgba(11, 19, 38, 0.96)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(45, 52, 73, 0.6)",
    zIndex: 50,
  },
  headerContainerLight: {
    backgroundColor: "#ffffff",
    borderBottomColor: "#e2e8f0",
  },
  innerRow: {
    minHeight: 56,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    maxWidth: 960,
    width: "100%",
    alignSelf: "center",
    gap: 6,
  },
  leftGroup: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
    marginRight: 6,
  },
  titleWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
  },
  iconButton: {
    width: 36,
    height: 36,
    // borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
    // borderWidth: 1,
    // borderColor: "rgba(45, 52, 73, 0.5)",
  },
  iconButtonLight: {},
  iconButtonActive: {},
  iconButtonDarkActive: {},
  titleText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#dae2fd",
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  titleTextLight: {
    color: "#0f172a",
  },
  pageCountBadge: {
    backgroundColor: "#171f33",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#2d3449",
  },
  pageCountBadgeLight: {
    backgroundColor: "#f1f5f9",
    borderColor: "#cbd5e1",
  },
  pageCountText: {
    color: "#7bd0ff",
    fontSize: 11,
    fontWeight: "700",
  },
  pageCountTextLight: {
    color: "#2563eb",
  },
  rightGroup: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
    flexShrink: 0,
  },
  dropdownMenu: {
    position: "absolute",
    top: 44,
    right: 0,
    width: 230,
    backgroundColor: "#171f33",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2d3449",
    paddingVertical: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 10,
    zIndex: 100,
  },
  dropdownMenuLight: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    shadowOpacity: 0.15,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  dropdownText: {
    color: "#dae2fd",
    fontSize: 13,
  },
  dropdownTextLight: {
    color: "#0f172a",
  },
});
