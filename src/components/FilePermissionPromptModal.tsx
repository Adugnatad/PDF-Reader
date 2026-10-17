import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
  StatusBar,
  ScrollView,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface FilePermissionPromptModalProps {
  visible: boolean;
  onAllow: () => void;
  onLater: () => void;
  appName?: string;
}

export const FilePermissionPromptModal: React.FC<
  FilePermissionPromptModalProps
> = ({
  visible,
  onAllow,
  onLater,
  appName = "All PDF Reader",
}) => {
  const insets = useSafeAreaInsets();
  const screenHeight = Dimensions.get("window").height;

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
      onRequestClose={onLater}
    >
      <View style={[styles.rootContainer, { backgroundColor: "#ffffff" }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: Math.max(insets.top + 16, 36),
              paddingBottom: Math.max(insets.bottom + 20, 32),
              minHeight: screenHeight,
            },
          ]}
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          {/* Top Title Section */}
          <View style={styles.headerBlock}>
            <Text style={styles.welcomeTitle}>Welcome to</Text>
            <Text style={styles.appTitle}>PDF READER</Text>
          </View>

          {/* Center Illustration matching reference design */}
          <View style={styles.illustrationWrapper}>
            {Platform.OS === "web" ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "100%",
                  maxWidth: 340,
                  userSelect: "none",
                }}
              >
                <svg
                  width="320"
                  height="250"
                  viewBox="0 0 320 250"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  style={{ overflow: "visible" }}
                >
                  {/* Soft Coral/Pink Curved Aura Backdrop */}
                  <ellipse
                    cx="175"
                    cy="142"
                    rx="122"
                    ry="76"
                    fill="#FEEAEB"
                  />
                  <path
                    d="M 68 114 C 62 126 64 142 70 154"
                    stroke="#FBCFD2"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    fill="none"
                  />
                  <path
                    d="M 276 122 C 286 134 286 150 280 162"
                    stroke="#FBCFD2"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    fill="none"
                  />

                  {/* --- RED CLIPBOARD (Right Side) --- */}
                  <g id="clipboard">
                    {/* Clipboard Base Board */}
                    <rect
                      x="160"
                      y="78"
                      width="96"
                      height="138"
                      rx="18"
                      fill="#E61C38"
                    />

                    {/* Top Metallic Clip Tab */}
                    <rect
                      x="188"
                      y="68"
                      width="40"
                      height="20"
                      rx="6"
                      fill="#F87171"
                    />
                    <rect
                      x="196"
                      y="71"
                      width="24"
                      height="8"
                      rx="3"
                      fill="#FFFFFF"
                      fillOpacity="0.8"
                    />
                    <circle cx="208" cy="74" r="3" fill="#E61C38" />

                    {/* White Paper Sheet */}
                    <rect
                      x="168"
                      y="86"
                      width="80"
                      height="122"
                      rx="10"
                      fill="#FFFFFF"
                    />

                    {/* 5 Checklist Items with Orange Square Checkbox & Lines */}
                    {[0, 1, 2, 3, 4].map((i) => {
                      const itemY = 98 + i * 21;
                      return (
                        <g key={i}>
                          {/* Checkbox square */}
                          <rect
                            x="176"
                            y={itemY}
                            width="14"
                            height="14"
                            rx="2"
                            fill="#FEE2E2"
                            stroke="#F87171"
                            strokeWidth="1.2"
                          />
                          {/* Checked mark */}
                          <path
                            d={`M ${179.5} ${itemY + 7} L ${182.5} ${itemY + 10} L ${187.5} ${itemY + 4}`}
                            fill="none"
                            stroke="#E61C38"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          {/* Document text representation lines */}
                          <rect
                            x="196"
                            y={itemY + 2.5}
                            width="42"
                            height="3.5"
                            rx="1.75"
                            fill="#94A3B8"
                          />
                          <rect
                            x="196"
                            y={itemY + 8.5}
                            width="28"
                            height="2.5"
                            rx="1.25"
                            fill="#CBD5E1"
                          />
                        </g>
                      );
                    })}
                  </g>

                  {/* --- CHARACTER (Left Side) --- */}
                  <g id="character">
                    {/* Shadow underneath */}
                    <ellipse
                      cx="115"
                      cy="210"
                      rx="26"
                      ry="4"
                      fill="#E2E8F0"
                      fillOpacity="0.6"
                    />

                    {/* Left Leg */}
                    <path
                      d="M 103 150 L 100 200 L 110 200 L 113 150 Z"
                      fill="#1E3A8A"
                    />
                    {/* Left Shoe with White Sole */}
                    <path
                      d="M 95 200 L 111 200 L 111 207 L 94 207 Z"
                      fill="#1E293B"
                    />
                    <rect
                      x="94"
                      y="205"
                      width="17"
                      height="2"
                      rx="0.5"
                      fill="#FFFFFF"
                    />

                    {/* Right Leg */}
                    <path
                      d="M 116 150 L 118 200 L 128 200 L 125 150 Z"
                      fill="#1E3A8A"
                    />
                    {/* Right Shoe with White Sole */}
                    <path
                      d="M 118 200 L 134 200 L 135 207 L 118 207 Z"
                      fill="#1E293B"
                    />
                    <rect
                      x="118"
                      y="205"
                      width="17"
                      height="2"
                      rx="0.5"
                      fill="#FFFFFF"
                    />

                    {/* Body & Slate Jacket */}
                    <rect
                      x="110"
                      y="112"
                      width="12"
                      height="38"
                      fill="#FFFFFF"
                    />
                    {/* Left Open Jacket Wing & Sleeve */}
                    <path
                      d="M 101 113 L 88 126 L 93 133 L 104 122 L 103 150 L 111 150 L 111 113 Z"
                      fill="#475569"
                    />
                    {/* Right Open Jacket Wing & Sleeve */}
                    <path
                      d="M 117 113 L 125 150 L 133 150 L 132 120 L 140 126 L 144 121 L 127 113 Z"
                      fill="#475569"
                    />
                    {/* White Shirt Collar */}
                    <polygon
                      points="110,112 120,112 115,118"
                      fill="#E2E8F0"
                    />

                    {/* Left hand holding pencil */}
                    <circle cx="89" cy="130" r="4.5" fill="#FCD3B8" />

                    {/* Right hand resting near waist */}
                    <circle cx="142" cy="124" r="4" fill="#FCD3B8" />

                    {/* Neck */}
                    <rect
                      x="112"
                      y="105"
                      width="6"
                      height="8"
                      rx="2"
                      fill="#FBCFB2"
                    />

                    {/* Head / Face */}
                    <ellipse
                      cx="115"
                      cy="97"
                      rx="8.5"
                      ry="9.5"
                      fill="#FCD3B8"
                    />

                    {/* Smile and facial details */}
                    <path
                      d="M 113 99 Q 115 102 117 99"
                      stroke="#9A3412"
                      strokeWidth="1"
                      strokeLinecap="round"
                      fill="none"
                    />
                    <circle cx="113" cy="95" r="0.9" fill="#1E293B" />
                    <circle cx="117" cy="95" r="0.9" fill="#1E293B" />

                    {/* Styled Dark Hair */}
                    <path
                      d="M 106 97 C 106 87 124 86 125 94 C 122 92 118 91 114 93 C 111 95 109 98 107 100 Z"
                      fill="#1E293B"
                    />
                  </g>

                  {/* --- GIANT YELLOW PENCIL (Left of Character) --- */}
                  <g id="pencil">
                    {/* Pink Eraser at Top */}
                    <rect
                      x="74"
                      y="93"
                      width="16"
                      height="14"
                      rx="4"
                      fill="#F472B6"
                    />

                    {/* Silver Metal Ferrule */}
                    <rect
                      x="74"
                      y="107"
                      width="16"
                      height="6"
                      fill="#94A3B8"
                    />

                    {/* Yellow Wooden Pencil Shaft */}
                    <rect
                      x="74"
                      y="113"
                      width="16"
                      height="68"
                      fill="#F59E0B"
                    />
                    {/* Facet stripes on pencil body */}
                    <rect
                      x="78"
                      y="113"
                      width="2.5"
                      height="68"
                      fill="#D97706"
                    />
                    <rect
                      x="84"
                      y="113"
                      width="2.5"
                      height="68"
                      fill="#B45309"
                    />

                    {/* Black Grip Ring */}
                    <rect
                      x="74"
                      y="181"
                      width="16"
                      height="9"
                      fill="#1E293B"
                    />

                    {/* Sharpened Wood Cone Collar */}
                    <polygon
                      points="74,190 90,190 82,207"
                      fill="#FDE68A"
                    />

                    {/* Black Graphite Tip */}
                    <polygon
                      points="79,200 85,200 82,207"
                      fill="#1E293B"
                    />
                  </g>
                </svg>
              </div>
            ) : (
              /* Native Fallback Illustration Representation */
              <View style={styles.nativeIllustrationBox}>
                <View style={styles.nativeAura} />
                <View style={styles.nativeClipboard}>
                  <View style={styles.nativeClipTop} />
                  <View style={styles.nativePaper}>
                    {[0, 1, 2, 3, 4].map((i) => (
                      <View key={i} style={styles.nativeItemRow}>
                        <View style={styles.nativeCheckbox}>
                          <Text style={styles.nativeCheckText}>✓</Text>
                        </View>
                        <View style={styles.nativeLineCol}>
                          <View style={styles.nativeTextLine1} />
                          <View style={styles.nativeTextLine2} />
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Text Information Section */}
          <View style={styles.textBlock}>
            <Text style={styles.permissionHeading}>Permission Required</Text>
            <Text style={styles.permissionBody}>
              To read and edit your files, please allow {appName} to access all
              your files.
            </Text>
          </View>

          {/* Action Buttons Section */}
          <View style={styles.buttonsBlock}>
            <TouchableOpacity
              style={styles.allowBtn}
              onPress={onAllow}
              activeOpacity={0.88}
              accessibilityLabel="Allow file access"
              accessibilityRole="button"
            >
              <Text style={styles.allowBtnText}>Allow</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.laterBtn}
              onPress={onLater}
              activeOpacity={0.7}
              accessibilityLabel="Later"
              accessibilityRole="button"
            >
              <Text style={styles.laterBtnText}>Later</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
  },
  headerBlock: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    marginTop: 8,
    marginBottom: 8,
  },
  welcomeTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#181A20",
    textAlign: "center",
    letterSpacing: -0.2,
    marginBottom: 4,
    fontFamily:
      Platform.OS === "ios" ? "System" : "sans-serif",
  },
  appTitle: {
    fontSize: 30,
    fontWeight: "900",
    color: "#E61C38",
    textAlign: "center",
    letterSpacing: 0.8,
    fontFamily:
      Platform.OS === "ios" ? "System" : "sans-serif",
  },
  illustrationWrapper: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 18,
    paddingHorizontal: 16,
    minHeight: 220,
  },
  textBlock: {
    paddingHorizontal: 32,
    marginTop: 10,
    marginBottom: 24,
  },
  permissionHeading: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    textAlign: "left",
    marginBottom: 10,
    letterSpacing: -0.2,
    fontFamily:
      Platform.OS === "ios" ? "System" : "sans-serif",
  },
  permissionBody: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
    color: "#374151",
    textAlign: "left",
    letterSpacing: -0.1,
    fontFamily:
      Platform.OS === "ios" ? "System" : "sans-serif",
  },
  buttonsBlock: {
    paddingHorizontal: 32,
    marginTop: "auto",
    paddingTop: 16,
    alignItems: "center",
  },
  allowBtn: {
    backgroundColor: "#E61C38",
    borderRadius: 9999,
    width: "100%",
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#E61C38",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4,
  },
  allowBtnText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 0.2,
  },
  laterBtn: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginTop: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  laterBtnText: {
    color: "#8E8E93",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },

  /* Native Fallback Styles */
  nativeIllustrationBox: {
    width: 260,
    height: 190,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  nativeAura: {
    position: "absolute",
    width: 220,
    height: 140,
    borderRadius: 70,
    backgroundColor: "#FEEAEB",
  },
  nativeClipboard: {
    width: 140,
    height: 180,
    borderRadius: 16,
    backgroundColor: "#E61C38",
    alignItems: "center",
    paddingTop: 14,
    position: "relative",
  },
  nativeClipTop: {
    position: "absolute",
    top: -8,
    width: 50,
    height: 18,
    borderRadius: 6,
    backgroundColor: "#F87171",
  },
  nativePaper: {
    width: 120,
    height: 152,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    padding: 10,
    gap: 8,
  },
  nativeItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  nativeCheckbox: {
    width: 14,
    height: 14,
    borderRadius: 2,
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#F87171",
    alignItems: "center",
    justifyContent: "center",
  },
  nativeCheckText: {
    color: "#E61C38",
    fontSize: 9,
    fontWeight: "800",
    marginTop: -2,
  },
  nativeLineCol: {
    flex: 1,
    gap: 3,
  },
  nativeTextLine1: {
    height: 3,
    backgroundColor: "#94A3B8",
    borderRadius: 1.5,
    width: "85%",
  },
  nativeTextLine2: {
    height: 2.5,
    backgroundColor: "#CBD5E1",
    borderRadius: 1.25,
    width: "60%",
  },
});
