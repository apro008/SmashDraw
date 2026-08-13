import { useCallback, useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { AppText } from '~/components/AppText';
import { SkeletonLoader } from '~/components/common/SkeletonLoader';
import { useTheme } from '~/hooks/useTheme';
import { fetchAllProfiles } from '~/lib/profiles';
import { useAlert } from '~/providers/AlertProvider';
import { UserProfile, UserRole } from '~/types';

type RoleFilter = 'all' | UserRole;

const ROLE_FILTERS: { value: RoleFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'player', label: 'Players' },
  { value: 'organizer', label: 'Organizers' },
  { value: 'admin', label: 'Admins' },
];

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  player: { bg: '#3B82F620', text: '#3B82F6' },
  organizer: { bg: '#16A34A20', text: '#16A34A' },
  admin: { bg: '#7C3AED20', text: '#7C3AED' },
};

function initialsOf(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((word) => word[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  );
}

function formatJoined(value: string) {
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function AdminUsersScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const tabBarHeight = useBottomTabBarHeight();
  const { showAlert } = useAlert();

  const [filter, setFilter] = useState<RoleFilter>('all');
  const [query, setQuery] = useState('');
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadProfiles = useCallback(async () => {
    try {
      setProfiles(await fetchAllProfiles());
    } catch (err: any) {
      showAlert({
        type: 'danger',
        title: 'Unable to load users',
        message: err?.message ?? 'Please try again.',
      });
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  useFocusEffect(
    useCallback(() => {
      loadProfiles();
    }, [loadProfiles])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProfiles();
    setRefreshing(false);
  };

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return profiles.filter((profile) => {
      if (filter !== 'all' && profile.role !== filter) return false;
      if (!term) return true;
      return [profile.name, profile.email, profile.phone, profile.city, profile.club_name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term);
    });
  }, [profiles, filter, query]);

  // Counts come off the whole list, so the chips keep reading the same as the
  // filter moves between them.
  const counts = useMemo(
    () =>
      profiles.reduce<Record<string, number>>(
        (acc, profile) => {
          acc[profile.role] = (acc[profile.role] ?? 0) + 1;
          return acc;
        },
        { all: profiles.length }
      ),
    [profiles]
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <AppText variant="heading" weight="bold">
          Users
        </AppText>
        <AppText variant="body" color={colors.textSecondary}>
          {profiles.length} total
        </AppText>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search name, email, phone or city"
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 ? (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {ROLE_FILTERS.map((f) => {
          const active = filter === f.value;
          return (
            <TouchableOpacity
              key={f.value}
              style={[
                styles.chip,
                active && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => setFilter(f.value)}
            >
              <AppText
                variant="caption"
                weight={active ? 'semiBold' : 'regular'}
                color={active ? '#fff' : colors.textSecondary}
              >
                {f.label} {counts[f.value] ?? 0}
              </AppText>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.list}>
          <SkeletonLoader count={6} variant="list" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={[styles.empty, { paddingBottom: tabBarHeight + 40 }]}>
          <Ionicons name="people-outline" size={56} color={colors.textMuted} />
          <AppText variant="title" weight="semiBold" center style={styles.emptyTitle}>
            No users found
          </AppText>
          <AppText variant="body" color={colors.textSecondary} center>
            {profiles.length === 0
              ? 'Users will appear here once they register.'
              : 'No account matches that search.'}
          </AppText>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(profile) => profile.id}
          contentContainerStyle={[styles.list, { paddingBottom: tabBarHeight + 8 }]}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => {
            const roleStyle = ROLE_COLORS[item.role] ?? ROLE_COLORS.player;
            const location = [item.city, item.state].filter(Boolean).join(', ');
            return (
              <View style={styles.userRow}>
                <View style={[styles.userAvatar, { backgroundColor: roleStyle.text }]}>
                  <AppText variant="label" weight="bold" color="#fff">
                    {initialsOf(item.name)}
                  </AppText>
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyLg" weight="semiBold" numberOfLines={1}>
                    {item.name}
                  </AppText>
                  <AppText variant="caption" color={colors.textMuted} numberOfLines={1}>
                    {item.email ?? item.phone ?? 'No contact details'}
                  </AppText>
                  <AppText variant="xs" color={colors.textMuted} numberOfLines={1}>
                    {location ? `${location} · ` : ''}Joined {formatJoined(item.created_at)}
                  </AppText>
                </View>
                <View style={[styles.roleBadge, { backgroundColor: roleStyle.bg }]}>
                  <AppText variant="caption" weight="semiBold" color={roleStyle.text}>
                    {item.role}
                  </AppText>
                </View>
              </View>
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
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
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: 20,
      marginBottom: 12,
      paddingHorizontal: 12,
      minHeight: 44,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchInput: {
      flex: 1,
      color: colors.text,
      fontSize: 14,
      paddingVertical: 0,
    },
    filterRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      paddingHorizontal: 20,
      paddingBottom: 12,
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
    userRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
    },
    userAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
    },
    roleBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    separator: { height: 1, backgroundColor: colors.border },
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
