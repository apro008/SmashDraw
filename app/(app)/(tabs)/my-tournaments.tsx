import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { AppText } from '~/components/AppText';
import { TournamentCard } from '~/components/TournamentCard';
import { useTheme } from '~/hooks/useTheme';
import { useAuthStore } from '~/store/useAuthStore';
import { Tournament } from '~/types';
import { fetchRegisteredTournaments } from '~/lib/tournaments';
import { useAlert } from '~/providers/AlertProvider';

export default function MyTournamentsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const user = useAuthStore((s) => s.user);
  const { showAlert } = useAlert();
  const tabBarHeight = useBottomTabBarHeight();

  const [joined, setJoined] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  const loadEvents = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      setJoined(await fetchRegisteredTournaments(user.id));
    } catch (err: any) {
      showAlert({
        type: 'danger',
        title: 'Unable to load events',
        message: err?.message ?? 'Please try again.',
      });
    } finally {
      setLoading(false);
    }
  }, [showAlert, user]);

  useFocusEffect(
    useCallback(() => {
      loadEvents();
    }, [loadEvents])
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <AppText variant="heading" weight="bold">
          My Events
        </AppText>
        <AppText variant="body" color={colors.textSecondary}>
          Tournaments you have joined
        </AppText>
      </View>

      {loading ? (
        <View style={[styles.empty, { paddingBottom: tabBarHeight + 40 }]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : joined.length === 0 ? (
        <View style={[styles.empty, { paddingBottom: tabBarHeight + 40 }]}>
          <Ionicons name="trophy-outline" size={56} color={colors.textMuted} />
          <AppText variant="title" weight="semiBold" center style={styles.emptyTitle}>
            No tournaments joined yet
          </AppText>
          <AppText variant="body" color={colors.textSecondary} center>
            Explore open tournaments and register for your category.
          </AppText>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push('/(app)/(tabs)/explore')}
            style={[styles.emptyAction, { backgroundColor: colors.primary }]}
          >
            <AppText variant="bodyLg" weight="semiBold" color="#fff">
              Browse Tournaments
            </AppText>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={joined}
          keyExtractor={(tournament) => tournament.id}
          renderItem={({ item }) => (
            <TournamentCard
              tournament={item}
              onPress={() =>
                router.push({ pathname: '/(app)/tournament/[id]', params: { id: item.id } })
              }
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
    safe: {
      backgroundColor: colors.background,
      flex: 1,
    },
    header: {
      gap: 2,
      paddingBottom: 14,
      paddingHorizontal: 20,
      paddingTop: 16,
    },
    list: {
      paddingHorizontal: 20,
      paddingTop: 8,
    },
    empty: {
      alignItems: 'center',
      flex: 1,
      gap: 10,
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
    emptyTitle: {
      marginTop: 8,
    },
    emptyAction: {
      borderRadius: 12,
      marginTop: 20,
      paddingHorizontal: 28,
      paddingVertical: 14,
    },
  });
}
