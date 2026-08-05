import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  withRepeat,
  withDelay,
  Easing,
} from 'react-native-reanimated';

// Matches the splash-icon artwork background (and app.json splash backgroundColor),
// so the native splash hands over to this loader without a visible colour jump.
const SPLASH_BG = '#01081A';
const WHITE = '#FFFFFF';
const WHITE_DIM = 'rgba(255,255,255,0.65)';

// Pure-View shuttlecock mark — 9 feather spines + ring + cork
function ShuttlecockMark() {
  // Spines from center-bottom of the ring area outward
  const spines = [
    { rotate: '-60deg' },
    { rotate: '-45deg' },
    { rotate: '-25deg' },
    { rotate: '0deg' },
    { rotate: '25deg' },
    { rotate: '45deg' },
    { rotate: '60deg' },
  ];

  return (
    <View style={mark.root}>
      {/* Feather ring */}
      <View style={mark.ring} />
      {/* Spine stack: all anchored at bottom-center, rotated out */}
      <View style={mark.spineContainer}>
        {spines.map((s, i) => (
          <View key={i} style={[mark.spine, { transform: [{ rotate: s.rotate }] }]} />
        ))}
      </View>
      {/* Cork */}
      <View style={mark.cork} />
    </View>
  );
}

const mark = StyleSheet.create({
  root: {
    width: 104,
    height: 130,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  ring: {
    position: 'absolute',
    top: 0,
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 6,
    borderColor: WHITE,
  },
  spineContainer: {
    position: 'absolute',
    bottom: 18,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  spine: {
    position: 'absolute',
    width: 4,
    height: 75,
    borderRadius: 2,
    backgroundColor: WHITE,
    bottom: 0,
    transformOrigin: 'bottom center',
  },
  cork: {
    width: 23,
    height: 18,
    borderRadius: 9,
    backgroundColor: WHITE,
  },
});

// Three bouncing dots
function LoadingDots() {
  const y1 = useSharedValue(0);
  const y2 = useSharedValue(0);
  const y3 = useSharedValue(0);

  const bounce = withRepeat(
    withSequence(withTiming(-8, { duration: 320, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 320, easing: Easing.in(Easing.quad) })),
    -1,
  );

  useEffect(() => {
    y1.value = bounce;
    y2.value = withDelay(130, bounce);
    y3.value = withDelay(260, bounce);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const s1 = useAnimatedStyle(() => ({ transform: [{ translateY: y1.value }] }));
  const s2 = useAnimatedStyle(() => ({ transform: [{ translateY: y2.value }] }));
  const s3 = useAnimatedStyle(() => ({ transform: [{ translateY: y3.value }] }));

  return (
    <View style={dots.row}>
      <Animated.View style={[dots.dot, s1]} />
      <Animated.View style={[dots.dot, s2]} />
      <Animated.View style={[dots.dot, s3]} />
    </View>
  );
}

const dots = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, marginTop: 48 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.8)' },
});

export function SplashLoader() {
  const logoScale = useSharedValue(0.6);
  const logoOpacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 450 });
    logoScale.value = withSpring(1, { damping: 14, stiffness: 130 });
    textOpacity.value = withDelay(280, withTiming(1, { duration: 500 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const textStyle = useAnimatedStyle(() => ({ opacity: textOpacity.value }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.logoWrap, logoStyle]}>
        <View style={styles.logoBg}>
          <ShuttlecockMark />
        </View>
      </Animated.View>

      <Animated.View style={[styles.textGroup, textStyle]}>
        <Text style={styles.title}>SmashDraw</Text>
        <Text style={styles.subtitle}>Tournament Manager</Text>
      </Animated.View>

      <LoadingDots />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SPLASH_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    marginBottom: 32,
  },
  logoBg: {
    width: 160,
    height: 160,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textGroup: {
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: WHITE,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: WHITE_DIM,
    letterSpacing: 0.3,
  },
});
