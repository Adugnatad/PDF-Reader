import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  TextInput,
  ActivityIndicator,
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
  // View Mode, Reading Direction & Go to Page in 3-dots menu:
  viewMode?: "single" | "continuous";
  onToggleViewMode?: () => void;
  readingDirection?: "horizontal" | "vertical";
  onToggleReadingDirection?: () => void;
  onOpenGoToPage?: () => void;
  // Dedicated Search Header controls:
  searchQuery?: string;
  onSearchQueryChange?: (q: string) => void;
  onSearchSubmit?: () => void;
  onClearSearch?: () => void;
  onCloseSearch?: () => void;
  isSearching?: boolean;
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
  viewMode = "single",
  onToggleViewMode,
  readingDirection = "vertical",
  onToggleReadingDirection,
  onOpenGoToPage,
  searchQuery = "",
  onSearchQueryChange,
  onSearchSubmit,
  onClearSearch,
  onCloseSearch,
  isSearching = false,
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
          {/* 2. Button for rotating the screen horizontal */}
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
              {/* 1. Toggle Page by Page / Continuous Scroll */}
              {onToggleViewMode && (
                <TouchableOpacity
                  onPress={() => {
                    setMenuOpen(false);
                    onToggleViewMode();
                  }}
                  style={styles.dropdownItem}
                  activeOpacity={0.7}
                >
                  <MaterialIcons
                    name={viewMode === "continuous" ? "auto-stories" : "view-stream"}
                    size={17}
                    color={isLight ? "#2563eb" : "#7bd0ff"}
                  />
                  <Text
                    style={[
                      styles.dropdownText,
                      isLight && styles.dropdownTextLight,
                    ]}
                  >
                    {viewMode === "continuous"
                      ? "Page by Page View"
                      : "Continuous Scroll"}
                  </Text>
                </TouchableOpacity>
              )}

              {/* 2. Toggle Vertical / Horizontal Reading Direction */}
              {onToggleReadingDirection && (
                <TouchableOpacity
                  onPress={() => {
                    setMenuOpen(false);
                    onToggleReadingDirection();
                  }}
                  style={styles.dropdownItem}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={
                      readingDirection === "horizontal"
                        ? "swap-vertical"
                        : "swap-horizontal"
                    }
                    size={17}
                    color={isLight ? "#2563eb" : "#7bd0ff"}
                  />
                  <Text
                    style={[
                      styles.dropdownText,
                      isLight && styles.dropdownTextLight,
                    ]}
                  >
                    {readingDirection === "horizontal"
                      ? "Vertical Reading"
                      : "Horizontal Reading"}
                  </Text>
                </TouchableOpacity>
              )}

              {/* 3. Go to Page */}
              {onOpenGoToPage && (
                <TouchableOpacity
                  onPress={() => {
                    setMenuOpen(false);
                    onOpenGoToPage();
                  }}
                  style={styles.dropdownItem}
                  activeOpacity={0.7}
                >
                  <MaterialIcons
                    name="find-in-page"
                    size={17}
                    color={isLight ? "#2563eb" : "#7bd0ff"}
                  />
                  <Text
                    style={[
                      styles.dropdownText,
                      isLight && styles.dropdownTextLight,
                    ]}
                  >
                    Go to Page
                  </Text>
                </TouchableOpacity>
              )}

              <View
                style={[
                  styles.dropdownDivider,
                  isLight && styles.dropdownDividerLight,
                ]}
              />

              {/* 4. Bookmark Page */}
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
                    size={17}
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

              {/* 5. Rotate Page */}
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
                    size={17}
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

              {/* 6. Export / Download */}
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
                    size={17}
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

              {/* 7. Open in System Reader */}
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
                    size={17}
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
  iconButtonActive: {
    backgroundColor: "rgba(123, 208, 255, 0.16)",
    borderRadius: 8,
  },
  iconButtonLightActive: {
    backgroundColor: "rgba(37, 99, 235, 0.12)",
    borderRadius: 8,
  },
  iconButtonDarkActive: {
    backgroundColor: "rgba(218, 226, 253, 0.16)",
    borderRadius: 8,
  },
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
  dropdownDivider: {
    height: 1,
    backgroundColor: "rgba(45, 52, 73, 0.6)",
    marginVertical: 4,
    marginHorizontal: 8,
  },
  dropdownDividerLight: {
    backgroundColor: "#e2e8f0",
  },
  searchHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 8,
    gap: 8,
  },
  headerSearchInputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#171f33",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2d3449",
    paddingHorizontal: 10,
    height: 38,
  },
  headerSearchInputWrapperLight: {
    backgroundColor: "#f1f5f9",
    borderColor: "#cbd5e1",
  },
  headerSearchInputField: {
    flex: 1,
    color: "#dae2fd",
    fontSize: 14,
    paddingVertical: 2,
    outlineStyle: "none" as any,
  },
  headerSearchInputFieldLight: {
    color: "#0f172a",
  },
  headerSearchClearBtn: {
    padding: 2,
    marginLeft: 4,
  },
});
