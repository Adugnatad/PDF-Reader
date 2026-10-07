import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { pdfThumbnailService } from '../services/pdfThumbnailService';

interface PdfThumbnailPreviewProps {
  fileId: string;
  fileName: string;
  style?: any;
}

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
        if (isMounted && url) {
          setThumbUrl(url);
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

  return (
    <View style={[styles.previewContainer, style]}>
      {thumbUrl ? (
        <>
          <Image
            source={{ uri: thumbUrl }}
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
        <View style={styles.fallbackBox}>
          <Text style={styles.fallbackLabel}>PDF</Text>
          <MaterialIcons name="picture-as-pdf" size={18} color="#ff516a" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  previewContainer: {
    width: 44,
    height: 56,
    borderRadius: 7,
    backgroundColor: '#161f36',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
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
    backgroundColor: '#ffffff',
  },
  badgePill: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(220, 38, 38, 0.92)',
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
    backgroundColor: '#17223b',
  },
  fallbackBox: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2e1820',
  },
  fallbackLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#ffb2b7',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
});
