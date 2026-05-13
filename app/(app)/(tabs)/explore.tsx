import { useState, useMemo } from 'react';
import {
  View,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '~/components/AppText';
import { TournamentCard } from '~/components/TournamentCard';
import { useTheme } from '~/hooks/useTheme';
import { Tournament, TournamentStatus } from '~/types';

const ALL_TOURNAMENTS: Tournament[] = [
  {
    id: 't1',
    title: 'Kolkata Open Badminton Championship 2025',
    description: null,
    city: 'Kolkata',
    state: 'West Bengal',
    venue: 'Netaji Indoor Stadium',
    venue_address: null,
    start_date: '2025-06-15',
    end_date: '2025-06-17',
    registration_deadline: '2025-06-10',
    organizer_id: 'u1',
    organizer_name: 'West Bengal Badminton Association',
    banner_url: null,
    rules: null,
    status: 'open',
    contact_phone: null,
    contact_email: null,
    prize_pool: '₹50,000',
    max_courts: 8,
    created_at: '2025-05-01',
    categories: [
      { id: 'c1', tournament_id: 't1', name: "Men's Singles", entry_fee: 500, max_players: 64, current_players: 38, skill_level: 'open', prize: null },
      { id: 'c2', tournament_id: 't1', name: "Women's Singles", entry_fee: 500, max_players: 32, current_players: 18, skill_level: 'open', prize: null },
    ],
  },
  {
    id: 't2',
    title: 'Durgapur Smash Series',
    description: null,
    city: 'Durgapur',
    state: 'West Bengal',
    venue: 'Durgapur Sports Complex',
    venue_address: null,
    start_date: '2025-06-22',
    end_date: '2025-06-22',
    registration_deadline: '2025-06-18',
    organizer_id: 'u2',
    organizer_name: 'Durgapur Shuttlers Club',
    banner_url: null,
    rules: null,
    status: 'open',
    contact_phone: null,
    contact_email: null,
    prize_pool: '₹20,000',
    max_courts: 4,
    created_at: '2025-05-10',
    categories: [
      { id: 'c4', tournament_id: 't2', name: "Men's Doubles", entry_fee: 800, max_players: 24, current_players: 10, skill_level: 'open', prize: null },
    ],
  },
  {
    id: 't3',
    title: 'Siliguri District Championship',
    description: null,
    city: 'Siliguri',
    state: 'West Bengal',
    venue: 'Siliguri Sports Association Hall',
    venue_address: null,
    start_date: '2025-07-05',
    end_date: '2025-07-06',
    registration_deadline: '2025-06-30',
    organizer_id: 'u3',
    organizer_name: 'Siliguri BA',
    banner_url: null,
    rules: null,
    status: 'open',
    contact_phone: null,
    contact_email: null,
    prize_pool: '₹15,000',
    max_courts: 3,
    created_at: '2025-05-15',
    categories: [
      { id: 'c6', tournament_id: 't3', name: "Men's Singles", entry_fee: 300, max_players: 48, current_players: 22, skill_level: 'beginner', prize: null },
    ],
  },
  {
    id: 't4',
    title: 'Bengal State Ranking Tournament',
    description: null,
    city: 'Kolkata',
    state: 'West Bengal',
    venue: 'Rabindra Sarobar Indoor Complex',
    venue_address: null,
    start_date: '2025-07-20',
    end_date: '2025-07-22',
    registration_deadline: '2025-07-15',
    organizer_id: 'u1',
    organizer_name: 'West Bengal Badminton Association',
    banner_url: null,
    rules: null,
    status: 'open',
    contact_phone: null,
    contact_email: null,
    prize_pool: '₹1,00,000',
    max_courts: 10,
    created_at: '2025-05-20',
    categories: [
      { id: 'c8', tournament_id: 't4', name: "Men's Singles", entry_fee: 1000, max_players: 128, current_players: 45, skill_level: 'open', prize: null },
      { id: 'c9', tournament_id: 't4', name: "Women's Singles", entry_fee: 1000, max_players: 64, current_players: 28, skill_level: 'open', prize: null },
    ],
  },
];

const CITIES = ['All', 'Kolkata', 'Durgapur', 'Siliguri', 'Bardhaman', 'Asansol'];
const STATUSES: { label: string; value: TournamentStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Open', value: 'open' },
  { label: 'Live', value: 'ongoing' },
  { label: 'Ended', value: 'completed' },
];

export default function ExploreScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [query, setQuery] = useState('');
  const [city, setCity] = useState('All');
  const [status, setStatus] = useState<TournamentStatus | 'all'>('all');

  const filtered = useMemo(() => {
    return ALL_TOURNAMENTS.filter((t) => {
      const matchesQuery =
        !query || t.title.toLowerCase().includes(query.toLowerCase()) || t.city.toLowerCase().includes(query.toLowerCase());
      const matchesCity = city === 'All' || t.city === city;
      const matchesStatus = status === 'all' || t.status === status;
      return matchesQuery && matchesCity && matchesStatus;
    });
  }, [query, city, status]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <AppText variant="heading" weight="bold">Explore</AppText>
        <AppText variant="body" color={colors.textSecondary}>Find badminton tournaments near you</AppText>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search tournaments, cities..."
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

      {/* Status filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {STATUSES.map((s) => (
          <TouchableOpacity
            key={s.value}
            style={[styles.chip, status === s.value && styles.chipActive]}
            onPress={() => setStatus(s.value)}
          >
            <AppText
              variant="label"
              weight={status === s.value ? 'semiBold' : 'regular'}
              color={status === s.value ? '#fff' : colors.textSecondary}
            >
              {s.label}
            </AppText>
          </TouchableOpacity>
        ))}

        <View style={styles.chipSep} />
        {CITIES.map((c) => (
          <TouchableOpacity
            key={c}
            style={[styles.chip, styles.chipOutline, city === c && styles.chipOutlineActive]}
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

      {/* Results */}
      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="search" size={48} color={colors.textMuted} />
          <AppText variant="title" color={colors.textMuted} center style={{ marginTop: 12 }}>
            No tournaments found
          </AppText>
          <AppText variant="body" color={colors.textMuted} center>
            Try adjusting your filters
          </AppText>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <TournamentCard tournament={item} onPress={() => {}} />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
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
      paddingTop: 16,
      paddingBottom: 12,
      gap: 2,
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      marginHorizontal: 20,
      marginBottom: 10,
      borderRadius: 14,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: colors.border,
      minHeight: 46,
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
      fontFamily: 'Inter_Regular',
      paddingVertical: 12,
    },
    filterRow: {
      paddingHorizontal: 20,
      paddingVertical: 8,
      gap: 8,
      alignItems: 'center',
    },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipOutline: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipOutlineActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryLight,
    },
    chipSep: {
      width: 1,
      height: 24,
      backgroundColor: colors.border,
      marginHorizontal: 4,
    },
    list: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 24,
    },
    empty: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingBottom: 80,
    },
  });
}
