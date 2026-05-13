import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { useThemeStore } from '~/store/useThemeStore';
import { Colors, ThemeColors } from '~/constants/Colors';

export type UseThemeReturn = {
  colors: ThemeColors;
  isDark: boolean;
  theme: 'light' | 'dark';
};

export function useTheme(): UseThemeReturn {
  const themeSetting = useThemeStore((s) => s.theme);
  const systemScheme = useColorScheme();

  const resolved: 'light' | 'dark' =
    themeSetting === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : themeSetting;

  const colors = useMemo(() => Colors[resolved], [resolved]);

  return { colors, isDark: resolved === 'dark', theme: resolved };
}
