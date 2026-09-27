import React from 'react';
import { Text, StyleSheet, TextStyle } from 'react-native';

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  style?: TextStyle;
}

// Map common Ionicons and MaterialIcons to Material Symbols or clean Unicode glyphs
const ICON_MAP: Record<string, string> = {
  // Common Ionicons
  'checkmark-circle': 'check_circle',
  'checkmark-circle-outline': 'check_circle',
  'folder': 'folder',
  'folder-outline': 'folder',
  'book': 'menu_book',
  'book-outline': 'menu_book',
  'grid': 'grid_view',
  'grid-outline': 'grid_view',
  'search': 'search',
  'search-outline': 'search',
  'close': 'close',
  'close-circle': 'cancel',
  'chevron-forward': 'chevron_right',
  'chevron-back': 'chevron_left',
  'chevron-down': 'expand_more',
  'chevron-up': 'expand_less',
  'arrow-back': 'arrow_back',
  'ellipsis-vertical': 'more_vert',
  'ellipsis-horizontal': 'more_horiz',
  'share-outline': 'share',
  'print-outline': 'print',
  'document-text-outline': 'description',
  'document-text': 'description',
  'stats-chart': 'bar_chart',
  'stats-chart-outline': 'bar_chart',
  'phone-portrait-outline': 'smartphone',
  'expand-outline': 'fullscreen',
  'contract-outline': 'fullscreen_exit',
  'bookmark': 'bookmark',
  'bookmark-outline': 'bookmark_border',
  'create-outline': 'draw',
  'color-palette-outline': 'palette',
  'text-outline': 'format_underlined',
  'trash-outline': 'delete',
  'download-outline': 'download',
  'filter-outline': 'filter_list',
  'swap-vertical-outline': 'swap_vert',
  'eye-outline': 'visibility',
  'lock-closed-outline': 'lock',
  'shield-checkmark-outline': 'verified_user',
  'cloud-done-outline': 'cloud_done',
  'add': 'add',
  'sunny-outline': 'light_mode',
  'moon-outline': 'dark_mode',
  'cafe-outline': 'coffee',
  'reader-outline': 'chrome_reader_mode',
};

const createIconComponent = (defaultPrefix = '') => {
  return function Icon({ name, size = 20, color = '#dae2fd', style }: IconProps) {
    const symbol = ICON_MAP[name] || name.replace(/-/g, '_').replace(/_outline$/, '');
    return (
      <Text
        style={[
          styles.iconText,
          {
            fontSize: size,
            color: color,
            lineHeight: size,
            width: size,
            height: size,
          },
          style,
        ]}
      >
        {symbol}
      </Text>
    );
  };
};

const styles = StyleSheet.create({
  iconText: {
    fontFamily: 'Material Symbols Outlined',
    fontWeight: 'normal',
    fontStyle: 'normal',
    textAlign: 'center',
    userSelect: 'none',
  },
});

export const Ionicons = createIconComponent('ion');
export const MaterialIcons = createIconComponent('mat');
export const MaterialCommunityIcons = createIconComponent('mci');
export const Feather = createIconComponent('fe');
export const FontAwesome = createIconComponent('fa');
export const FontAwesome5 = createIconComponent('fa5');
export const AntDesign = createIconComponent('ant');
export const Entypo = createIconComponent('ent');

export default {
  Ionicons,
  MaterialIcons,
  MaterialCommunityIcons,
  Feather,
  FontAwesome,
  FontAwesome5,
  AntDesign,
  Entypo,
};
