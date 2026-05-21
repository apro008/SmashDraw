import { useEffect } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '~/hooks/useTheme';

interface SkeletonLoaderProps {
  count?: number;
  variant?: 'card' | 'list' | 'detail';
  style?: ViewStyle;
}

export function SkeletonLoader({ count = 3, variant = 'card', style }: SkeletonLoaderProps) {
  const { colors } = useTheme();
  const shimmer = useSharedValue(0);
  const styles = makeStyles(colors);

  useEffect(() => {
    shimmer.value = withRepeat(withTiming(1, { duration: 1100 }), -1, false);
  }, [shimmer]);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 0.5, 1], [0.42, 0.86, 0.42]),
  }));

  if (variant === 'detail') {
    return (
      <View style={[styles.wrap, style]}>
        <SkeletonBlock style={[styles.hero, shimmerStyle]} />
        <SkeletonBlock style={[styles.lineLg, shimmerStyle]} />
        <SkeletonBlock style={[styles.lineSm, shimmerStyle]} />
        {[...Array(count)].map((_, index) => (
          <View key={index} style={styles.detailCard}>
            <SkeletonBlock style={[styles.lineMd, shimmerStyle]} />
            <View style={styles.row}>
              <SkeletonBlock style={[styles.pill, shimmerStyle]} />
              <SkeletonBlock style={[styles.pill, shimmerStyle]} />
              <SkeletonBlock style={[styles.pill, shimmerStyle]} />
            </View>
            <SkeletonBlock style={[styles.lineFull, shimmerStyle]} />
            <SkeletonBlock style={[styles.lineWide, shimmerStyle]} />
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={[styles.wrap, style]}>
      {[...Array(count)].map((_, index) => (
        <View key={index} style={variant === 'list' ? styles.listCard : styles.card}>
          <SkeletonBlock style={[styles.lineLg, shimmerStyle]} />
          <SkeletonBlock style={[styles.lineSm, shimmerStyle]} />
          <View style={styles.row}>
            <SkeletonBlock style={[styles.pill, shimmerStyle]} />
            <SkeletonBlock style={[styles.pill, shimmerStyle]} />
          </View>
        </View>
      ))}
    </View>
  );
}

function SkeletonBlock({ style }: { style: any }) {
  return <Animated.View style={style} />;
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  const base = {
    backgroundColor: colors.border,
    borderRadius: 8,
  };

  return StyleSheet.create({
    wrap: {
      gap: 12,
    },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      gap: 10,
      padding: 14,
    },
    listCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      gap: 10,
      padding: 16,
    },
    detailCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      gap: 12,
      padding: 15,
    },
    hero: {
      ...base,
      height: 150,
      borderRadius: 16,
    },
    lineLg: {
      ...base,
      height: 18,
      width: '72%',
    },
    lineMd: {
      ...base,
      height: 16,
      width: '58%',
    },
    lineSm: {
      ...base,
      height: 12,
      width: '42%',
    },
    lineFull: {
      ...base,
      height: 12,
      width: '100%',
    },
    lineWide: {
      ...base,
      height: 12,
      width: '78%',
    },
    pill: {
      ...base,
      flex: 1,
      height: 34,
    },
    row: {
      flexDirection: 'row',
      gap: 10,
    },
  });
}
