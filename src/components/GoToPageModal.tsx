import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";

export interface GoToPageModalProps {
  visible: boolean;
  onClose: () => void;
  currentPage: number;
  numPages: number;
  onGoToPage: (page: number) => void;
  theme?: "light" | "night" | "sepia";
}

export const GoToPageModal: React.FC<GoToPageModalProps> = ({
  visible,
  onClose,
  currentPage,
  numPages,
  onGoToPage,
  theme = "night",
}) => {
  const [pageInput, setPageInput] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const isLight = theme === "light";
  const maxPages = Math.max(1, numPages || 1);

  // Pre-fill input with currentPage when modal opens
  useEffect(() => {
    if (visible) {
      setPageInput(String(currentPage || 1));
      setErrorMessage("");
    }
  }, [visible, currentPage]);

  if (!visible) return null;

  const handleInputChange = (text: string) => {
    // Only allow numeric digits
    const cleaned = text.replace(/[^0-9]/g, "");
    setPageInput(cleaned);
    if (errorMessage) {
      setErrorMessage("");
    }
  };

  const handleSubmit = (targetNum?: number) => {
    const rawVal = targetNum !== undefined ? targetNum : parseInt(pageInput.trim(), 10);
    if (isNaN(rawVal) || rawVal < 1 || rawVal > maxPages) {
      setErrorMessage(`Please enter a valid page between 1 and ${maxPages}`);
      return;
    }

    onGoToPage(rawVal);
    onClose();
  };

  const quickJumpHalf = Math.ceil(maxPages / 2);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalBackdrop}
      >
        <TouchableOpacity
          style={styles.backdropOverlay}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={[styles.dialogCard, isLight && styles.dialogCardLight]}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.titleWithIcon}>
              <View style={[styles.iconBadge, isLight && styles.iconBadgeLight]}>
                <MaterialIcons
                  name="find-in-page"
                  size={20}
                  color={isLight ? "#2563eb" : "#7bd0ff"}
                />
              </View>
              <View>
                <Text style={[styles.dialogTitle, isLight && styles.dialogTitleLight]}>
                  Go to Page
                </Text>
                <Text style={[styles.dialogSubtitle, isLight && styles.dialogSubtitleLight]}>
                  Enter a page number (1 – {maxPages})
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, isLight && styles.closeBtnLight]}
              activeOpacity={0.7}
              accessibilityLabel="Close"
            >
              <Ionicons
                name="close"
                size={18}
                color={isLight ? "#64748b" : "#908fa0"}
              />
            </TouchableOpacity>
          </View>

          {/* Current Position Info */}
          <View style={[styles.infoBanner, isLight && styles.infoBannerLight]}>
            <Ionicons
              name="document-text-outline"
              size={15}
              color={isLight ? "#2563eb" : "#7bd0ff"}
            />
            <Text style={[styles.infoBannerText, isLight && styles.infoBannerTextLight]}>
              Current Position: Page <Text style={styles.boldText}>{currentPage}</Text> of{" "}
              <Text style={styles.boldText}>{maxPages}</Text>
            </Text>
          </View>

          {/* Input Section */}
          <View style={styles.inputContainer}>
            <TextInput
              style={[
                styles.numberInput,
                isLight && styles.numberInputLight,
                !!errorMessage && styles.inputErrorBorder,
              ]}
              value={pageInput}
              onChangeText={handleInputChange}
              keyboardType="number-pad"
              inputMode="numeric"
              placeholder="e.g. 1"
              placeholderTextColor={isLight ? "#94a3b8" : "#64748b"}
              selectTextOnFocus
              autoFocus
              onSubmitEditing={() => handleSubmit()}
              returnKeyType="go"
              maxLength={6}
            />

            {pageInput.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setPageInput("");
                  setErrorMessage("");
                }}
                style={styles.clearInputBtn}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={isLight ? "#94a3b8" : "#908fa0"}
                />
              </TouchableOpacity>
            )}
          </View>

          {/* Error Message */}
          {!!errorMessage && (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle" size={14} color="#ef4444" />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Quick Jump Chips for documents with multiple pages */}
          {maxPages > 1 && (
            <View style={styles.quickChipsWrapper}>
              <Text style={[styles.quickChipsLabel, isLight && styles.quickChipsLabelLight]}>
                Quick jump:
              </Text>
              <View style={styles.chipsRow}>
                <TouchableOpacity
                  style={[styles.chipBtn, isLight && styles.chipBtnLight]}
                  onPress={() => {
                    setPageInput("1");
                    handleSubmit(1);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, isLight && styles.chipTextLight]}>
                    Page 1
                  </Text>
                </TouchableOpacity>

                {maxPages > 2 && (
                  <TouchableOpacity
                    style={[styles.chipBtn, isLight && styles.chipBtnLight]}
                    onPress={() => {
                      setPageInput(String(quickJumpHalf));
                      handleSubmit(quickJumpHalf);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, isLight && styles.chipTextLight]}>
                      Mid (p. {quickJumpHalf})
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.chipBtn, isLight && styles.chipBtnLight]}
                  onPress={() => {
                    setPageInput(String(maxPages));
                    handleSubmit(maxPages);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, isLight && styles.chipTextLight]}>
                    Last (p. {maxPages})
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Dialog Action Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.cancelBtn, isLight && styles.cancelBtnLight]}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={[styles.cancelBtnText, isLight && styles.cancelBtnTextLight]}>
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitBtn, isLight && styles.submitBtnLight]}
              onPress={() => handleSubmit()}
              activeOpacity={0.8}
            >
              <MaterialIcons name="navigation" size={16} color="#ffffff" />
              <Text style={styles.submitBtnText}>Navigate</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    zIndex: 999,
  },
  backdropOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  dialogCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#171f33",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2d3449",
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 16,
    zIndex: 1000,
  },
  dialogCardLight: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    shadowOpacity: 0.15,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  titleWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "rgba(123, 208, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(123, 208, 255, 0.25)",
  },
  iconBadgeLight: {
    backgroundColor: "rgba(37, 99, 235, 0.08)",
    borderColor: "rgba(37, 99, 235, 0.2)",
  },
  dialogTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#dae2fd",
    letterSpacing: -0.2,
  },
  dialogTitleLight: {
    color: "#0f172a",
  },
  dialogSubtitle: {
    fontSize: 12,
    color: "#908fa0",
    marginTop: 2,
  },
  dialogSubtitleLight: {
    color: "#64748b",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  closeBtnLight: {
    backgroundColor: "#f1f5f9",
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(123, 208, 255, 0.08)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(123, 208, 255, 0.15)",
  },
  infoBannerLight: {
    backgroundColor: "rgba(37, 99, 235, 0.06)",
    borderColor: "rgba(37, 99, 235, 0.15)",
  },
  infoBannerText: {
    fontSize: 13,
    color: "#dae2fd",
  },
  infoBannerTextLight: {
    color: "#1e293b",
  },
  boldText: {
    fontWeight: "700",
    color: "#7bd0ff",
  },
  inputContainer: {
    position: "relative",
    justifyContent: "center",
  },
  numberInput: {
    backgroundColor: "#0d1424",
    borderWidth: 1.5,
    borderColor: "#2d3449",
    borderRadius: 12,
    fontSize: 22,
    fontWeight: "700",
    color: "#ffffff",
    textAlign: "center",
    paddingVertical: 12,
    paddingHorizontal: 40,
    outlineStyle: "none" as any,
  },
  numberInputLight: {
    backgroundColor: "#f8fafc",
    borderColor: "#cbd5e1",
    color: "#0f172a",
  },
  inputErrorBorder: {
    borderColor: "#ef4444",
  },
  clearInputBtn: {
    position: "absolute",
    right: 14,
    padding: 4,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  errorText: {
    fontSize: 12,
    color: "#ef4444",
    fontWeight: "500",
  },
  quickChipsWrapper: {
    marginTop: 14,
  },
  quickChipsLabel: {
    fontSize: 11,
    color: "#908fa0",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  quickChipsLabelLight: {
    color: "#64748b",
  },
  chipsRow: {
    flexDirection: "row",
    gap: 8,
  },
  chipBtn: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: "#1e2842",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2d3449",
    alignItems: "center",
  },
  chipBtnLight: {
    backgroundColor: "#f1f5f9",
    borderColor: "#cbd5e1",
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#dae2fd",
  },
  chipTextLight: {
    color: "#334155",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2d3449",
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnLight: {
    borderColor: "#cbd5e1",
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#908fa0",
  },
  cancelBtnTextLight: {
    color: "#64748b",
  },
  submitBtn: {
    flex: 1.4,
    flexDirection: "row",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnLight: {
    backgroundColor: "#2563eb",
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
  },
});
