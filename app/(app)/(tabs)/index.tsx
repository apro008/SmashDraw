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
  MetricPill,
  TournamentSnippet,
} from '~/components/dashboard/DashboardWidgets';
import { useTheme } from '~/hooks/useTheme';
import { fetchOpenTournaments } from '~/lib/tournaments';
import { useAlert } from '~/providers/AlertProvider';
import { useAuthStore } from '~/store/useAuthStore';
import { Tournament } from '~/types';

export default function HomeScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const profile = useAuthStore((s) => s.profile);
  const user = useAuthStore((s) => s.user);
  const tabBarHeight = useBottomTabBarHeight();
  const { showAlert } = useAlert();

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);

  const loadTournaments = useCallback(async () => {
    setLoading(true);
    try {
      setTournaments(await fetchOpenTournaments());
    } catch (err: any) {
      showAlert({
        type: 'danger',
        title: 'Unable to load tournaments',
        message: err?.message ?? 'Please try again.',
      });
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  useFocusEffect(
    useCallback(() => {
      loadTournaments();
    }, [loadTournaments])
  );

  const dashboard = useMemo(() => buildDashboard(tournaments), [tournaments]);
  const liveTournaments = useMemo(
    () => tournaments.filter((t) => t.status === 'ongoing'),
    [tournaments]
  );
  const openTournaments = useMemo(
    () => tournaments.filter((t) => t.status === 'open'),
    [tournaments]
  );
  const displayName = profile?.name ?? user?.email?.split('@')[0] ?? 'Player';

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTournaments();
    setRefreshing(false);
  };

  const goToTournament = useCallback(
    (id: string) => router.push({ pathname: '/(app)/tournament/[id]', params: { id } }),
    []
  );

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
        {/* ── Header ───────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <AppText variant="label" color={colors.textMuted}>
              {greeting()},
            </AppText>
            <AppText variant="heading" weight="bold" numberOfLines={1}>
              {displayName}
            </AppText>
          </View>
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons name="notifications-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* ── Hero ─────────────────────────────────────────────── */}
        <View style={styles.hero}>
          {/* Subtle court-line background pattern */}
          <View style={styles.courtOuter}>
            <View style={styles.courtCenterLine} />
            <View style={styles.courtNetLine} />
            <View style={[styles.courtServiceLine, { left: '22%' }]} />
            <View style={[styles.courtServiceLine, { right: '22%' }]} />
          </View>

          {/* Status badge */}
          <View style={styles.heroTopRow}>
            <View
              style={[
                styles.heroPill,
                liveTournaments.length > 0 ? styles.heroPillLive : styles.heroPillOpen,
              ]}
            >
              {liveTournaments.length > 0 ? (
                <>
                  <View style={styles.heroPillDot} />
                  <AppText variant="xs" weight="semiBold" color="#fff">
                    {liveTournaments.length} live now
                  </AppText>
                </>
              ) : (
                <>
                  <Ionicons name="flash-outline" size={12} color="#FDE68A" />
                  <AppText variant="xs" weight="semiBold" color="#fff">
                    {dashboard.openCount} open
                  </AppText>
                </>
              )}
            </View>
          </View>

          <AppText
            variant="label"
            weight="semiBold"
            color="rgba(255,255,255,0.45)"
            style={{ marginTop: 12 }}
          >
            TOURNAMENT DISCOVERY
          </AppText>
          <AppText style={styles.heroTitle} weight="bold" color="#fff">
            {'Find Your Next\nTournament'}
          </AppText>

          <TouchableOpacity
            activeOpacity={0.86}
            onPress={() => router.push('/(app)/(tabs)/explore')}
            style={styles.searchButton}
          >
            <Ionicons name="search-outline" size={16} color="rgba(255,255,255,0.6)" />
            <AppText variant="body" color="rgba(255,255,255,0.5)" style={{ flex: 1 }}>
              Search tournaments, cities…
            </AppText>
            <View style={styles.searchArrow}>
              <Ionicons name="arrow-forward" size={14} color="#fff" />
            </View>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadSection}>
            <SkeletonLoader variant="detail" count={3} />
          </View>
        ) : (
          <>
            {/* ── Metric Pills ──────────────────────────────────── */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pillsRow}
            >
              <MetricPill
                icon="calendar-outline"
                label="Open events"
                tone="#16A34A"
                value={dashboard.openCount}
              />
              <MetricPill
                icon="location-outline"
                label="Cities"
                tone="#7C3AED"
                value={dashboard.cityCount}
              />
              <MetricPill
                icon="albums-outline"
                label="Categories"
                tone="#F59E0B"
                value={dashboard.categoryCount}
              />
              <MetricPill
                icon="trophy-outline"
                label="Prize events"
                tone="#EF4444"
                value={dashboard.prizeCount}
              />
            </ScrollView>

            {/* ── Live Now ─────────────────────────────────────── */}
            {liveTournaments.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.liveHeaderRow}>
                    <View style={styles.liveDot} />
                    <AppText variant="title" weight="semiBold">
                      Live Now
                    </AppText>
                  </View>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.snippetsRow}
                >
                  {liveTournaments.map((t) => (
                    <TournamentSnippet
                      key={t.id}
                      tournament={t}
                      onPress={() => goToTournament(t.id)}
                    />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* ── Open Tournaments ─────────────────────────────── */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <AppText variant="title" weight="semiBold">
                  Open Tournaments
                </AppText>
                <TouchableOpacity onPress={() => router.push('/(app)/(tabs)/explore')}>
                  <AppText variant="label" color={colors.primary} weight="medium">
                    See all
                  </AppText>
                </TouchableOpacity>
              </View>
              {openTournaments.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="calendar-outline" size={28} color={colors.textMuted} />
                  <AppText variant="body" color={colors.textSecondary} center>
                    No open tournaments yet.
                  </AppText>
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.snippetsRow}
                >
                  {openTournaments.slice(0, 8).map((t) => (
                    <TournamentSnippet
                      key={t.id}
                      tournament={t}
                      onPress={() => goToTournament(t.id)}
                    />
                  ))}
                </ScrollView>
              )}
            </View>

            {/* ── Quick Actions ─────────────────────────────────── */}
            <View style={styles.section}>
              <AppText variant="title" weight="semiBold" style={styles.sectionTitle}>
                Quick Actions
              </AppText>
              <View style={styles.actionGrid}>
                <ActionTile
                  icon="compass-outline"
                  label="Explore"
                  note="Browse all events"
                  onPress={() => router.push('/(app)/(tabs)/explore')}
                  tone="#1A73E8"
                />
                <ActionTile
                  icon="ticket-outline"
                  label="My Events"
                  note="My registrations"
                  onPress={() => router.push('/(app)/(tabs)/my-tournaments')}
                  tone="#16A34A"
                />
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function buildDashboard(tournaments: Tournament[]) {
  const openCount = tournaments.filter((t) => t.status === 'open').length;
  const cityCount = new Set(tournaments.map((t) => t.city)).size;
  const categoryCount = tournaments.reduce((sum, t) => sum + (t.categories?.length ?? 0), 0);
  const prizeCount = tournaments.filter((t) => t.categories?.some((c) => !!c.prize)).length;
  return { categoryCount, cityCount, openCount, prizeCount };
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    safe: {
      backgroundColor: colors.background,
      flex: 1,
    },
    scroll: {},

    // Header
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 14,
      justifyContent: 'space-between',
      paddingBottom: 12,
      paddingHorizontal: 20,
      paddingTop: 16,
    },
    iconButton: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 20,
      borderWidth: 1,
      height: 40,
      justifyContent: 'center',
      width: 40,
    },

    // Hero
    hero: {
      backgroundColor: '#0F2A4A',
      borderRadius: 20,
      marginHorizontal: 20,
      overflow: 'hidden',
      paddingBottom: 18,
      paddingHorizontal: 18,
      paddingTop: 16,
    },
    courtOuter: {
      borderColor: 'rgba(255,255,255,0.1)',
      borderRadius: 10,
      borderWidth: 1,
      bottom: 14,
      left: 14,
      overflow: 'hidden',
      position: 'absolute',
      right: 14,
      top: 14,
    },
    courtCenterLine: {
      backgroundColor: 'rgba(255,255,255,0.07)',
      bottom: 0,
      left: '50%',
      position: 'absolute',
      top: 0,
      width: 1,
    },
    courtNetLine: {
      backgroundColor: 'rgba(255,255,255,0.1)',
      height: 1,
      left: 0,
      position: 'absolute',
      right: 0,
      top: '50%',
    },
    courtServiceLine: {
      backgroundColor: 'rgba(255,255,255,0.06)',
      bottom: 0,
      position: 'absolute',
      top: 0,
      width: 1,
    },
    heroTopRow: {
      flexDirection: 'row',
    },
    heroPill: {
      alignItems: 'center',
      borderRadius: 999,
      flexDirection: 'row',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    heroPillLive: {
      backgroundColor: 'rgba(234,88,12,0.7)',
    },
    heroPillOpen: {
      backgroundColor: 'rgba(255,255,255,0.12)',
    },
    heroPillDot: {
      backgroundColor: '#FCA5A5',
      borderRadius: 3,
      height: 6,
      width: 6,
    },
    heroTitle: {
      fontSize: 26,
      lineHeight: 33,
      marginTop: 4,
    },
    searchButton: {
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.09)',
      borderColor: 'rgba(255,255,255,0.14)',
      borderRadius: 14,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 10,
      marginTop: 18,
      minHeight: 48,
      paddingHorizontal: 13,
    },
    searchArrow: {
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.16)',
      borderRadius: 8,
      height: 28,
      justifyContent: 'center',
      width: 28,
    },

    // Content
    loadSection: {
      paddingHorizontal: 20,
      paddingTop: 16,
    },
    pillsRow: {
      gap: 10,
      paddingHorizontal: 20,
      paddingTop: 16,
    },
    section: {
      paddingHorizontal: 20,
      paddingTop: 20,
    },
    sectionHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    sectionTitle: {
      marginBottom: 12,
    },
    liveHeaderRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 7,
    },
    liveDot: {
      backgroundColor: '#EF4444',
      borderRadius: 5,
      height: 9,
      width: 9,
    },
    snippetsRow: {
      gap: 12,
    },
    actionGrid: {
      gap: 10,
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
