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
import { fetchOrganizerTournaments } from '~/lib/tournaments';
import { useAlert } from '~/providers/AlertProvider';
import { useAuthStore } from '~/store/useAuthStore';
import { Tournament } from '~/types';

const STATUS_CFG: Record<string, { color: string; label: string }> = {
  draft: { color: '#64748B', label: 'Draft' },
  open: { color: '#16A34A', label: 'Open' },
  ongoing: { color: '#EA580C', label: 'Live' },
  paused: { color: '#7C3AED', label: 'Paused' },
  completed: { color: '#1A73E8', label: 'Completed' },
  cancelled: { color: '#DC2626', label: 'Cancelled' },
};

export default function OrganizerHomeScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const profile = useAuthStore((s) => s.profile);
  const user = useAuthStore((s) => s.user);
  const tabBarHeight = useBottomTabBarHeight();
  const { showAlert } = useAlert();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);

  const displayName = profile?.name ?? user?.email?.split('@')[0] ?? 'Organizer';

  const loadTournaments = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      setTournaments(await fetchOrganizerTournaments(user.id));
    } catch (err: any) {
      showAlert({
        type: 'danger',
        title: 'Unable to load dashboard',
        message: err?.message ?? 'Please try again.',
      });
    } finally {
      setLoading(false);
    }
  }, [showAlert, user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadTournaments();
    }, [loadTournaments])
  );

  const dashboard = useMemo(() => buildDashboard(tournaments), [tournaments]);
  const activeTournaments = useMemo(
    () => tournaments.filter((t) => t.status === 'open' || t.status === 'ongoing'),
    [tournaments]
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTournaments();
    setRefreshing(false);
  };

  const goToTournament = useCallback(
    (id: string) => router.push({ pathname: '/(app)/tournament/[id]', params: { id } }),
    []
  );

  const heroLabel =
    dashboard.activeCount > 0
      ? `${dashboard.activeCount} active${dashboard.draftCount > 0 ? ` · ${dashboard.draftCount} draft` : ''}`
      : dashboard.draftCount > 0
        ? `${dashboard.draftCount} draft${dashboard.draftCount > 1 ? 's' : ''}`
        : 'No events yet';

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
              Organizer dashboard,
            </AppText>
            <AppText variant="heading" weight="bold" numberOfLines={1}>
              {displayName}
            </AppText>
          </View>
          <View style={styles.roleBadge}>
            <Ionicons name="trophy" size={14} color={colors.primary} />
            <AppText variant="caption" weight="semiBold" color={colors.primary}>
              Organizer
            </AppText>
          </View>
        </View>

        {/* ── Hero ─────────────────────────────────────────────── */}
        <View style={styles.hero}>
          {/* Court-line decoration */}
          <View style={styles.courtOuter}>
            <View style={styles.courtCenterLine} />
            <View style={styles.courtNetLine} />
            <View style={[styles.courtServiceLine, { left: '22%' }]} />
            <View style={[styles.courtServiceLine, { right: '22%' }]} />
          </View>

          <View style={styles.heroContent}>
            <View style={{ flex: 1 }}>
              <AppText variant="label" weight="semiBold" color="rgba(255,255,255,0.45)">
                EVENT CONTROL ROOM
              </AppText>
              <AppText style={styles.heroTitle} weight="bold" color="#fff">
                {heroLabel}
              </AppText>
              <AppText variant="caption" color="rgba(255,255,255,0.5)" style={{ marginTop: 4 }}>
                Draws, registrations &amp; results in one view
              </AppText>
            </View>
            <TouchableOpacity
              activeOpacity={0.86}
              onPress={() => router.push('/(app)/(organizer-tabs)/create')}
              style={styles.createButton}
            >
              <Ionicons name="add" size={22} color="#0C3347" />
            </TouchableOpacity>
          </View>
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
                icon="albums-outline"
                label="Total events"
                tone="#1A73E8"
                value={tournaments.length}
              />
              <MetricPill
                icon="flash-outline"
                label="Active"
                tone="#16A34A"
                value={dashboard.activeCount}
              />
              <MetricPill
                icon="document-text-outline"
                label="Drafts"
                tone="#64748B"
                value={dashboard.draftCount}
              />
              <MetricPill
                icon="people-outline"
                label="Slots filled"
                tone="#F59E0B"
                value={`${dashboard.filledSlots}/${dashboard.totalSlots}`}
              />
            </ScrollView>

            {/* ── Active Events ─────────────────────────────────── */}
            {activeTournaments.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.activeHeaderRow}>
                    <View style={styles.activeDot} />
                    <AppText variant="title" weight="semiBold">
                      Active Events
                    </AppText>
                  </View>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.snippetsRow}
                >
                  {activeTournaments.map((t) => (
                    <TournamentSnippet
                      key={t.id}
                      tournament={t}
                      onPress={() => goToTournament(t.id)}
                    />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* ── Recent Tournaments ────────────────────────────── */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <AppText variant="title" weight="semiBold">
                  Recent Tournaments
                </AppText>
                <TouchableOpacity
                  onPress={() => router.push('/(app)/(organizer-tabs)/my-tournaments')}
                >
                  <AppText variant="label" color={colors.primary} weight="medium">
                    See all
                  </AppText>
                </TouchableOpacity>
              </View>
              {tournaments.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="calendar-outline" size={28} color={colors.textMuted} />
                  <AppText variant="body" color={colors.textSecondary} center>
                    Create your first tournament to start tracking performance.
                  </AppText>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => router.push('/(app)/(organizer-tabs)/create')}
                    style={styles.emptyAction}
                  >
                    <Ionicons name="add" size={15} color="#fff" />
                    <AppText variant="label" weight="semiBold" color="#fff">
                      Create Tournament
                    </AppText>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.eventList}>
                  {tournaments.slice(0, 6).map((t) => (
                    <TournamentRow key={t.id} tournament={t} />
                  ))}
                </View>
              )}
            </View>

            {/* ── Quick Actions ─────────────────────────────────── */}
            <View style={styles.section}>
              <AppText variant="title" weight="semiBold" style={styles.sectionTitle}>
                Quick Actions
              </AppText>
              <View style={styles.actionGrid}>
                <ActionTile
                  icon="add-circle-outline"
                  label="Create Tournament"
                  note="Build a new draw"
                  onPress={() => router.push('/(app)/(organizer-tabs)/create')}
                  tone="#1A73E8"
                />
                <ActionTile
                  icon="list-outline"
                  label="Manage Events"
                  note="Publish, finish, update"
                  onPress={() => router.push('/(app)/(organizer-tabs)/my-tournaments')}
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

function TournamentRow({ tournament }: { tournament: Tournament }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const cfg = STATUS_CFG[tournament.status] ?? STATUS_CFG.draft;

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={() =>
        router.push({ pathname: '/(app)/tournament/[id]', params: { id: tournament.id } })
      }
      style={styles.eventRow}
    >
      <View style={[styles.eventIcon, { backgroundColor: `${cfg.color}18` }]}>
        <Ionicons name="trophy-outline" size={18} color={cfg.color} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="bodyLg" weight="semiBold" numberOfLines={1}>
          {tournament.title}
        </AppText>
        <AppText variant="caption" color={colors.textMuted} numberOfLines={1}>
          {tournament.city} · {formatDate(tournament.start_date)}
        </AppText>
      </View>
      <View style={[styles.statusPill, { backgroundColor: `${cfg.color}18` }]}>
        <AppText variant="xs" weight="semiBold" color={cfg.color}>
          {cfg.label}
        </AppText>
      </View>
    </TouchableOpacity>
  );
}

function buildDashboard(tournaments: Tournament[]) {
  const activeCount = tournaments.filter(
    (t) => t.status === 'open' || t.status === 'ongoing'
  ).length;
  const draftCount = tournaments.filter((t) => t.status === 'draft').length;
  const totalSlots = tournaments.reduce(
    (sum, t) => sum + (t.categories?.reduce((s, c) => s + c.max_players, 0) ?? 0),
    0
  );
  const filledSlots = tournaments.reduce(
    (sum, t) => sum + (t.categories?.reduce((s, c) => s + c.current_players, 0) ?? 0),
    0
  );
  return { activeCount, draftCount, filledSlots, totalSlots };
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
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
      gap: 12,
      justifyContent: 'space-between',
      paddingBottom: 12,
      paddingHorizontal: 20,
      paddingTop: 16,
    },
    roleBadge: {
      alignItems: 'center',
      backgroundColor: colors.primaryLight,
      borderRadius: 999,
      flexDirection: 'row',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },

    // Hero
    hero: {
      backgroundColor: '#0C3347',
      borderRadius: 20,
      marginHorizontal: 20,
      overflow: 'hidden',
      padding: 18,
    },
    courtOuter: {
      borderColor: 'rgba(255,255,255,0.09)',
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
      backgroundColor: 'rgba(255,255,255,0.06)',
      bottom: 0,
      left: '50%',
      position: 'absolute',
      top: 0,
      width: 1,
    },
    courtNetLine: {
      backgroundColor: 'rgba(255,255,255,0.09)',
      height: 1,
      left: 0,
      position: 'absolute',
      right: 0,
      top: '50%',
    },
    courtServiceLine: {
      backgroundColor: 'rgba(255,255,255,0.05)',
      bottom: 0,
      position: 'absolute',
      top: 0,
      width: 1,
    },
    heroContent: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 14,
    },
    heroTitle: {
      fontSize: 22,
      lineHeight: 28,
      marginTop: 4,
    },
    createButton: {
      alignItems: 'center',
      backgroundColor: '#FDE68A',
      borderRadius: 16,
      height: 46,
      justifyContent: 'center',
      width: 46,
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
    activeHeaderRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 7,
    },
    activeDot: {
      backgroundColor: '#16A34A',
      borderRadius: 5,
      height: 9,
      width: 9,
    },
    snippetsRow: {
      gap: 12,
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
    actionGrid: {
      gap: 10,
    },
    emptyCard: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      gap: 12,
      padding: 20,
    },
    emptyAction: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 10,
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
  });
}
