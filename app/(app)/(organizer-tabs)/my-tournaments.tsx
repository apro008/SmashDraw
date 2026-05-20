import { useState, useMemo, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { AppText } from '~/components/AppText';
import { TournamentCard } from '~/components/TournamentCard';
import { useTheme } from '~/hooks/useTheme';
import { useAuthStore } from '~/store/useAuthStore';
import { supabase } from '~/lib/supabase';
import { Tournament } from '~/types';
import { useAlert } from '~/providers/AlertProvider';
import { DEFAULT_TOURNAMENT_CATEGORIES } from '~/constants/TournamentCategories';
import { fetchOrganizerTournaments } from '~/lib/tournaments';

type StatusFilter = 'all' | 'draft' | 'open' | 'ongoing' | 'paused' | 'completed';

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'paused', label: 'Paused' },
  { value: 'draft', label: 'Draft' },
  { value: 'completed', label: 'Done' },
];

export default function OrganizerMyTournamentsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const tabBarHeight = useBottomTabBarHeight();
  const user = useAuthStore((s) => s.user);
  const { confirm, showAlert } = useAlert();

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');

  const loadTournaments = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const next = await fetchOrganizerTournaments(user.id);
      setTournaments(next);
    } catch (err: any) {
      showAlert({
        type: 'danger',
        title: 'Unable to load tournaments',
        message: err?.message ?? 'Please try again.',
      });
    } finally {
      setLoading(false);
    }
  }, [showAlert, user]);

  useFocusEffect(
    useCallback(() => {
      loadTournaments();
    }, [loadTournaments])
  );

  const publishTournament = async (tournament: Tournament) => {
    setPublishingId(tournament.id);
    try {
      if (!tournament.categories || tournament.categories.length === 0) {
        const { error: categoryError } = await supabase.from('tournament_categories').insert(
          DEFAULT_TOURNAMENT_CATEGORIES.map((category) => ({
            ...category,
            tournament_id: tournament.id,
          }))
        );
        if (categoryError) throw categoryError;
      }

      const { error } = await supabase
        .from('tournaments')
        .update({ status: 'open' })
        .eq('id', tournament.id);
      if (error) throw error;

      showAlert({
        type: 'success',
        title: 'Tournament published',
        message: 'Players can now find and register for this tournament.',
      });
      await loadTournaments();
    } catch (err: any) {
      showAlert({
        type: 'danger',
        title: 'Publish failed',
        message: err?.message ?? 'Please try again.',
      });
    } finally {
      setPublishingId(null);
    }
  };

  const requestPublish = (tournament: Tournament) => {
    confirm({
      title: 'Publish tournament?',
      message: 'This will make the tournament visible to players and enable registrations.',
      confirmText: 'Publish',
      onConfirm: () => publishTournament(tournament),
    });
  };

  const deleteTournament = async (tournament: Tournament) => {
    setDeletingId(tournament.id);
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .delete()
        .eq('id', tournament.id)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data)
        throw new Error('Delete was blocked. Please apply the latest Supabase RLS policy.');

      showAlert({
        type: 'success',
        title: 'Tournament deleted',
        message: 'The tournament and its registrations were removed.',
      });
      await loadTournaments();
    } catch (err: any) {
      showAlert({
        type: 'danger',
        title: 'Delete failed',
        message: err?.message ?? 'Please try again.',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const requestDelete = (tournament: Tournament) => {
    confirm({
      title: 'Delete tournament?',
      message:
        tournament.status === 'draft'
          ? 'This draft will be permanently deleted.'
          : 'This published tournament will be permanently deleted for players too.',
      confirmText: 'Delete',
      destructive: true,
      onConfirm: () => deleteTournament(tournament),
    });
  };

  const requestFinish = (tournament: Tournament) => {
    router.push({ pathname: '/(app)/finish-tournament/[id]', params: { id: tournament.id } });
  };

  const canFinishTournament = (tournament: Tournament) =>
    tournament.status === 'open' ||
    tournament.status === 'ongoing' ||
    tournament.status === 'paused';

  const filtered = filter === 'all' ? tournaments : tournaments.filter((t) => t.status === filter);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <AppText variant="heading" weight="bold">
          My Events
        </AppText>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => router.push('/(app)/(organizer-tabs)/create')}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <AppText variant="label" weight="semiBold" color="#fff">
            Create
          </AppText>
        </TouchableOpacity>
      </View>

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
        <View style={[styles.empty, { paddingBottom: tabBarHeight + 40 }]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={[styles.empty, { paddingBottom: tabBarHeight + 40 }]}>
          <Ionicons name="calendar-outline" size={56} color={colors.textMuted} />
          <AppText variant="title" weight="semiBold" center style={styles.emptyTitle}>
            No tournaments here
          </AppText>
          <AppText variant="body" color={colors.textSecondary} center>
            {filter === 'all'
              ? 'Create your first tournament and manage it here.'
              : `No ${filter} tournaments.`}
          </AppText>
          {filter === 'all' && (
            <TouchableOpacity
              style={[styles.emptyAction, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/(app)/(organizer-tabs)/create')}
              activeOpacity={0.85}
            >
              <AppText variant="bodyLg" weight="semiBold" color="#fff">
                Create Tournament
              </AppText>
            </TouchableOpacity>
          )}
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
                ...(item.status === 'draft'
                  ? [
                      {
                        icon: 'cloud-upload-outline' as const,
                        label: publishingId === item.id ? 'Publishing...' : 'Publish Tournament',
                        loading: publishingId === item.id,
                        onPress: () => requestPublish(item),
                      },
                    ]
                  : []),
                ...(canFinishTournament(item)
                  ? [
                      {
                        icon: 'flag-outline' as const,
                        label: 'Finish Tournament',
                        onPress: () => requestFinish(item),
                      },
                    ]
                  : []),
                {
                  destructive: true,
                  icon: 'trash-outline',
                  label: deletingId === item.id ? 'Deleting...' : 'Delete Tournament',
                  loading: deletingId === item.id,
                  onPress: () => requestDelete(item),
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
    createBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.primary,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
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
    emptyAction: {
      marginTop: 20,
      paddingHorizontal: 28,
      paddingVertical: 14,
      borderRadius: 12,
    },
  });
}
