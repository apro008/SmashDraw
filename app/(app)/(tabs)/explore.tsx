import { useCallback, useMemo, useState } from 'react';
import { View, TextInput, FlatList, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { AppText } from '~/components/AppText';
import { SkeletonLoader } from '~/components/common/SkeletonLoader';
import { TournamentCard } from '~/components/TournamentCard';
import { useTheme } from '~/hooks/useTheme';
import { Tournament, TournamentStatus } from '~/types';
import { fetchDiscoverableTournaments, getEffectiveTournamentStatus } from '~/lib/tournaments';
import { useAlert } from '~/providers/AlertProvider';

const STATUSES: { label: string; value: TournamentStatus | 'all'; color?: string }[] = [
  { label: 'All', value: 'all' },
  { label: 'Open', value: 'open', color: '#16A34A' },
  { label: 'Live', value: 'ongoing', color: '#EA580C' },
  { label: 'Paused', value: 'paused', color: '#7C3AED' },
  { label: 'Ended', value: 'completed', color: '#6B7280' },
];

export default function ExploreScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const tabBarHeight = useBottomTabBarHeight();
  const { showAlert } = useAlert();

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('All');
  const [status, setStatus] = useState<TournamentStatus | 'all'>('all');
  const [filterOpen, setFilterOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      setLoading(true);
      fetchDiscoverableTournaments()
        .then((data) => {
          if (mounted) setTournaments(data);
        })
        .catch((err: any) => {
          showAlert({
            type: 'danger',
            title: 'Unable to load tournaments',
            message: err?.message ?? 'Please try again.',
          });
        })
        .finally(() => {
          if (mounted) setLoading(false);
        });
      return () => {
        mounted = false;
      };
    }, [showAlert])
  );

  const cities = useMemo(
    () => ['All', ...Array.from(new Set(tournaments.map((t) => t.city))).sort()],
    [tournaments]
  );

  const filtered = useMemo(() => {
    return tournaments.filter((t) => {
      const matchesQuery =
        !query ||
        t.title.toLowerCase().includes(query.toLowerCase()) ||
        t.city.toLowerCase().includes(query.toLowerCase());
      const matchesCity = city === 'All' || t.city === city;
      const matchesStatus = status === 'all' || getEffectiveTournamentStatus(t) === status;
      return matchesQuery && matchesCity && matchesStatus;
    });
  }, [city, query, status, tournaments]);

  const hasActiveFilters = status !== 'all' || city !== 'All';

  const handleClearFilters = () => {
    setStatus('all');
    setCity('All');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <AppText variant="heading" weight="bold">
          Explore
        </AppText>
      </View>

      {/* Search bar with filter icon */}
      <View style={styles.searchRow}>
        <View style={styles.searchWrap}>
          <Ionicons
            name="search-outline"
            size={18}
            color={colors.textMuted}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search tournaments or cities"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 ? (
            <TouchableOpacity onPress={() => setQuery('')} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Filter toggle button */}
        <TouchableOpacity
          style={[
            styles.filterBtn,
            filterOpen && { backgroundColor: colors.primaryLight, borderColor: colors.primary },
          ]}
          onPress={() => setFilterOpen((v) => !v)}
          activeOpacity={0.8}
        >
          <Ionicons
            name="options-outline"
            size={20}
            color={
              filterOpen ? colors.primary : hasActiveFilters ? colors.primary : colors.textSecondary
            }
          />
          {hasActiveFilters && !filterOpen ? (
            <View style={[styles.filterBadge, { backgroundColor: colors.primary }]} />
          ) : null}
        </TouchableOpacity>
      </View>

      {/* Filter panel */}
      {filterOpen ? (
        <View style={styles.filterPanel}>
          <View style={styles.filterPanelHeader}>
            <AppText variant="label" weight="semiBold" color={colors.textSecondary}>
              Filters
            </AppText>
            {hasActiveFilters ? (
              <TouchableOpacity onPress={handleClearFilters}>
                <AppText variant="label" weight="semiBold" color={colors.primary}>
                  Clear all
                </AppText>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Status filter */}
          <AppText
            variant="xs"
            weight="semiBold"
            color={colors.textMuted}
            style={styles.filterLabel}
          >
            STATUS
          </AppText>
          <View style={styles.statusWrap}>
            {STATUSES.map((s) => {
              const isActive = status === s.value;
              const chipColor = s.color ?? colors.primary;
              return (
                <TouchableOpacity
                  key={s.value}
                  style={[
                    styles.statusChip,
                    isActive && { backgroundColor: chipColor + '20', borderColor: chipColor },
                  ]}
                  onPress={() => setStatus(s.value)}
                  activeOpacity={0.8}
                >
                  {s.color && isActive ? (
                    <View style={[styles.statusDot, { backgroundColor: chipColor }]} />
                  ) : null}
                  <AppText
                    variant="label"
                    weight={isActive ? 'semiBold' : 'regular'}
                    color={isActive ? chipColor : colors.textSecondary}
                  >
                    {s.label}
                  </AppText>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* City filter — only when multiple cities */}
          {cities.length > 1 ? (
            <>
              <AppText
                variant="xs"
                weight="semiBold"
                color={colors.textMuted}
                style={styles.filterLabel}
              >
                CITY
              </AppText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.cityRow}
              >
                {cities.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.cityChip, city === c && styles.cityChipActive]}
                    onPress={() => setCity(c)}
                    activeOpacity={0.8}
                  >
                    <AppText
                      variant="label"
                      weight={city === c ? 'semiBold' : 'regular'}
                      color={city === c ? colors.primary : colors.textSecondary}
                    >
                      {c}
                    </AppText>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          ) : null}
        </View>
      ) : null}

      {/* Content */}
      {loading ? (
        <View style={[styles.skeletonList, { paddingBottom: tabBarHeight + 8 }]}>
          <SkeletonLoader count={5} variant="list" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={[styles.centered, { paddingBottom: tabBarHeight }]}>
          <Ionicons name="search-outline" size={44} color={colors.textMuted} />
          <AppText
            variant="title"
            weight="semiBold"
            color={colors.textMuted}
            center
            style={styles.emptyTitle}
          >
            No tournaments found
          </AppText>
          <AppText variant="body" color={colors.textMuted} center>
            Try adjusting your search or filters
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
                  icon: 'information-circle-outline',
                  label: 'View Details',
                  onPress: () =>
                    router.push({ pathname: '/(app)/tournament/[id]', params: { id: item.id } }),
                },
                {
                  icon: 'stats-chart-outline',
                  label: 'Show Result',
                  onPress: () =>
                    router.push({
                      pathname: '/(app)/tournament-result/[id]',
                      params: { id: item.id },
                    }),
                },
              ]}
            />
          )}
          ListHeaderComponent={
            <AppText
              variant="label"
              weight="semiBold"
              color={colors.textMuted}
              style={styles.countLabel}
            >
              {filtered.length} TOURNAMENT{filtered.length === 1 ? '' : 'S'}
            </AppText>
          }
          contentContainerStyle={[styles.list, { paddingBottom: tabBarHeight + 8 }]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}
    </SafeAreaView>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 6 },

    // Search row
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      marginBottom: 8,
    },
    searchWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: colors.border,
      minHeight: 44,
    },
    searchIcon: { marginRight: 8 },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
      fontFamily: 'Inter_Regular',
      paddingVertical: 10,
    },
    clearBtn: { padding: 2 },
    filterBtn: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterBadge: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 7,
      height: 7,
      borderRadius: 4,
      borderWidth: 1.5,
      borderColor: colors.surface,
    },

    // Filter panel
    filterPanel: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      marginHorizontal: 16,
      marginBottom: 10,
      paddingHorizontal: 14,
      paddingTop: 12,
      paddingBottom: 14,
      gap: 4,
    },
    filterPanelHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    filterLabel: {
      marginTop: 8,
      marginBottom: 6,
      letterSpacing: 0.5,
    },
    statusWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    statusChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    cityRow: {
      gap: 6,
      paddingBottom: 2,
    },
    cityChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cityChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryLight,
    },

    // List
    countLabel: { paddingBottom: 8 },
    list: { paddingHorizontal: 16, paddingTop: 8 },
    skeletonList: { paddingHorizontal: 16, paddingTop: 8 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 6 },
    emptyTitle: { marginTop: 8 },
  });
}
