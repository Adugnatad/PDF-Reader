import React from 'react';
import { View, StyleSheet } from 'react-native';

interface NativePdfViewProps {
  canvasRef?: any;
  drawCanvasRef?: any;
  pdfBytes?: Uint8Array | ArrayBuffer | null;
  fileName?: string;
  currentPage?: number;
  numPages?: number;
  zoom?: number;
  themeColors?: any;
  activeTool?: string;
  onOpenSystemViewer?: () => void;
}

/**
 * Web Implementation: Renders the standard HTML5 Canvas
 */
export const NativePdfView: React.FC<NativePdfViewProps> = ({
  canvasRef,
  drawCanvasRef,
  activeTool,
}) => {
  return (
    <View style={styles.container}>
      <canvas ref={canvasRef} style={{ display: 'block', maxWidth: '100%' }} />
      {drawCanvasRef && (
        <canvas
          ref={drawCanvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            pointerEvents:
              activeTool === 'pen' || activeTool === 'highlighter' ? 'auto' : 'none',
            maxWidth: '100%',
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
