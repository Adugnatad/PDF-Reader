import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface HeaderProps {
  title?: string;
  onBack?: () => void;
  showBack?: boolean;
  onShowToast: (msg: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  title = 'Document Reader',
  onBack,
  showBack = true,
  onShowToast,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <View style={styles.headerContainer}>
      <View style={styles.innerRow}>
        <View style={styles.leftGroup}>
          {showBack && (
            <TouchableOpacity
              accessibilityLabel="Go back"
              onPress={onBack}
              style={styles.iconButton}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={22} color="#c7c4d7" />
            </TouchableOpacity>
          )}

          <Text style={styles.titleText} numberOfLines={1}>
            {title}
          </Text>
        </View>

        <View style={styles.rightGroup}>
          <TouchableOpacity
            accessibilityLabel="More actions"
            onPress={() => setMenuOpen(!menuOpen)}
            style={styles.iconButton}
            activeOpacity={0.7}
          >
            <Ionicons name="ellipsis-vertical" size={20} color="#c7c4d7" />
          </TouchableOpacity>

          {menuOpen && (
            <View style={styles.dropdownMenu}>
              <TouchableOpacity
                onPress={() => {
                  setMenuOpen(false);
                  onShowToast('Document encrypted with 256-bit AES');
                }}
                style={styles.dropdownItem}
                activeOpacity={0.7}
              >
                <Ionicons name="shield-checkmark-outline" size={16} color="#7bd0ff" />
                <Text style={styles.dropdownText}>Audit Verification</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setMenuOpen(false);
                  onShowToast('Sharing link copied to clipboard');
                }}
                style={styles.dropdownItem}
                activeOpacity={0.7}
              >
                <Ionicons name="share-outline" size={16} color="#c0c1ff" />
                <Text style={styles.dropdownText}>Share Link</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setMenuOpen(false);
                  if (Platform.OS === 'web' && typeof window !== 'undefined') {
                    window.print();
                  } else {
                    onShowToast('Printing document...');
                  }
                }}
                style={styles.dropdownItem}
                activeOpacity={0.7}
              >
                <Ionicons name="print-outline" size={16} color="#c7c4d7" />
                <Text style={styles.dropdownText}>Print Document</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setMenuOpen(false);
                  onShowToast('File hash verified: SHA-256 Valid');
                }}
                style={[styles.dropdownItem, styles.borderTop]}
                activeOpacity={0.7}
              >
                <Ionicons name="document-text-outline" size={16} color="#908fa0" />
                <Text style={styles.dropdownText}>Metadata & Properties</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: 'rgba(11, 19, 38, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(45, 52, 73, 0.6)',
    zIndex: 50,
  },
  innerRow: {
    height: 64,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#171f33',
    marginRight: 8,
  },
  titleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#dae2fd',
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 48,
    right: 0,
    width: 210,
    backgroundColor: '#171f33',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2d3449',
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 10,
    zIndex: 100,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  borderTop: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(45, 52, 73, 0.7)',
    marginTop: 4,
    paddingTop: 8,
  },
  dropdownText: {
    color: '#dae2fd',
    fontSize: 13,
  },
});
