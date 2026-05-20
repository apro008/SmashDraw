import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '~/components/AppText';
import { ProfileLocationPicker } from '~/components/common/ProfileLocationPicker';
import { ThemeType } from '~/constants/Colors';
import { useTheme } from '~/hooks/useTheme';
import { useAlert } from '~/providers/AlertProvider';
import { useAuthStore } from '~/store/useAuthStore';
import { useThemeStore } from '~/store/useThemeStore';
import { UserRole } from '~/types';

const SKILL_COLORS: Record<string, string> = {
  beginner: '#16A34A',
  intermediate: '#D97706',
  advanced: '#DC2626',
  open: '#7C3AED',
};

const ROLE_META: Record<
  UserRole,
  { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }
> = {
  player: { label: 'Player', icon: 'person', color: '#1A73E8' },
  organizer: { label: 'Organizer', icon: 'trophy', color: '#0F766E' },
  admin: { label: 'Administrator', icon: 'shield-checkmark', color: '#7C3AED' },
};

const THEME_OPTIONS: { label: string; value: ThemeType; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: 'Light', value: 'light', icon: 'sunny-outline' },
  { label: 'Dark', value: 'dark', icon: 'moon-outline' },
  { label: 'System', value: 'system', icon: 'phone-portrait-outline' },
];

interface ProfileHomeScreenProps {
  fallbackName: string;
}

export function ProfileHomeScreen({ fallbackName }: ProfileHomeScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { confirm } = useAlert();
  const { theme, setTheme } = useThemeStore();
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const logout = useAuthStore((s) => s.logout);
  const [locationVisible, setLocationVisible] = useState(false);

  const displayName = profile?.name ?? user?.email?.split('@')[0] ?? fallbackName;
  const initials = displayName
    .split(' ')
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const role = profile?.role ?? 'player';
  const roleMeta = ROLE_META[role];
  const skillLevel = profile?.skill_level ?? 'beginner';
  const skillColor = SKILL_COLORS[skillLevel] ?? SKILL_COLORS.beginner;
  const location =
    profile?.city && profile?.state ? `${profile.city}, ${profile.state}` : 'Location not set';

  const handleLogout = () => {
    confirm({
      title: 'Sign Out',
      message: 'Are you sure you want to sign out?',
      confirmText: 'Sign Out',
      destructive: true,
      onConfirm: () => logout(),
    });
  };

  const accountItems = [
    {
      icon: 'person-outline' as const,
      label: 'Edit Profile',
      value: 'Name, phone, club, skill',
      onPress: () => router.push('/(app)/edit-profile'),
    },
    {
      icon: 'location-outline' as const,
      label: role === 'organizer' ? 'Organizer Location' : 'My Location',
      value: location,
      onPress: () => setLocationVisible(true),
      multiline: true,
    },
    {
      icon: 'trophy-outline' as const,
      label: 'Ranking Points',
      value: String(profile?.ranking_points ?? 0),
      onPress: () => {},
    },
  ];

  const moreItems = [
    {
      icon: 'notifications-outline' as const,
      label: 'Notifications',
      value: 'Tournament alerts',
      onPress: () => router.push('/(app)/notifications'),
    },
    {
      icon: 'help-circle-outline' as const,
      label: 'Help & Support',
      value: 'Contact and FAQs',
      onPress: () => router.push('/(app)/support'),
    },
    {
      icon: 'document-text-outline' as const,
      label: 'Terms & Privacy',
      value: 'Policies',
      onPress: () => router.push('/(app)/terms-privacy'),
    },
    {
      icon: 'log-out-outline' as const,
      label: 'Sign Out',
      value: '',
      onPress: handleLogout,
      color: colors.danger,
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={[styles.avatar, { backgroundColor: roleMeta.color }]}>
            <AppText variant="headingLg" weight="bold" color="#fff">
              {initials}
            </AppText>
          </View>
          <View style={styles.identity}>
            <AppText variant="heading" weight="bold" numberOfLines={1}>
              {displayName}
            </AppText>
            <AppText variant="body" color={colors.textSecondary} numberOfLines={1}>
              {user?.email ?? ''}
            </AppText>
            <View style={styles.badges}>
              <View style={[styles.badge, { backgroundColor: `${roleMeta.color}20` }]}>
                <Ionicons name={roleMeta.icon} size={12} color={roleMeta.color} />
                <AppText variant="label" weight="semiBold" color={roleMeta.color}>
                  {roleMeta.label}
                </AppText>
              </View>
              <View style={[styles.badge, { backgroundColor: `${skillColor}20` }]}>
                <AppText variant="label" weight="semiBold" color={skillColor}>
                  {skillLevel.charAt(0).toUpperCase() + skillLevel.slice(1)}
                </AppText>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.statsRow}>
          <Stat label="Played" value={profile?.tournaments_played ?? 0} color={colors.primary} />
          <Stat label="Won" value={profile?.tournaments_won ?? 0} color={colors.win} />
          <Stat label="Points" value={profile?.ranking_points ?? 0} color={colors.ongoing} />
        </View>

        <SectionTitle title="Account" />
        <View style={styles.menuCard}>
          {accountItems.map((item, index) => (
            <MenuRow
              key={item.label}
              item={item}
              showBorder={index < accountItems.length - 1}
              styles={styles}
              colors={colors}
            />
          ))}
        </View>

        <SectionTitle title="Appearance" />
        <View style={styles.themeCard}>
          {THEME_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.value}
              activeOpacity={0.8}
              onPress={() => setTheme(option.value)}
              style={[styles.themeOption, theme === option.value ? styles.themeOptionActive : null]}
            >
              <Ionicons
                name={option.icon}
                size={20}
                color={theme === option.value ? colors.primary : colors.textMuted}
              />
              <AppText
                variant="label"
                weight={theme === option.value ? 'semiBold' : 'regular'}
                color={theme === option.value ? colors.primary : colors.textSecondary}
              >
                {option.label}
              </AppText>
            </TouchableOpacity>
          ))}
        </View>

        <SectionTitle title="More" />
        <View style={styles.menuCard}>
          {moreItems.map((item, index) => (
            <MenuRow
              key={item.label}
              item={item}
              showBorder={index < moreItems.length - 1}
              styles={styles}
              colors={colors}
            />
          ))}
        </View>

        <AppText variant="caption" color={colors.textMuted} center style={styles.version}>
          SmashDraw v1.0.0
        </AppText>
      </ScrollView>
      <ProfileLocationPicker visible={locationVisible} onClose={() => setLocationVisible(false)} />
    </SafeAreaView>
  );
}

function SectionTitle({ title }: { title: string }) {
  const { colors } = useTheme();
  return (
    <AppText
      variant="label"
      weight="semiBold"
      color={colors.textMuted}
      style={{ marginHorizontal: 20, marginBottom: 8 }}
    >
      {title.toUpperCase()}
    </AppText>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  const { colors } = useTheme();

  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <AppText variant="heading" weight="bold" color={color}>
        {value}
      </AppText>
      <AppText variant="caption" color={colors.textSecondary}>
        {label}
      </AppText>
    </View>
  );
}

function MenuRow({
  colors,
  item,
  showBorder,
  styles,
}: {
  colors: ReturnType<typeof useTheme>['colors'];
  item: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value: string;
    onPress: () => void;
    color?: string;
    multiline?: boolean;
  };
  showBorder: boolean;
  styles: ReturnType<typeof makeStyles>;
}) {
  const tint = item.color ?? colors.primary;
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={item.onPress}
      style={[styles.menuItem, showBorder ? styles.menuItemBorder : null]}
    >
      <View style={[styles.menuIcon, { backgroundColor: `${tint}15` }]}>
        <Ionicons name={item.icon} size={17} color={tint} />
      </View>
      <View style={styles.menuText}>
        <AppText variant="bodyLg" weight="medium" color={item.color ?? colors.text}>
          {item.label}
        </AppText>
        {item.value ? (
          <AppText
            variant="caption"
            color={colors.textSecondary}
            numberOfLines={item.multiline ? 2 : 1}
            style={styles.menuValue}
          >
            {item.value}
          </AppText>
        ) : null}
      </View>
      {!item.color ? <Ionicons name="chevron-forward" size={17} color={colors.textMuted} /> : null}
    </TouchableOpacity>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    safe: {
      backgroundColor: colors.background,
      flex: 1,
    },
    scroll: {
      paddingBottom: 32,
      paddingTop: 12,
    },
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 16,
      paddingHorizontal: 20,
      paddingVertical: 18,
    },
    avatar: {
      alignItems: 'center',
      borderRadius: 34,
      height: 68,
      justifyContent: 'center',
      width: 68,
    },
    identity: {
      flex: 1,
      gap: 4,
    },
    badges: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 4,
    },
    badge: {
      alignItems: 'center',
      borderRadius: 999,
      flexDirection: 'row',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    statsRow: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      flexDirection: 'row',
      marginBottom: 22,
      marginHorizontal: 20,
      paddingVertical: 16,
    },
    menuCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      marginBottom: 22,
      marginHorizontal: 20,
      overflow: 'hidden',
    },
    menuItem: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
      minHeight: 66,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    menuItemBorder: {
      borderBottomColor: colors.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    menuIcon: {
      alignItems: 'center',
      borderRadius: 10,
      height: 36,
      justifyContent: 'center',
      width: 36,
    },
    menuText: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    menuValue: {
      flexShrink: 1,
      lineHeight: 18,
    },
    themeCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 8,
      marginBottom: 22,
      marginHorizontal: 20,
      padding: 10,
    },
    themeOption: {
      alignItems: 'center',
      borderRadius: 12,
      flex: 1,
      gap: 4,
      paddingVertical: 12,
    },
    themeOptionActive: {
      backgroundColor: colors.primaryLight,
    },
    version: {
      marginTop: 2,
    },
  });
}
