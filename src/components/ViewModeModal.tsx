import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { ReaderTheme } from '../types';

export interface ViewModeModalProps {
  visible: boolean;
  onClose: () => void;
  // Page by Page
  viewMode: 'single' | 'continuous';
  onChangeViewMode: (mode: 'single' | 'continuous') => void;
  // Reflow
  reflow: boolean;
  onToggleReflow: (active: boolean) => void;
  reflowFontSize: number;
  onChangeFontSize: (size: number) => void;
  // Reading Themes
  theme: ReaderTheme;
  onChangeTheme: (theme: ReaderTheme) => void;
  // Reading Direction
  readingDirection: 'horizontal' | 'vertical';
  onChangeReadingDirection: (dir: 'horizontal' | 'vertical') => void;
  // Toast helper
  onShowToast: (msg: string) => void;
}

// Minimalist Toggle Switch Component
interface ToggleSwitchProps {
  value: boolean;
  onValueChange: (val: boolean) => void;
  accessibilityLabel?: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  value,
  onValueChange,
  accessibilityLabel,
}) => (
  <TouchableOpacity
    activeOpacity={0.8}
    onPress={() => onValueChange(!value)}
    style={[styles.switchTrack, value && styles.switchTrackActive]}
    accessibilityRole="switch"
    accessibilityState={{ checked: value }}
    accessibilityLabel={accessibilityLabel}
  >
    <View style={[styles.switchThumb, value && styles.switchThumbActive]} />
  </TouchableOpacity>
);

export const ViewModeModal: React.FC<ViewModeModalProps> = ({
  visible,
  onClose,
  viewMode,
  onChangeViewMode,
  reflow,
  onToggleReflow,
  reflowFontSize,
  onChangeFontSize,
  theme,
  onChangeTheme,
  readingDirection,
  onChangeReadingDirection,
  onShowToast,
}) => {
  if (!visible) return null;

  return (
    <View style={styles.modalOverlay}>
      {/* Backdrop */}
      <TouchableOpacity
        style={styles.backdropTouch}
        activeOpacity={1}
        onPress={onClose}
        accessibilityLabel="Close View Mode modal"
      />

      {/* Minimalist Mobile-First Bottom Sheet */}
      <View style={styles.bottomSheetCard}>
        {/* Mobile Pull Indicator */}
        <View style={styles.dragHandleWrap}>
          <View style={styles.dragHandle} />
        </View>

        {/* Minimal Header */}
        <View style={styles.headerRow}>
          <View style={styles.headerTitleGroup}>
            <MaterialIcons name="tune" size={18} color="#7bd0ff" />
            <Text style={styles.sheetTitle}>View Settings</Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeIconButton}
            activeOpacity={0.7}
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={18} color="#908fa0" />
          </TouchableOpacity>
        </View>

        {/* Settings List */}
        <View style={styles.settingsList}>
          {/* 1. PAGE BY PAGE (LABEL + TOGGLE BUTTON) */}
          <View style={styles.toggleRowItem}>
            <View style={styles.toggleLabelGroup}>
              <View style={styles.inlineTitleWithIcon}>
                <MaterialIcons
                  name="auto-stories"
                  size={16}
                  color={viewMode === 'single' ? '#7bd0ff' : '#908fa0'}
                />
                <Text style={styles.settingLabel}>Page by Page</Text>
              </View>
              <Text style={styles.settingCurrentHint}>
                {viewMode === 'single'
                  ? 'Focused single page navigation'
                  : 'Continuous vertical scrolling'}
              </Text>
            </View>

            <ToggleSwitch
              value={viewMode === 'single'}
              onValueChange={(val) => {
                const nextMode = val ? 'single' : 'continuous';
                onChangeViewMode(nextMode);
                onShowToast(val ? 'Page by Page Mode Enabled' : 'Continuous Scroll Enabled');
              }}
              accessibilityLabel="Toggle Page by Page navigation"
            />
          </View>

          {/* 2. TEXT REFLOW (LABEL + TOGGLE BUTTON) */}
          <View style={styles.reflowContainerItem}>
            <View style={styles.toggleRowItem}>
              <View style={styles.toggleLabelGroup}>
                <View style={styles.inlineTitleWithIcon}>
                  <MaterialIcons
                    name="format-size"
                    size={16}
                    color={reflow ? '#7bd0ff' : '#908fa0'}
                  />
                  <Text style={styles.settingLabel}>Text Reflow</Text>
                  {reflow && (
                    <View style={styles.activeDotBadge}>
                      <Text style={styles.activeDotText}>ON</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.settingCurrentHint}>
                  {reflow
                    ? `Adaptive mobile paragraphs (${reflowFontSize}px)`
                    : 'Original print canvas layout'}
                </Text>
              </View>

              <ToggleSwitch
                value={reflow}
                onValueChange={(val) => {
                  onToggleReflow(val);
                  onShowToast(val ? 'Text Reflow Activated' : 'Original Print Canvas');
                }}
                accessibilityLabel="Toggle Text Reflow"
              />
            </View>

            {/* Typography Stepper (A- / A+) when Reflow is active */}
            {reflow && (
              <View style={styles.reflowSubControls}>
                <Text style={styles.reflowSubLabel}>Font Size</Text>
                <View style={styles.typographyStepper}>
                  <TouchableOpacity
                    onPress={() => {
                      const next = Math.max(12, reflowFontSize - 2);
                      onChangeFontSize(next);
                    }}
                    style={styles.stepperMiniBtn}
                    activeOpacity={0.7}
                    accessibilityLabel="Decrease Font Size"
                  >
                    <Text style={styles.stepperLetterSmall}>A-</Text>
                  </TouchableOpacity>

                  <Text style={styles.stepperValue}>{reflowFontSize}px</Text>

                  <TouchableOpacity
                    onPress={() => {
                      const next = Math.min(32, reflowFontSize + 2);
                      onChangeFontSize(next);
                    }}
                    style={styles.stepperMiniBtn}
                    activeOpacity={0.7}
                    accessibilityLabel="Increase Font Size"
                  >
                    <Text style={styles.stepperLetterLarge}>A+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* 3. READING THEMES TOGGLE */}
          <View style={styles.settingItem}>
            <View style={styles.settingLabelRow}>
              <Text style={styles.settingLabel}>Reading Themes</Text>
              <Text style={styles.settingCurrentHint}>
                {theme === 'light'
                  ? 'Daylight White'
                  : theme === 'sepia'
                  ? 'Warm Sepia'
                  : 'OLED Night'}
              </Text>
            </View>

            <View style={styles.themeToggleTrack}>
              {/* Daylight White */}
              <TouchableOpacity
                onPress={() => {
                  onChangeTheme('light');
                  onShowToast('Daylight White Theme');
                }}
                style={[
                  styles.themeToggleOption,
                  styles.themeLightOption,
                  theme === 'light' && styles.themeSelectedLight,
                ]}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="sunny"
                  size={14}
                  color={theme === 'light' ? '#0f172a' : '#94a3b8'}
                />
                <Text
                  style={[
                    styles.themeToggleText,
                    theme === 'light' && styles.themeToggleTextLightActive,
                  ]}
                >
                  Daylight
                </Text>
              </TouchableOpacity>

              {/* Eye-Care Warm Sepia */}
              <TouchableOpacity
                onPress={() => {
                  onChangeTheme('sepia');
                  onShowToast('Eye-Care Warm Sepia');
                }}
                style={[
                  styles.themeToggleOption,
                  styles.themeSepiaOption,
                  theme === 'sepia' && styles.themeSelectedSepia,
                ]}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="cafe-outline"
                  size={14}
                  color={theme === 'sepia' ? '#5c4d37' : '#94a3b8'}
                />
                <Text
                  style={[
                    styles.themeToggleText,
                    theme === 'sepia' && styles.themeToggleTextSepiaActive,
                  ]}
                >
                  Warm Sepia
                </Text>
              </TouchableOpacity>

              {/* OLED Night Mode */}
              <TouchableOpacity
                onPress={() => {
                  onChangeTheme('night');
                  onShowToast('OLED Night Mode');
                }}
                style={[
                  styles.themeToggleOption,
                  styles.themeNightOption,
                  theme === 'night' && styles.themeSelectedNight,
                ]}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="moon-outline"
                  size={14}
                  color={theme === 'night' ? '#7bd0ff' : '#94a3b8'}
                />
                <Text
                  style={[
                    styles.themeToggleText,
                    theme === 'night' && styles.themeToggleTextNightActive,
                  ]}
                >
                  OLED Night
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 4. READING DIRECTION TOGGLE */}
          <View style={styles.settingItem}>
            <View style={styles.settingLabelRow}>
              <Text style={styles.settingLabel}>Reading Direction</Text>
              
            </View>

            <View style={styles.segmentedToggleTrack}>
              <TouchableOpacity
                onPress={() => {
                  onChangeReadingDirection('horizontal');
                  onShowToast('Horizontal Reading Direction');
                }}
                style={[
                  styles.segmentOption,
                  readingDirection === 'horizontal' && styles.segmentOptionActive,
                ]}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="swap-horizontal-outline"
                  size={15}
                  color={readingDirection === 'horizontal' ? '#0d0096' : '#908fa0'}
                />
                <Text
                  style={[
                    styles.segmentText,
                    readingDirection === 'horizontal' && styles.segmentTextActive,
                  ]}
                >
                  Horizontal
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  onChangeReadingDirection('vertical');
                  onShowToast('Vertical Reading Direction');
                }}
                style={[
                  styles.segmentOption,
                  readingDirection === 'vertical' && styles.segmentOptionActive,
                ]}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="swap-vertical"
                  size={15}
                  color={readingDirection === 'vertical' ? '#0d0096' : '#908fa0'}
                />
                <Text
                  style={[
                    styles.segmentText,
                    readingDirection === 'vertical' && styles.segmentTextActive,
                  ]}
                >
                  Vertical
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Minimal Footer */}
        <View style={styles.footerRow}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.applyBtn}
            activeOpacity={0.85}
          >
            <Text style={styles.applyBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    position: (Platform.OS === 'web' ? 'fixed' : 'absolute') as any,
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(5, 10, 24, 0.72)',
    zIndex: 9999,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: Platform.OS === 'web' ? 16 : 0,
    paddingHorizontal: 12,
  },
  backdropTouch: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  bottomSheetCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#0f172a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#222f4c',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 20,
  },
  dragHandleWrap: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#334155',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sheetTitle: {
    color: '#dae2fd',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  closeIconButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 16,
  },
  toggleRowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleLabelGroup: {
    flex: 1,
    paddingRight: 12,
  },
  inlineTitleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  settingLabel: {
    color: '#dae2fd',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  settingCurrentHint: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  reflowContainerItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  reflowSubControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  reflowSubLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  activeDotBadge: {
    backgroundColor: 'rgba(123, 208, 255, 0.2)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  activeDotText: {
    color: '#7bd0ff',
    fontSize: 9,
    fontWeight: '800',
  },
  // Custom Switch Styles
  switchTrack: {
    width: 46,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#1e293b',
    borderWidth: 1.5,
    borderColor: '#334155',
    padding: 2,
    justifyContent: 'center',
  },
  switchTrackActive: {
    backgroundColor: '#7bd0ff',
    borderColor: '#7bd0ff',
  },
  switchThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#94a3b8',
    alignSelf: 'flex-start',
  },
  switchThumbActive: {
    backgroundColor: '#0d0096',
    alignSelf: 'flex-end',
  },
  typographyStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#070d1d',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    paddingHorizontal: 3,
    paddingVertical: 2,
    gap: 4,
  },
  stepperMiniBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: '#17223b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperLetterSmall: {
    color: '#dae2fd',
    fontSize: 11,
    fontWeight: '700',
  },
  stepperLetterLarge: {
    color: '#dae2fd',
    fontSize: 12,
    fontWeight: '700',
  },
  stepperValue: {
    color: '#7bd0ff',
    fontSize: 11,
    fontWeight: '700',
    minWidth: 32,
    textAlign: 'center',
  },
  settingItem: {
    gap: 6,
  },
  settingLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  themeToggleTrack: {
    flexDirection: 'row',
    backgroundColor: '#070d1d',
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: '#1e293b',
    gap: 4,
  },
  themeToggleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 7,
    gap: 5,
  },
  themeLightOption: {},
  themeSepiaOption: {},
  themeNightOption: {},
  themeSelectedLight: {
    backgroundColor: '#ffffff',
  },
  themeSelectedSepia: {
    backgroundColor: '#f5efe6',
  },
  themeSelectedNight: {
    backgroundColor: '#17223b',
    borderWidth: 1,
    borderColor: '#7bd0ff',
  },
  themeToggleText: {
    color: '#908fa0',
    fontSize: 11,
    fontWeight: '600',
  },
  themeToggleTextLightActive: {
    color: '#0f172a',
    fontWeight: '700',
  },
  themeToggleTextSepiaActive: {
    color: '#5c4d37',
    fontWeight: '700',
  },
  themeToggleTextNightActive: {
    color: '#7bd0ff',
    fontWeight: '700',
  },
  segmentedToggleTrack: {
    flexDirection: 'row',
    backgroundColor: '#070d1d',
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: '#1e293b',
    gap: 4,
  },
  segmentOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 7,
    gap: 6,
  },
  segmentOptionActive: {
    backgroundColor: '#7bd0ff',
    shadowColor: '#7bd0ff',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    color: '#908fa0',
    fontSize: 12,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: '#0d0096',
    fontWeight: '700',
  },
  footerRow: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 14,
  },
  applyBtn: {
    backgroundColor: '#7bd0ff',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: {
    color: '#0d0096',
    fontSize: 13,
    fontWeight: '700',
  },
});
