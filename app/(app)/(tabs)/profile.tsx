import { useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '~/components/AppText';
import { useTheme } from '~/hooks/useTheme';
import { useThemeStore } from '~/store/useThemeStore';
import { useAuthStore } from '~/store/useAuthStore';
import { ThemeType } from '~/constants/Colors';

const SKILL_COLORS: Record<string, string> = {
  beginner: '#16A34A',
  intermediate: '#D97706',
  advanced: '#DC2626',
  open: '#7C3AED',
};

const THEME_OPTIONS: { label: string; value: ThemeType; icon: string }[] = [
  { label: 'Light', value: 'light', icon: 'sunny-outline' },
  { label: 'Dark', value: 'dark', icon: 'moon-outline' },
  { label: 'System', value: 'system', icon: 'phone-portrait-outline' },
];

interface MenuItem {
  icon: string;
  label: string;
  onPress: () => void;
  color?: string;
  value?: string;
}

export default function ProfileScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const logout = useAuthStore((s) => s.logout);

  const { theme, setTheme } = useThemeStore();

  const displayName = profile?.name ?? user?.email?.split('@')[0] ?? 'Player';
  const initials = displayName
    .split(' ')
    .map((w: string) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const skillLevel = profile?.skill_level ?? 'beginner';
  const skillColor = SKILL_COLORS[skillLevel] ?? SKILL_COLORS.beginner;

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const menuItems: MenuItem[] = [
    { icon: 'person-outline', label: 'Edit Profile', onPress: () => {} },
    { icon: 'location-outline', label: 'My City', onPress: () => {}, value: profile?.city ?? 'Not set' },
    { icon: 'shield-checkmark-outline', label: 'Role', onPress: () => {}, value: profile?.role ?? 'player' },
    { icon: 'trophy-outline', label: 'Ranking Points', onPress: () => {}, value: String(profile?.ranking_points ?? 0) },
  ];

  const supportItems: MenuItem[] = [
    { icon: 'notifications-outline', label: 'Notifications', onPress: () => {} },
    { icon: 'help-circle-outline', label: 'Help & Support', onPress: () => {} },
    { icon: 'document-text-outline', label: 'Terms & Privacy', onPress: () => {} },
    { icon: 'log-out-outline', label: 'Sign Out', onPress: handleLogout, color: colors.danger },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Profile header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <AppText variant="headingLg" weight="bold" color="#fff">{initials}</AppText>
          </View>
          <AppText variant="title" weight="bold" style={styles.name}>{displayName}</AppText>
          <AppText variant="body" color={colors.textSecondary}>{user?.email ?? ''}</AppText>

          <View style={styles.badges}>
            <View style={[styles.badge, { backgroundColor: skillColor + '20' }]}>
              <AppText variant="label" weight="semiBold" color={skillColor}>
                {skillLevel.charAt(0).toUpperCase() + skillLevel.slice(1)}
              </AppText>
            </View>
            {profile?.club_name && (
              <View style={[styles.badge, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="business-outline" size={11} color={colors.primary} />
                <AppText variant="label" weight="medium" color={colors.primary}>
                  {profile.club_name}
                </AppText>
              </View>
            )}
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <AppText variant="heading" weight="bold" color={colors.primary}>
              {profile?.tournaments_played ?? 0}
            </AppText>
            <AppText variant="caption" color={colors.textSecondary}>Played</AppText>
          </View>
          <View style={[styles.statCard, styles.statCardMid]}>
            <AppText variant="heading" weight="bold" color={colors.win}>
              {profile?.tournaments_won ?? 0}
            </AppText>
            <AppText variant="caption" color={colors.textSecondary}>Won</AppText>
          </View>
          <View style={styles.statCard}>
            <AppText variant="heading" weight="bold" color={colors.ongoing}>
              {profile?.ranking_points ?? 0}
            </AppText>
            <AppText variant="caption" color={colors.textSecondary}>Points</AppText>
          </View>
        </View>

        {/* Account section */}
        <AppText variant="label" weight="semiBold" color={colors.textMuted} style={styles.sectionLabel}>
          ACCOUNT
        </AppText>
        <View style={styles.menuCard}>
          {menuItems.map((item, i) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.menuItem, i < menuItems.length - 1 && styles.menuItemBorder]}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIcon, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name={item.icon as any} size={16} color={colors.primary} />
              </View>
              <AppText variant="bodyLg" style={{ flex: 1 }}>{item.label}</AppText>
              {item.value ? (
                <AppText variant="body" color={colors.textMuted}>{item.value}</AppText>
              ) : null}
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Theme */}
        <AppText variant="label" weight="semiBold" color={colors.textMuted} style={styles.sectionLabel}>
          APPEARANCE
        </AppText>
        <View style={styles.themeCard}>
          {THEME_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.themeOption, theme === opt.value && styles.themeOptionActive]}
              onPress={() => setTheme(opt.value)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={opt.icon as any}
                size={20}
                color={theme === opt.value ? colors.primary : colors.textMuted}
              />
              <AppText
                variant="label"
                weight={theme === opt.value ? 'semiBold' : 'regular'}
                color={theme === opt.value ? colors.primary : colors.textSecondary}
                style={{ marginTop: 4 }}
              >
                {opt.label}
              </AppText>
            </TouchableOpacity>
          ))}
        </View>

        {/* Support / logout */}
        <AppText variant="label" weight="semiBold" color={colors.textMuted} style={styles.sectionLabel}>
          MORE
        </AppText>
        <View style={styles.menuCard}>
          {supportItems.map((item, i) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.menuItem, i < supportItems.length - 1 && styles.menuItemBorder]}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIcon, { backgroundColor: item.color ? item.color + '15' : colors.surface }]}>
                <Ionicons name={item.icon as any} size={16} color={item.color ?? colors.textSecondary} />
              </View>
              <AppText variant="bodyLg" color={item.color ?? colors.text} style={{ flex: 1 }}>
                {item.label}
              </AppText>
              {!item.color && (
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        <AppText variant="caption" color={colors.textMuted} center style={styles.version}>
          SmashDraw v1.0.0
        </AppText>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      paddingBottom: 32,
    },
    profileHeader: {
      alignItems: 'center',
      paddingTop: 24,
      paddingBottom: 20,
      paddingHorizontal: 20,
    },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    name: {
      marginBottom: 4,
    },
    badges: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 10,
      flexWrap: 'wrap',
      justifyContent: 'center',
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
    },
    statsRow: {
      flexDirection: 'row',
      marginHorizontal: 20,
      marginBottom: 24,
      backgroundColor: colors.surface,
      borderRadius: 16,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 8,
      elevation: 3,
      overflow: 'hidden',
    },
    statCard: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 16,
    },
    statCardMid: {
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: colors.border,
    },
    sectionLabel: {
      marginHorizontal: 20,
      marginBottom: 8,
      letterSpacing: 0.5,
    },
    menuCard: {
      marginHorizontal: 20,
      marginBottom: 20,
      backgroundColor: colors.surface,
      borderRadius: 16,
      overflow: 'hidden',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 8,
      elevation: 3,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 12,
    },
    menuItemBorder: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    menuIcon: {
      width: 32,
      height: 32,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    themeCard: {
      marginHorizontal: 20,
      marginBottom: 20,
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 12,
      flexDirection: 'row',
      gap: 8,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 8,
      elevation: 3,
    },
    themeOption: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 12,
      borderRadius: 12,
      gap: 2,
    },
    themeOptionActive: {
      backgroundColor: colors.primaryLight,
    },
    version: {
      marginTop: 8,
    },
  });
}
