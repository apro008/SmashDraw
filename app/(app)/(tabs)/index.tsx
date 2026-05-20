import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { AppText } from '~/components/AppText';
import { TournamentCard } from '~/components/TournamentCard';
import { useTheme } from '~/hooks/useTheme';
import { useAuthStore } from '~/store/useAuthStore';
import { Tournament } from '~/types';
import { fetchOpenTournaments } from '~/lib/tournaments';
import { useAlert } from '~/providers/AlertProvider';

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

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

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

  const displayName = profile?.name ?? user?.email?.split('@')[0] ?? 'Player';
  const openCount = tournaments.filter((t) => t.status === 'open').length;
  const cityCount = new Set(tournaments.map((t) => t.city)).size;
  const categoryCount = tournaments.reduce((sum, t) => sum + (t.categories?.length ?? 0), 0);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTournaments();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: tabBarHeight + 16 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.topBar}>
          <View>
            <AppText variant="label" color={colors.textMuted}>
              {greeting()},
            </AppText>
            <AppText variant="title" weight="bold">
              {displayName}
            </AppText>
          </View>
          <TouchableOpacity style={styles.notifBtn}>
            <Ionicons name="notifications-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

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

        <View style={[styles.statsBanner, { backgroundColor: colors.primary }]}>
          <View style={styles.statItem}>
            <AppText variant="hero" weight="bold" color="#fff">
              {openCount}
            </AppText>
            <AppText variant="caption" color="rgba(255,255,255,0.8)">
              Open Events
            </AppText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <AppText variant="hero" weight="bold" color="#fff">
              {cityCount}
            </AppText>
            <AppText variant="caption" color="rgba(255,255,255,0.8)">
              Cities
            </AppText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <AppText variant="hero" weight="bold" color="#fff">
              {categoryCount}
            </AppText>
            <AppText variant="caption" color="rgba(255,255,255,0.8)">
              Categories
            </AppText>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <AppText variant="title" weight="semiBold">
              Upcoming Tournaments
            </AppText>
            <TouchableOpacity onPress={() => router.push('/(app)/(tabs)/explore')}>
              <AppText variant="label" color={colors.primary} weight="medium">
                See all
              </AppText>
            </TouchableOpacity>
          </View>

          <View style={styles.list}>
            {loading ? (
              <ActivityIndicator color={colors.primary} />
            ) : tournaments.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="calendar-outline" size={28} color={colors.textMuted} />
                <AppText variant="body" color={colors.textSecondary} center>
                  No published tournaments yet.
                </AppText>
              </View>
            ) : (
              tournaments
                .slice(0, 5)
                .map((t) => (
                  <TournamentCard
                    key={t.id}
                    tournament={t}
                    onPress={() =>
                      router.push({ pathname: '/(app)/tournament/[id]', params: { id: t.id } })
                    }
                  />
                ))
            )}
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
    scroll: {},
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
