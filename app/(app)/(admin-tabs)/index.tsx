import { Ionicons } from '@expo/vector-icons';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from '~/components/AppText';
import { SkeletonLoader } from '~/components/common/SkeletonLoader';
import {
  ActionTile,
  BarChart,
  MetricTile,
  StatusChart,
  TrendGraph,
} from '~/components/dashboard/DashboardWidgets';
import { useTheme } from '~/hooks/useTheme';
import { fetchAdminTournaments, getEffectiveTournamentStatus } from '~/lib/tournaments';
import { fetchProfileCount } from '~/lib/profiles';
import { useAlert } from '~/providers/AlertProvider';
import { useAuthStore } from '~/store/useAuthStore';
import { Tournament, TournamentStatus } from '~/types';

const STATUS_COLORS: Record<TournamentStatus, string> = {
  draft: '#64748B',
  open: '#16A34A',
  ongoing: '#EA580C',
  paused: '#7C3AED',
  completed: '#1A73E8',
  cancelled: '#DC2626',
};

const TREND_MONTHS = 6;

export default function AdminDashboardScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const profile = useAuthStore((s) => s.profile);
  const user = useAuthStore((s) => s.user);
  const tabBarHeight = useBottomTabBarHeight();
  const { showAlert } = useAlert();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [userCount, setUserCount] = useState(0);

  const displayName = profile?.name ?? user?.email?.split('@')[0] ?? 'Admin';

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [nextTournaments, profileCount] = await Promise.all([
        fetchAdminTournaments(),
        fetchProfileCount(),
      ]);
      setTournaments(nextTournaments);
      setUserCount(profileCount);
    } catch (err: any) {
      showAlert({
        type: 'danger',
        title: 'Unable to load admin dashboard',
        message: err?.message ?? 'Please try again.',
      });
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard])
  );

  const dashboard = useMemo(() => buildDashboard(tournaments), [tournaments]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: tabBarHeight + 16 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <AppText variant="label" color={colors.textMuted}>
              Admin panel
            </AppText>
            <AppText variant="heading" weight="bold" numberOfLines={1}>
              {displayName}
            </AppText>
          </View>
          <View style={styles.adminBadge}>
            <Ionicons name="shield-checkmark" size={14} color="#7C3AED" />
            <AppText variant="caption" weight="semiBold" color="#7C3AED">
              Admin
            </AppText>
          </View>
        </View>

        <View style={styles.hero}>
          <View>
            <AppText variant="label" weight="semiBold" color="rgba(255,255,255,0.72)">
              PLATFORM DASHBOARD
            </AppText>
            <AppText variant="heading" weight="bold" color="#fff" style={styles.heroTitle}>
              {tournaments.length} tournaments tracked
            </AppText>
            <AppText variant="caption" color="rgba(255,255,255,0.72)" style={{ marginTop: 4 }}>
              Monitor users, tournament health, and activity across SmashDraw.
            </AppText>
          </View>
        </View>

        {loading ? (
          <View style={styles.section}>
            <SkeletonLoader variant="detail" count={3} />
          </View>
        ) : (
          <>
            <View style={styles.metricGrid}>
              <MetricTile
                icon="people-outline"
                label="Users"
                sublabel="profiles"
                tone="#7C3AED"
                value={userCount}
              />
              <MetricTile
                icon="trophy-outline"
                label="Tournaments"
                sublabel="all statuses"
                tone="#1A73E8"
                value={tournaments.length}
              />
              <MetricTile
                icon="flash-outline"
                label="Active"
                sublabel="open or live"
                tone="#16A34A"
                value={dashboard.activeCount}
              />
              <MetricTile
                icon="checkmark-done-outline"
                label="Completed"
                sublabel="finished"
                tone="#F59E0B"
                value={dashboard.completedCount}
              />
            </View>

            <View style={styles.section}>
              <StatusChart data={dashboard.statusData} title="Platform Status Chart" />
            </View>

            <View style={styles.section}>
              <TrendGraph data={dashboard.monthData} title="Creation Graph" />
            </View>

            <View style={styles.section}>
              <BarChart data={dashboard.cityData} title="City Distribution" />
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <AppText variant="title" weight="semiBold">
                  Admin Actions
                </AppText>
              </View>
              <View style={styles.actionGrid}>
                <ActionTile
                  icon="add-circle-outline"
                  label="Create Tournament"
                  note="Set up a new event"
                  onPress={() => router.push('/(app)/(admin-tabs)/create')}
                  tone="#16A34A"
                />
                <ActionTile
                  icon="people-outline"
                  label="Manage Users"
                  note="Review profiles"
                  onPress={() => router.push('/(app)/(admin-tabs)/users')}
                  tone="#7C3AED"
                />
                <ActionTile
                  icon="trophy-outline"
                  label="Tournaments"
                  note="Moderate events"
                  onPress={() => router.push('/(app)/(admin-tabs)/tournaments')}
                  tone="#1A73E8"
                />
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <AppText variant="title" weight="semiBold">
                  Recent Tournaments
                </AppText>
                <TouchableOpacity onPress={() => router.push('/(app)/(admin-tabs)/tournaments')}>
                  <AppText variant="label" color={colors.primary} weight="medium">
                    See all
                  </AppText>
                </TouchableOpacity>
              </View>
              <View style={styles.eventList}>
                {tournaments.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Ionicons name="trophy-outline" size={28} color={colors.textMuted} />
                    <AppText variant="body" color={colors.textSecondary} center>
                      No tournaments found.
                    </AppText>
                  </View>
                ) : (
                  tournaments
                    .slice(0, 4)
                    .map((tournament) => (
                      <TournamentRow key={tournament.id} tournament={tournament} />
                    ))
                )}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function TournamentRow({ tournament }: { tournament: Tournament }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const status = getEffectiveTournamentStatus(tournament);
  const statusColor = STATUS_COLORS[status];

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={() =>
        router.push({ pathname: '/(app)/tournament/[id]', params: { id: tournament.id } })
      }
      style={styles.eventRow}
    >
      <View style={[styles.eventIcon, { backgroundColor: `${statusColor}18` }]}>
        <Ionicons name="trophy-outline" size={18} color={statusColor} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="bodyLg" weight="semiBold" numberOfLines={1}>
          {tournament.title}
        </AppText>
        <AppText variant="caption" color={colors.textMuted} numberOfLines={1}>
          {tournament.city} · {tournament.organizer_name}
        </AppText>
      </View>
      <View style={[styles.statusPill, { backgroundColor: `${statusColor}18` }]}>
        <AppText variant="xs" weight="semiBold" color={statusColor}>
          {status}
        </AppText>
      </View>
    </TouchableOpacity>
  );
}

/*
 * Every count is keyed off the *effective* status, the same thing the
 * tournaments tab filters on — otherwise an event past its close window still
 * counted as Open here while reading as Ended one tab over.
 */
function buildDashboard(tournaments: Tournament[]) {
  const byStatus = tournaments.reduce<Partial<Record<TournamentStatus, number>>>(
    (acc, tournament) => {
      const status = getEffectiveTournamentStatus(tournament);
      acc[status] = (acc[status] ?? 0) + 1;
      return acc;
    },
    {}
  );
  const count = (status: TournamentStatus) => byStatus[status] ?? 0;

  return {
    activeCount: count('open') + count('ongoing'),
    cityData: topCities(tournaments, 5),
    completedCount: count('completed'),
    monthData: buildMonthData(tournaments),
    // Ordered so no two neighbouring bands are a colour pair that converges
    // under red-green colour blindness, and every status is listed even at zero.
    statusData: [
      { label: 'Open', value: count('open'), color: STATUS_COLORS.open },
      { label: 'Live', value: count('ongoing'), color: STATUS_COLORS.ongoing },
      { label: 'Paused', value: count('paused'), color: STATUS_COLORS.paused },
      { label: 'Draft', value: count('draft'), color: STATUS_COLORS.draft },
      { label: 'Done', value: count('completed'), color: STATUS_COLORS.completed },
      { label: 'Cancelled', value: count('cancelled'), color: STATUS_COLORS.cancelled },
    ],
  };
}

function topCities(tournaments: Tournament[], limit: number) {
  const counts = tournaments.reduce<Record<string, number>>((acc, tournament) => {
    const city = tournament.city?.trim() || 'Unknown';
    acc[city] = (acc[city] ?? 0) + 1;
    return acc;
  }, {});
  const rows = Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([label, value]) => ({ label, value }));
  return rows.length > 0 ? rows : [{ label: 'None', value: 0 }];
}

/**
 * The last six calendar months, oldest first — including the quiet ones. The
 * old version keyed on the month name alone, so it lost the year, dropped empty
 * months entirely, and ran newest-first, which made the trend unreadable.
 */
function buildMonthData(tournaments: Tournament[]) {
  const now = new Date();
  const months = Array.from({ length: TREND_MONTHS }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (TREND_MONTHS - 1 - index), 1);
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: date.toLocaleDateString('en-IN', { month: 'short' }),
      value: 0,
    };
  });
  const byKey = new Map(months.map((month) => [month.key, month]));

  for (const tournament of tournaments) {
    const created = new Date(tournament.created_at);
    const bucket = byKey.get(`${created.getFullYear()}-${created.getMonth()}`);
    if (bucket) bucket.value += 1;
  }

  return months.map(({ label, value }) => ({ label, value }));
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    safe: {
      backgroundColor: colors.background,
      flex: 1,
    },
    scroll: {},
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
      justifyContent: 'space-between',
      paddingBottom: 12,
      paddingHorizontal: 20,
      paddingTop: 16,
    },
    adminBadge: {
      alignItems: 'center',
      backgroundColor: '#7C3AED20',
      borderRadius: 999,
      flexDirection: 'row',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    hero: {
      backgroundColor: '#123C69',
      borderRadius: 18,
      marginHorizontal: 20,
      padding: 18,
    },
    heroTitle: {
      marginTop: 4,
    },
    metricGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      paddingHorizontal: 20,
      paddingTop: 16,
    },
    section: {
      paddingHorizontal: 20,
      paddingTop: 18,
    },
    sectionHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    actionGrid: {
      gap: 10,
    },
    eventList: {
      gap: 10,
    },
    eventRow: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 12,
      padding: 12,
    },
    eventIcon: {
      alignItems: 'center',
      borderRadius: 12,
      height: 42,
      justifyContent: 'center',
      width: 42,
    },
    statusPill: {
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    emptyCard: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      gap: 8,
      padding: 18,
    },
  });
}
