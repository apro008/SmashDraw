import { useMemo } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { AppText } from '~/components/AppText';
import { useTheme } from '~/hooks/useTheme';
import { useAuthStore } from '~/store/useAuthStore';
import { MOCK_TOURNAMENTS } from '~/data/mockTournaments';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: string;
  color: string;
  bgColor: string;
}

function StatCard({ label, value, icon, color, bgColor }: StatCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
      <View style={[styles.statIcon, { backgroundColor: bgColor }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <AppText variant="heading" weight="bold" style={{ marginTop: 12 }}>{value}</AppText>
      <AppText variant="caption" color={colors.textSecondary}>{label}</AppText>
    </View>
  );
}

interface QuickActionProps {
  icon: string;
  label: string;
  onPress: () => void;
}

function QuickAction({ icon, label, onPress }: QuickActionProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.qaIcon, { backgroundColor: colors.primaryLight }]}>
        <Ionicons name={icon as any} size={20} color={colors.primary} />
      </View>
      <AppText variant="caption" weight="medium" color={colors.textSecondary} style={{ marginTop: 6, textAlign: 'center' }}>
        {label}
      </AppText>
    </TouchableOpacity>
  );
}

export default function AdminDashboardScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const profile = useAuthStore((s) => s.profile);
  const user = useAuthStore((s) => s.user);
  const tabBarHeight = useBottomTabBarHeight();

  const displayName = profile?.name ?? user?.email?.split('@')[0] ?? 'Admin';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: tabBarHeight + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <View>
            <AppText variant="label" color={colors.textMuted}>Admin Panel</AppText>
            <AppText variant="title" weight="bold">{displayName}</AppText>
          </View>
          <View style={[styles.adminBadge, { backgroundColor: '#7C3AED20' }]}>
            <Ionicons name="shield-checkmark" size={13} color="#7C3AED" />
            <AppText variant="caption" weight="semiBold" color="#7C3AED">Admin</AppText>
          </View>
        </View>

        {/* Platform stats */}
        <View style={styles.section}>
          <AppText variant="title" weight="semiBold" style={styles.sectionTitle}>Platform Overview</AppText>
          <View style={styles.statsGrid}>
            <StatCard label="Total Users" value="—" icon="people-outline" color="#3B82F6" bgColor="#3B82F620" />
            <StatCard label="Tournaments" value={MOCK_TOURNAMENTS.length} icon="trophy-outline" color={colors.primary} bgColor={colors.primaryLight} />
            <StatCard label="Active Events" value="—" icon="flash-outline" color="#16A34A" bgColor="#16A34A20" />
            <StatCard label="Registrations" value="—" icon="clipboard-outline" color="#D97706" bgColor="#D9770620" />
          </View>
        </View>

        {/* Quick actions */}
        <View style={styles.section}>
          <AppText variant="title" weight="semiBold" style={styles.sectionTitle}>Quick Actions</AppText>
          <View style={styles.quickActionsRow}>
            <QuickAction icon="people-outline" label="Manage Users" onPress={() => router.push('/(app)/(admin-tabs)/users')} />
            <QuickAction icon="trophy-outline" label="Tournaments" onPress={() => router.push('/(app)/(admin-tabs)/tournaments')} />
            <QuickAction icon="bar-chart-outline" label="Reports" onPress={() => {}} />
            <QuickAction icon="settings-outline" label="Settings" onPress={() => {}} />
          </View>
        </View>

        {/* Recent tournaments */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <AppText variant="title" weight="semiBold">Recent Tournaments</AppText>
            <TouchableOpacity onPress={() => router.push('/(app)/(admin-tabs)/tournaments')}>
              <AppText variant="label" color={colors.primary} weight="medium">See all</AppText>
            </TouchableOpacity>
          </View>
          {MOCK_TOURNAMENTS.slice(0, 3).map((t) => (
            <TouchableOpacity
              key={t.id}
              style={styles.tournamentRow}
              onPress={() => router.push({ pathname: '/(app)/tournament/[id]', params: { id: t.id } })}
              activeOpacity={0.8}
            >
              <View style={[styles.rowIcon, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="trophy-outline" size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="bodyLg" weight="semiBold" numberOfLines={1}>{t.title}</AppText>
                <AppText variant="caption" color={colors.textMuted}>{t.city} · {t.status}</AppText>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: t.status === 'open' ? '#16A34A20' : colors.surface }]}>
                <AppText variant="caption" weight="semiBold" color={t.status === 'open' ? '#16A34A' : colors.textMuted}>
                  {t.status}
                </AppText>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    scroll: {},
    topBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 12,
    },
    adminBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
    },
    section: { paddingHorizontal: 20, marginBottom: 24 },
    sectionTitle: { marginBottom: 14 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    statCard: {
      width: '47%',
      borderRadius: 16,
      padding: 16,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 8,
      elevation: 2,
    },
    statIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    quickActionsRow: { flexDirection: 'row', justifyContent: 'space-between' },
    quickAction: { flex: 1, alignItems: 'center', gap: 2 },
    qaIcon: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    tournamentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    rowIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  });
}
