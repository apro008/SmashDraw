import { create } from 'zustand';
import { MMKV } from 'react-native-mmkv';
import { ThemeType } from '~/constants/Colors';

const storage = new MMKV({ id: 'theme-store' });

interface ThemeState {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: (storage.getString('theme') as ThemeType) ?? 'system',
  setTheme: (theme) => {
    storage.set('theme', theme);
    set({ theme });
  },
}));
