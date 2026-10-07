import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { pdfThumbnailService } from '../services/pdfThumbnailService';

interface PdfThumbnailPreviewProps {
  fileId: string;
  fileName: string;
  style?: any;
}

function isBitmapUri(uri: string | null | undefined): boolean {
  if (!uri) return false;
  if (uri.startsWith('data:image/svg')) return false; // SVG fails on React Native core Image
  return (
    uri.startsWith('data:image/jpeg') ||
    uri.startsWith('data:image/jpg') ||
    uri.startsWith('data:image/png') ||
    uri.startsWith('data:image/webp') ||
    uri.startsWith('file://') ||
    uri.startsWith('http://') ||
    uri.startsWith('https://')
  );
}

function getDocumentVisualTheme(name: string): {
  accentColor: string;
  badgeLabel: string;
  pillColor: string;
} {
  const lower = (name || '').toLowerCase();
  if (
    lower.includes('tax') ||
    lower.includes('1040') ||
    lower.includes('deduction') ||
    lower.includes('w2') ||
    lower.includes('financial')
  ) {
    return { accentColor: '#059669', badgeLabel: 'TAX', pillColor: '#047857' };
  }
  if (
    lower.includes('contract') ||
    lower.includes('vendor') ||
    lower.includes('agreement') ||
    lower.includes('legal') ||
    lower.includes('nda')
  ) {
    return { accentColor: '#2563eb', badgeLabel: 'AGREEMENT', pillColor: '#1d4ed8' };
  }
  if (
    lower.includes('audit') ||
    lower.includes('executive') ||
    lower.includes('report') ||
    lower.includes('q4') ||
    lower.includes('annual')
  ) {
    return { accentColor: '#7c3aed', badgeLabel: 'REPORT', pillColor: '#6d28d9' };
  }
  if (
    lower.includes('invoice') ||
    lower.includes('billing') ||
    lower.includes('receipt') ||
    lower.includes('statement')
  ) {
    return { accentColor: '#d97706', badgeLabel: 'INVOICE', pillColor: '#b45309' };
  }
  if (
    lower.includes('guide') ||
    lower.includes('manual') ||
    lower.includes('book')
  ) {
    return { accentColor: '#0891b2', badgeLabel: 'GUIDE', pillColor: '#0e7490' };
  }
  return { accentColor: '#e11d48', badgeLabel: 'DOC', pillColor: '#be123c' };
}

/**
 * Authentic, styled miniature document sheet rendered in pure React Native.
 * Used on native devices and when raster preview is resolving, eliminating blank white screens.
 */
const NativeDocumentSheet: React.FC<{ fileName: string }> = ({ fileName }) => {
  const theme = getDocumentVisualTheme(fileName);

  return (
    <View style={styles.sheetPaper}>
      {/* Top Header Color Accent Bar */}
      <View style={[styles.sheetHeaderBar, { backgroundColor: theme.accentColor }]} />

      {/* Mini Title & Document Type */}
      <View style={styles.sheetContent}>
        <Text style={[styles.sheetDocTag, { color: theme.accentColor }]} numberOfLines={1}>
          {theme.badgeLabel}
        </Text>

        {/* Realistic Document Paragraph Lines */}
        <View style={styles.sheetLinesContainer}>
          <View style={[styles.sheetLine, { width: '85%' }]} />
          <View style={[styles.sheetLine, { width: '96%' }]} />
          <View style={[styles.sheetLine, { width: '70%' }]} />
        </View>

        {/* Miniature Data / Table / Chart Callout Block */}
        <View style={styles.sheetTableBlock}>
          <View style={[styles.sheetTableLine, { width: '80%' }]} />
          <View style={[styles.sheetTableLine, { width: '60%' }]} />
        </View>

        {/* Lower Paragraph Lines */}
        <View style={styles.sheetLinesContainer}>
          <View style={[styles.sheetLine, { width: '90%' }]} />
          <View style={[styles.sheetLine, { width: '55%' }]} />
        </View>

        {/* Footer: Signature Line & Red PDF Stamp */}
        <View style={styles.sheetFooter}>
          <View style={styles.sheetSignLine} />
          <View style={[styles.sheetPdfBadge, { backgroundColor: theme.pillColor }]}>
            <Text style={styles.sheetPdfBadgeText}>PDF</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export const PdfThumbnailPreview: React.FC<PdfThumbnailPreviewProps> = ({
  fileId,
  fileName,
  style,
}) => {
  const [thumbUrl, setThumbUrl] = useState<string | null>(() =>
    pdfThumbnailService.getThumbnailSync(fileId, fileName)
  );
  const [isLoading, setIsLoading] = useState<boolean>(!thumbUrl);

  useEffect(() => {
    let isMounted = true;

    // 1. Check sync cache first
    const immediate = pdfThumbnailService.getThumbnailSync(fileId, fileName);
    if (immediate) {
      setThumbUrl(immediate);
      setIsLoading(false);
      return;
    }

    // 2. Subscribe to thumbnail service events
    const unsubscribe = pdfThumbnailService.subscribe((updatedId, url) => {
      if (isMounted && (updatedId === fileId || updatedId === fileName)) {
        setThumbUrl(url);
        setIsLoading(false);
      }
    });

    // 3. Request thumbnail generation
    pdfThumbnailService
      .getThumbnail(fileId, fileName)
      .then((url) => {
        if (isMounted) {
          if (url) setThumbUrl(url);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [fileId, fileName]);

  const hasBitmap = isBitmapUri(thumbUrl);

  return (
    <View style={[styles.previewContainer, style]}>
      {hasBitmap ? (
        <>
          <Image
            source={{ uri: thumbUrl! }}
            style={styles.thumbImage}
            resizeMode="cover"
          />
          {/* Subtle Document Overlay & PDF Label Tag */}
          <View style={styles.badgePill}>
            <Text style={styles.badgePillText}>PDF</Text>
          </View>
        </>
      ) : isLoading ? (
        <View style={styles.placeholderBox}>
          <ActivityIndicator size="small" color="#7bd0ff" />
        </View>
      ) : (
        <NativeDocumentSheet fileName={fileName} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  previewContainer: {
    width: 44,
    height: 58,
    borderRadius: 7,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  badgePill: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(220, 38, 38, 0.95)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 1,
  },
  badgePillText: {
    fontSize: 7,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  placeholderBox: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#131b2e',
  },

  /* Native Document Sheet Styles */
  sheetPaper: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f8fafc',
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  sheetHeaderBar: {
    width: '100%',
    height: 4.5,
  },
  sheetContent: {
    flex: 1,
    paddingHorizontal: 4,
    paddingTop: 3,
    paddingBottom: 2,
    justifyContent: 'space-between',
  },
  sheetDocTag: {
    fontSize: 6.5,
    fontWeight: '900',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  sheetLinesContainer: {
    gap: 2,
    marginBottom: 2,
  },
  sheetLine: {
    height: 1.8,
    backgroundColor: '#94a3b8',
    borderRadius: 1,
  },
  sheetTableBlock: {
    backgroundColor: '#e2e8f0',
    borderRadius: 2,
    padding: 2,
    gap: 1.5,
    marginVertical: 1,
    borderWidth: 0.5,
    borderColor: '#cbd5e1',
  },
  sheetTableLine: {
    height: 1.5,
    backgroundColor: '#64748b',
    borderRadius: 0.8,
  },
  sheetFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 1,
  },
  sheetSignLine: {
    width: 14,
    height: 1,
    backgroundColor: '#64748b',
  },
  sheetPdfBadge: {
    paddingHorizontal: 3,
    paddingVertical: 0.8,
    borderRadius: 2,
  },
  sheetPdfBadgeText: {
    fontSize: 5.5,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
});
