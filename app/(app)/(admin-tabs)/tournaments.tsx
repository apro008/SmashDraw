import { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { AppText } from '~/components/AppText';
import { SkeletonLoader } from '~/components/common/SkeletonLoader';
import { TournamentCard } from '~/components/TournamentCard';
import { useTheme } from '~/hooks/useTheme';
import { Tournament } from '~/types';
import { fetchAdminTournaments, updateTournamentStatus } from '~/lib/tournaments';
import { useAlert } from '~/providers/AlertProvider';

type StatusFilter = 'all' | 'draft' | 'open' | 'ongoing' | 'paused' | 'completed' | 'cancelled';

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'paused', label: 'Paused' },
  { value: 'draft', label: 'Draft' },
  { value: 'completed', label: 'Done' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function AdminTournamentsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const tabBarHeight = useBottomTabBarHeight();
  const { confirm, showAlert } = useAlert();

  const [filter, setFilter] = useState<StatusFilter>('all');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const filtered: Tournament[] =
    filter === 'all' ? tournaments : tournaments.filter((t) => t.status === filter);

  const loadTournaments = useCallback(async () => {
    setLoading(true);
    try {
      setTournaments(await fetchAdminTournaments());
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

  const changeStatus = async (tournament: Tournament, status: Tournament['status']) => {
    setUpdatingId(tournament.id);
    try {
      await updateTournamentStatus(tournament.id, status);
      await loadTournaments();
      showAlert({
        type: 'success',
        title: status === 'paused' ? 'Tournament paused' : 'Tournament updated',
        message:
          status === 'paused'
            ? 'Players can still view it, but registration is stopped.'
            : 'The tournament status has been updated.',
      });
    } catch (err: any) {
      showAlert({
        type: 'danger',
        title: 'Could not update tournament',
        message: err?.message ?? 'Please check admin permissions and try again.',
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const requestPause = (tournament: Tournament) => {
    confirm({
      title: tournament.status === 'paused' ? 'Resume tournament?' : 'Pause tournament?',
      message:
        tournament.status === 'paused'
          ? 'This will reopen tournament registration.'
          : 'This will stop new registrations while keeping the tournament visible.',
      confirmText: tournament.status === 'paused' ? 'Resume' : 'Pause',
      destructive: tournament.status !== 'paused',
      onConfirm: () => changeStatus(tournament, tournament.status === 'paused' ? 'open' : 'paused'),
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <AppText variant="heading" weight="bold">
          All Tournaments
        </AppText>
        <AppText variant="body" color={colors.textSecondary}>
          {tournaments.length} total
        </AppText>
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[styles.chip, filter === f.value && { backgroundColor: colors.primary }]}
            onPress={() => setFilter(f.value)}
          >
            <AppText
              variant="caption"
              weight={filter === f.value ? 'semiBold' : 'regular'}
              color={filter === f.value ? '#fff' : colors.textSecondary}
            >
              {f.label}
            </AppText>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={[styles.list, { paddingBottom: tabBarHeight + 8 }]}>
          <SkeletonLoader count={4} variant="list" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={[styles.empty, { paddingBottom: tabBarHeight + 40 }]}>
          <Ionicons name="trophy-outline" size={56} color={colors.textMuted} />
          <AppText variant="title" weight="semiBold" center style={styles.emptyTitle}>
            No tournaments found
          </AppText>
          <AppText variant="body" color={colors.textSecondary} center>
            Tournaments will appear here once organizers create them.
          </AppText>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <TournamentCard
              tournament={item}
              onPress={() =>
                router.push({ pathname: '/(app)/tournament/[id]', params: { id: item.id } })
              }
              menuActions={[
                {
                  label: item.status === 'paused' ? 'Resume tournament' : 'Pause tournament',
                  icon: item.status === 'paused' ? 'play-outline' : 'pause-outline',
                  destructive: item.status !== 'paused',
                  loading: updatingId === item.id,
                  onPress: () => requestPause(item),
                },
                {
                  label: 'Finish match',
                  icon: 'flag-outline',
                  onPress: () =>
                    router.push({
                      pathname: '/(app)/tournament/[id]',
                      params: { id: item.id, finishMatch: '1' },
                    }),
                },
              ]}
            />
          )}
          contentContainerStyle={[styles.list, { paddingBottom: tabBarHeight + 8 }]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
        />
      )}
    </SafeAreaView>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 12,
    },
    filterRow: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 20,
      paddingBottom: 12,
      flexWrap: 'wrap',
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    list: { paddingHorizontal: 20, paddingTop: 8 },
    empty: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
      gap: 10,
    },
    emptyTitle: { marginTop: 8 },
  });
}
