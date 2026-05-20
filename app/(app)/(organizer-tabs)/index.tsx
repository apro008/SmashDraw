import { useState, useMemo, useCallback } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { AppText } from '~/components/AppText';
import { useTheme } from '~/hooks/useTheme';
import { useAuthStore } from '~/store/useAuthStore';
import { supabase } from '~/lib/supabase';
import { Tournament } from '~/types';

export default function OrganizerHomeScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const profile = useAuthStore((s) => s.profile);
  const user = useAuthStore((s) => s.user);
  const tabBarHeight = useBottomTabBarHeight();

  const [tournaments, setTournaments] = useState<Tournament[]>([]);

  const displayName = profile?.name ?? user?.email?.split('@')[0] ?? 'Organizer';

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      supabase
        .from('tournaments')
        .select('*')
        .eq('organizer_id', user.id)
        .order('created_at', { ascending: false })
        .then(({ data }) => setTournaments((data as Tournament[]) ?? []));
    }, [user])
  );

  const activeCount = tournaments.filter((t) => t.status === 'open' || t.status === 'ongoing').length;
  const draftCount = tournaments.filter((t) => t.status === 'draft').length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: tabBarHeight + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <View>
            <AppText variant="label" color={colors.textMuted}>{greeting()},</AppText>
            <AppText variant="title" weight="bold">{displayName}</AppText>
          </View>
          <View style={[styles.roleBadge, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="trophy" size={13} color={colors.primary} />
            <AppText variant="caption" weight="semiBold" color={colors.primary}>Organizer</AppText>
          </View>
        </View>

        {/* Stats banner */}
        <View style={[styles.statsBanner, { backgroundColor: colors.primary }]}>
          <View style={styles.statItem}>
            <AppText variant="hero" weight="bold" color="#fff">{tournaments.length}</AppText>
            <AppText variant="caption" color="rgba(255,255,255,0.8)">My Events</AppText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <AppText variant="hero" weight="bold" color="#fff">{activeCount}</AppText>
            <AppText variant="caption" color="rgba(255,255,255,0.8)">Active</AppText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <AppText variant="hero" weight="bold" color="#fff">{draftCount}</AppText>
            <AppText variant="caption" color="rgba(255,255,255,0.8)">Drafts</AppText>
          </View>
        </View>

        {/* Quick actions */}
        <View style={styles.section}>
          <AppText variant="title" weight="semiBold" style={styles.sectionTitle}>Quick Actions</AppText>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/(app)/(organizer-tabs)/create')}
              activeOpacity={0.85}
            >
              <Ionicons name="add-circle-outline" size={28} color="#fff" />
              <AppText variant="bodyLg" weight="semiBold" color="#fff" style={{ marginTop: 8 }}>
                Create Tournament
              </AppText>
              <AppText variant="caption" color="rgba(255,255,255,0.8)">
                Set up a new event
              </AppText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}
              onPress={() => router.push('/(app)/(organizer-tabs)/my-tournaments')}
              activeOpacity={0.85}
            >
              <Ionicons name="list-outline" size={28} color={colors.primary} />
              <AppText variant="bodyLg" weight="semiBold" style={{ marginTop: 8 }}>
                Manage Events
              </AppText>
              <AppText variant="caption" color={colors.textSecondary}>
                View & edit tournaments
              </AppText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent tournaments */}
        <View style={styles.section}>
          <AppText variant="title" weight="semiBold" style={styles.sectionTitle}>Recent Tournaments</AppText>
          {tournaments.slice(0, 3).map((t) => (
            <TouchableOpacity
              key={t.id}
              style={styles.eventRow}
              onPress={() => router.push({ pathname: '/(app)/tournament/[id]', params: { id: t.id } })}
              activeOpacity={0.8}
            >
              <View style={[styles.eventIcon, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="trophy-outline" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="bodyLg" weight="semiBold" numberOfLines={1}>{t.title}</AppText>
                <AppText variant="caption" color={colors.textMuted}>{t.city} · {t.start_date}</AppText>
              </View>
              <View style={[styles.statusChip, { backgroundColor: STATUS_COLORS[t.status] + '20' }]}>
                <AppText variant="caption" weight="semiBold" color={STATUS_COLORS[t.status]}>
                  {t.status}
                </AppText>
              </View>
            </TouchableOpacity>
          ))}
          {tournaments.length === 0 && (
            <View style={styles.emptyState}>
              <AppText variant="body" color={colors.textMuted} center>
                No tournaments yet. Create your first one!
              </AppText>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const STATUS_COLORS: Record<string, string> = {
  draft: '#6B7280',
  open: '#16A34A',
  ongoing: '#D97706',
  completed: '#2563EB',
  cancelled: '#DC2626',
};

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    scroll: {},
    topBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 12,
    },
    roleBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
    },
    statsBanner: {
      marginHorizontal: 20,
      borderRadius: 16,
      padding: 20,
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginBottom: 24,
    },
    statItem: { alignItems: 'center', gap: 4 },
    statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
    section: { paddingHorizontal: 20, marginBottom: 24 },
    sectionTitle: { marginBottom: 14 },
    actionsRow: { flexDirection: 'row', gap: 12 },
    actionCard: {
      flex: 1,
      borderRadius: 16,
      padding: 18,
      gap: 2,
    },
    eventRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    eventIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    statusChip: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    emptyState: { paddingVertical: 24 },
  });
}
