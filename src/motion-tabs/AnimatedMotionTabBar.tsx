import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '~/hooks/useTheme';

type TabItem = BottomTabBarProps['state']['routes'][number] & {
  label: string;
};

type LayoutMap = Record<string, { x: number; width: number }>;

const ICON_SIZE = 22;
const SPRING = {
  damping: 18,
  mass: 0.7,
  stiffness: 220,
};

function getLabel(options: BottomTabBarProps['descriptors'][string]['options'], routeName: string) {
  const label = options.tabBarLabel;
  if (typeof label === 'string') return label;
  if (typeof options.title === 'string') return options.title;
  return routeName;
}

function MotionTab({
  active,
  icon,
  label,
  onLayout,
  onPress,
}: {
  active: boolean;
  icon: (props: { focused: boolean; color: string; size: number }) => React.ReactNode;
  label: string;
  onLayout: (event: LayoutChangeEvent) => void;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const progress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(active ? 1 : 0, SPRING);
  }, [active, progress]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.94 + progress.value * 0.12 }],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [colors.textSecondary, colors.primary]),
    opacity: 0.72 + progress.value * 0.28,
  }));

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={active ? { selected: true } : undefined}
      onLayout={onLayout}
      onPress={onPress}
      style={styles.tab}
    >
      <Animated.View style={iconStyle}>
        {icon({
          focused: active,
          color: active ? colors.primary : colors.textSecondary,
          size: ICON_SIZE,
        })}
      </Animated.View>
      <Animated.Text numberOfLines={1} style={[styles.label, labelStyle]}>
        {label}
      </Animated.Text>
    </Pressable>
  );
}

function AnimatedMotionTabBarComponent({ descriptors, navigation, state }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [layouts, setLayouts] = useState<LayoutMap>({});
  const indicatorX = useSharedValue(0);
  const indicatorW = useSharedValue(0);

  const tabs = useMemo(
    () =>
      state.routes
        .map((route) => {
          const options = descriptors[route.key]?.options;
          if ((options as { href?: unknown })?.href === null) return null;
          return { ...route, label: getLabel(options, route.name) };
        })
        .filter((route): route is TabItem => route !== null),
    [descriptors, state.routes]
  );

  const activeRoute = state.routes[state.index];

  useEffect(() => {
    const layout = layouts[activeRoute.key];
    if (!layout) return;

    const width = Math.max(36, Math.min(72, layout.width - 18));
    indicatorW.value = withSpring(width, SPRING);
    indicatorX.value = withSpring(layout.x + (layout.width - width) / 2, SPRING);
  }, [activeRoute.key, indicatorW, indicatorX, layouts]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: indicatorW.value,
  }));

  const handlePress = useCallback(
    (route: TabItem, index: number) => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });

      Haptics.selectionAsync().catch(() => undefined);

      if (state.index !== index && !event.defaultPrevented) {
        navigation.navigate(route.name, route.params);
      }
    },
    [navigation, state.index]
  );

  return (
    <View pointerEvents="box-none" style={styles.wrapper}>
      <View
        style={[
          styles.bar,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            paddingBottom: Math.max(insets.bottom, 10),
          },
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[styles.indicator, { backgroundColor: colors.primary }, indicatorStyle]}
        />
        {tabs.map((route) => {
          const realIndex = state.routes.findIndex((item) => item.key === route.key);
          const options = descriptors[route.key]?.options;
          const active = activeRoute.key === route.key;

          return (
            <MotionTab
              key={route.key}
              active={active}
              icon={(props) =>
                options.tabBarIcon?.(props) ?? (
                  <Ionicons name="ellipse-outline" size={props.size} color={props.color} />
                )
              }
              label={route.label}
              onLayout={(event) => {
                const { x, width } = event.nativeEvent.layout;
                setLayouts((current) => ({ ...current, [route.key]: { x, width } }));
              }}
              onPress={() => handlePress(route, realIndex)}
            />
          );
        })}
      </View>
    </View>
  );
}

export const AnimatedMotionTabBar = memo(AnimatedMotionTabBarComponent);

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: 'transparent',
  },
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 18,
  },
  indicator: {
    borderRadius: 999,
    height: 3,
    position: 'absolute',
    top: 5,
  },
  tab: {
    alignItems: 'center',
    flex: 1,
    gap: 3,
    minHeight: 54,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  label: {
    fontFamily: 'Inter_Medium',
    fontSize: 11,
  },
});
