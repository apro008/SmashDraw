import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  View,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { AppText } from '~/components/AppText';
import { TournamentCard } from '~/components/TournamentCard';
import { useTheme } from '~/hooks/useTheme';
import { Tournament, TournamentStatus } from '~/types';
import { fetchDiscoverableTournaments } from '~/lib/tournaments';
import { useFocusEffect } from 'expo-router';
import { useAlert } from '~/providers/AlertProvider';

const STATUSES: { label: string; value: TournamentStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Open', value: 'open' },
  { label: 'Live', value: 'ongoing' },
  { label: 'Paused', value: 'paused' },
  { label: 'Ended', value: 'completed' },
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
      const matchesStatus = status === 'all' || t.status === status;
      return matchesQuery && matchesCity && matchesStatus;
    });
  }, [city, query, status, tournaments]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Title */}
      <View style={styles.header}>
        <AppText variant="heading" weight="bold">
          Explore
        </AppText>
      </View>

      {/* Search */}
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
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Status segmented control — primary filter */}
      <View style={styles.statusWrap}>
        {STATUSES.map((s) => (
          <TouchableOpacity
            key={s.value}
            style={[styles.statusOption, status === s.value && styles.statusOptionActive]}
            onPress={() => setStatus(s.value)}
          >
            <AppText
              variant="label"
              weight={status === s.value ? 'semiBold' : 'regular'}
              color={status === s.value ? colors.primary : colors.textSecondary}
            >
              {s.label}
            </AppText>
          </TouchableOpacity>
        ))}
      </View>

      {/* City chips — secondary filter, only when multiple cities exist */}
      {cities.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.cityScroll}
          contentContainerStyle={styles.cityRow}
        >
          {cities.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.cityChip, city === c && styles.cityChipActive]}
              onPress={() => setCity(c)}
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
      )}

      {/* Content */}
      {loading ? (
        <View style={[styles.centered, { paddingBottom: tabBarHeight }]}>
          <ActivityIndicator color={colors.primary} />
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
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 6,
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      marginHorizontal: 20,
      marginBottom: 8,
      borderRadius: 12,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: colors.border,
      minHeight: 44,
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
      fontFamily: 'Inter_Regular',
      paddingVertical: 10,
    },
    statusWrap: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      flexDirection: 'row',
      marginHorizontal: 20,
      marginBottom: 2,
      padding: 3,
    },
    statusOption: {
      alignItems: 'center',
      borderRadius: 9,
      flex: 1,
      minHeight: 32,
      justifyContent: 'center',
    },
    statusOptionActive: {
      backgroundColor: colors.primaryLight,
    },
    cityScroll: {
      flexGrow: 0,
    },
    cityRow: {
      paddingHorizontal: 20,
      paddingVertical: 6,
      gap: 6,
      alignItems: 'center',
    },
    cityChip: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cityChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryLight,
    },
    countLabel: {
      paddingBottom: 8,
    },
    list: {
      paddingHorizontal: 20,
      paddingTop: 8,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
    },
    emptyTitle: {
      marginTop: 8,
    },
  });
}
