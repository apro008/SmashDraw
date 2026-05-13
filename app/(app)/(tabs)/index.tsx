import { useState, useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AppText } from '~/components/AppText';
import { TournamentCard } from '~/components/TournamentCard';
import { useTheme } from '~/hooks/useTheme';
import { useAuthStore } from '~/store/useAuthStore';
import { Tournament } from '~/types';

// Mock data — replace with Supabase queries
const MOCK_TOURNAMENTS: Tournament[] = [
  {
    id: 't1',
    title: 'Kolkata Open Badminton Championship 2025',
    description: null,
    city: 'Kolkata',
    state: 'West Bengal',
    venue: 'Netaji Indoor Stadium',
    venue_address: 'Gate No. 2, Netaji Indoor Stadium, Kolkata',
    start_date: '2025-06-15',
    end_date: '2025-06-17',
    registration_deadline: '2025-06-10',
    organizer_id: 'u1',
    organizer_name: 'West Bengal Badminton Association',
    banner_url: null,
    rules: null,
    status: 'open',
    contact_phone: '+91 98300 00001',
    contact_email: null,
    prize_pool: '₹50,000',
    max_courts: 8,
    created_at: '2025-05-01',
    categories: [
      { id: 'c1', tournament_id: 't1', name: "Men's Singles", entry_fee: 500, max_players: 64, current_players: 38, skill_level: 'open', prize: '₹15,000' },
      { id: 'c2', tournament_id: 't1', name: "Women's Singles", entry_fee: 500, max_players: 32, current_players: 18, skill_level: 'open', prize: '₹10,000' },
      { id: 'c3', tournament_id: 't1', name: 'Mixed Doubles', entry_fee: 800, max_players: 32, current_players: 14, skill_level: 'open', prize: '₹12,000' },
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
    contact_phone: '+91 94320 00002',
    contact_email: null,
    prize_pool: '₹20,000',
    max_courts: 4,
    created_at: '2025-05-10',
    categories: [
      { id: 'c4', tournament_id: 't2', name: "Men's Doubles", entry_fee: 800, max_players: 24, current_players: 10, skill_level: 'open', prize: '₹8,000' },
      { id: 'c5', tournament_id: 't2', name: "Women's Doubles", entry_fee: 800, max_players: 16, current_players: 6, skill_level: 'open', prize: '₹6,000' },
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
      { id: 'c6', tournament_id: 't3', name: "Men's Singles", entry_fee: 300, max_players: 48, current_players: 22, skill_level: 'beginner', prize: '₹5,000' },
      { id: 'c7', tournament_id: 't3', name: "Boys' Singles", entry_fee: 200, max_players: 32, current_players: 18, skill_level: 'open', prize: '₹3,000' },
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
    contact_phone: '+91 98300 00001',
    contact_email: null,
    prize_pool: '₹1,00,000',
    max_courts: 10,
    created_at: '2025-05-20',
    categories: [
      { id: 'c8', tournament_id: 't4', name: "Men's Singles", entry_fee: 1000, max_players: 128, current_players: 45, skill_level: 'open', prize: '₹30,000' },
      { id: 'c9', tournament_id: 't4', name: "Women's Singles", entry_fee: 1000, max_players: 64, current_players: 28, skill_level: 'open', prize: '₹20,000' },
      { id: 'c10', tournament_id: 't4', name: "Men's Doubles", entry_fee: 1500, max_players: 64, current_players: 20, skill_level: 'open', prize: '₹25,000' },
    ],
  },
];

export default function HomeScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const profile = useAuthStore((s) => s.profile);
  const user = useAuthStore((s) => s.user);

  const [refreshing, setRefreshing] = useState(false);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const displayName = profile?.name ?? user?.email?.split('@')[0] ?? 'Player';

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <View>
            <AppText variant="label" color={colors.textMuted}>
              {greeting()},
            </AppText>
            <AppText variant="title" weight="bold">
              {displayName} 👋
            </AppText>
          </View>
          <TouchableOpacity style={styles.notifBtn}>
            <Ionicons name="notifications-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <TouchableOpacity
          style={styles.searchBar}
          onPress={() => router.push('/(app)/(tabs)/explore')}
          activeOpacity={0.8}
        >
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <AppText variant="body" color={colors.textMuted} style={styles.searchText}>
            Search tournaments, cities...
          </AppText>
        </TouchableOpacity>

        {/* Quick stats banner */}
        <View style={[styles.statsBanner, { backgroundColor: colors.primary }]}>
          <View style={styles.statItem}>
            <AppText variant="hero" weight="bold" color="#fff">4</AppText>
            <AppText variant="caption" color="rgba(255,255,255,0.8)">Open Events</AppText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <AppText variant="hero" weight="bold" color="#fff">3</AppText>
            <AppText variant="caption" color="rgba(255,255,255,0.8)">Cities</AppText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <AppText variant="hero" weight="bold" color="#fff">8</AppText>
            <AppText variant="caption" color="rgba(255,255,255,0.8)">Categories</AppText>
          </View>
        </View>

        {/* Upcoming tournaments */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <AppText variant="title" weight="semiBold">Upcoming Tournaments</AppText>
            <TouchableOpacity onPress={() => router.push('/(app)/(tabs)/explore')}>
              <AppText variant="label" color={colors.primary} weight="medium">See all</AppText>
            </TouchableOpacity>
          </View>

          <View style={styles.list}>
            {MOCK_TOURNAMENTS.map((t) => (
              <TournamentCard
                key={t.id}
                tournament={t}
                onPress={() => {}}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      paddingBottom: 24,
    },
    topBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 12,
    },
    notifBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 1,
      shadowRadius: 4,
      elevation: 2,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.surface,
      marginHorizontal: 20,
      marginBottom: 16,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 13,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchText: {
      flex: 1,
    },
    statsBanner: {
      marginHorizontal: 20,
      borderRadius: 16,
      padding: 20,
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginBottom: 24,
    },
    statItem: {
      alignItems: 'center',
      gap: 4,
    },
    statDivider: {
      width: 1,
      backgroundColor: 'rgba(255,255,255,0.3)',
    },
    section: {
      paddingHorizontal: 20,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
    },
    list: {
      gap: 14,
    },
  });
}
