import React from 'react';
import {
  Animated,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export interface PdfSplashScreenProps {
  visible: boolean;
  fadeAnim: Animated.Value;
  progressAnim: Animated.Value;
}

export const PdfSplashScreen: React.FC<PdfSplashScreenProps> = ({
  visible,
  fadeAnim,
  progressAnim,
}) => {
  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.overlay,
        { opacity: fadeAnim },
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Main Center Graphic: Red PDF Document Icon with folded corner */}
      <View style={styles.centerContainer}>
        {Platform.OS === 'web' ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              userSelect: 'none',
            }}
          >
            <svg
              width="74"
              height="96"
              viewBox="0 0 74 96"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{
                filter: 'drop-shadow(0px 3px 8px rgba(229, 37, 42, 0.22))',
              }}
            >
              {/* Main Document Body */}
              <path
                d="M0 14C0 6.26801 6.26801 0 14 0H50L74 24V82C74 89.732 67.732 96 60 96H14C6.26801 96 0 89.732 0 82V14Z"
                fill="#E5252A"
              />
              {/* Folded Corner Flap */}
              <path
                d="M50 0V16C50 20.4183 53.5817 24 58 24H74L50 0Z"
                fill="#C62828"
              />
              {/* Soft fold shading */}
              <path
                d="M50 0L74 24H58C53.5817 24 50 20.4183 50 16V0Z"
                fill="#B71C1C"
                fillOpacity="0.28"
              />
              {/* Bold White PDF Title */}
              <text
                x="37"
                y="63"
                textAnchor="middle"
                fill="#FFFFFF"
                fontSize="19"
                fontWeight="800"
                fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                letterSpacing="0.8"
              >
                PDF
              </text>
            </svg>
          </div>
        ) : (
          <View style={styles.nativePdfDoc}>
            <View style={styles.nativeCornerFold} />
            <Text style={styles.nativePdfText}>PDF</Text>
          </View>
        )}
      </View>

      {/* Lower Typography Section: PDF Reader & Subtitle */}
      <View style={styles.bottomContainer}>
        <Text style={styles.titleText}>
          <Text style={styles.titleBlack}>PDF </Text>
          <Text style={styles.titleRed}>Reader</Text>
        </Text>
        <Text style={styles.subtitleText}>
          Reading PDFs has never been easier
        </Text>
      </View>

      {/* Very Bottom Edge Loading Progress Bar */}
      <View style={styles.progressTrack}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
    zIndex: 99999,
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  nativePdfDoc: {
    width: 74,
    height: 96,
    backgroundColor: '#E5252A',
    borderRadius: 14,
    borderTopRightRadius: 0,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#E5252A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  nativeCornerFold: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 24,
    height: 24,
    borderBottomLeftRadius: 8,
    backgroundColor: '#C62828',
  },
  nativePdfText: {
    color: '#ffffff',
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 6,
  },
  bottomContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  titleText: {
    fontSize: 27,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  titleBlack: {
    color: '#000000',
  },
  titleRed: {
    color: '#E5252A',
  },
  subtitleText: {
    marginTop: 8,
    fontSize: 14,
    color: '#71717a',
    textAlign: 'center',
    fontWeight: '400',
    letterSpacing: 0.1,
  },
  progressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 5,
    backgroundColor: '#FFCDD2',
    overflow: 'hidden',
    width: '100%',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#E5252A',
  },
});
