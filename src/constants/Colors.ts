export type ThemeType = 'light' | 'dark' | 'system';

export interface ThemeColors {
  // Brand
  primary: string;
  primaryLight: string;
  // Backgrounds
  background: string;
  surface: string;
  surfaceElevated: string;
  card: string;
  // Text
  text: string;
  textSecondary: string;
  textMuted: string;
  // UI Elements
  border: string;
  inputBg: string;
  // Tab Bar
  tabBar: string;
  tabBarActive: string;
  tabBarInactive: string;
  // Tournament Status Colors
  win: string;
  loss: string;
  upcoming: string;
  ongoing: string;
  // Misc
  overlay: string;
  shadow: string;
  danger: string;
  success: string;
  badge: string;
}

const light: ThemeColors = {
  primary: '#1A73E8',
  primaryLight: '#E8F0FE',
  background: '#F1F5F9',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  card: '#FFFFFF',
  text: '#1A1D23',
  textSecondary: '#4B5563',
  textMuted: '#9CA3AF',
  border: '#E2E8F0',
  inputBg: '#FFFFFF',
  tabBar: '#FFFFFF',
  tabBarActive: '#1A73E8',
  tabBarInactive: '#9CA3AF',
  win: '#16A34A',
  loss: '#DC2626',
  upcoming: '#1A73E8',
  ongoing: '#D97706',
  overlay: 'rgba(0,0,0,0.5)',
  shadow: 'rgba(0,0,0,0.08)',
  danger: '#EF4444',
  success: '#22C55E',
  badge: '#FF3B30',
};

const dark: ThemeColors = {
  primary: '#4EA8FF',
  primaryLight: '#0D2040',
  background: '#0F172A',
  surface: '#1E293B',
  surfaceElevated: '#293548',
  card: '#1E293B',
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  border: '#2D3F55',
  inputBg: '#1E293B',
  tabBar: '#0F172A',
  tabBarActive: '#4EA8FF',
  tabBarInactive: '#64748B',
  win: '#4ADE80',
  loss: '#F87171',
  upcoming: '#4EA8FF',
  ongoing: '#FCD34D',
  overlay: 'rgba(0,0,0,0.6)',
  shadow: 'rgba(0,0,0,0.4)',
  danger: '#F87171',
  success: '#4ADE80',
  badge: '#FF453A',
};

export const Colors: Record<'light' | 'dark', ThemeColors> = { light, dark };

// Category badge colors (cycling)
export const CATEGORY_COLORS = [
  '#1A73E8',
  '#0EA5E9',
  '#8B5CF6',
  '#EC4899',
  '#F59E0B',
  '#10B981',
  '#EF4444',
  '#6366F1',
  '#14B8A6',
  '#F97316',
];
