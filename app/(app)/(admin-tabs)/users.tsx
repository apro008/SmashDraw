import { useState, useMemo } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { AppText } from '~/components/AppText';
import { useTheme } from '~/hooks/useTheme';

type RoleFilter = 'all' | 'player' | 'organizer' | 'admin';

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

// Replace with Supabase query: select * from profiles
const MOCK_USERS: { id: string; name: string; email: string; role: string; city: string | null }[] = [];

export default function AdminUsersScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const tabBarHeight = useBottomTabBarHeight();

  const [filter, setFilter] = useState<RoleFilter>('all');

  const filtered = filter === 'all' ? MOCK_USERS : MOCK_USERS.filter((u) => u.role === filter);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <AppText variant="heading" weight="bold">Users</AppText>
        <AppText variant="body" color={colors.textSecondary}>{MOCK_USERS.length} total</AppText>
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {ROLE_FILTERS.map((f) => (
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

      {filtered.length === 0 ? (
        <View style={[styles.empty, { paddingBottom: tabBarHeight + 40 }]}>
          <Ionicons name="people-outline" size={56} color={colors.textMuted} />
          <AppText variant="title" weight="semiBold" center style={styles.emptyTitle}>
            No users found
          </AppText>
          <AppText variant="body" color={colors.textSecondary} center>
            Users will appear here once they register.
          </AppText>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(u) => u.id}
          contentContainerStyle={[styles.list, { paddingBottom: tabBarHeight + 8 }]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const roleStyle = ROLE_COLORS[item.role] ?? ROLE_COLORS.player;
            const initials = item.name
              .split(' ')
              .map((w) => w[0])
              .slice(0, 2)
              .join('')
              .toUpperCase();
            return (
              <TouchableOpacity style={styles.userRow} activeOpacity={0.8}>
                <View style={styles.userAvatar}>
                  <AppText variant="label" weight="bold" color="#fff">{initials}</AppText>
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyLg" weight="semiBold">{item.name}</AppText>
                  <AppText variant="caption" color={colors.textMuted}>{item.email}</AppText>
                </View>
                <View style={[styles.roleBadge, { backgroundColor: roleStyle.bg }]}>
                  <AppText variant="caption" weight="semiBold" color={roleStyle.text}>
                    {item.role}
                  </AppText>
                </View>
              </TouchableOpacity>
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
    filterRow: {
      flexDirection: 'row',
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
      backgroundColor: colors.primary,
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
