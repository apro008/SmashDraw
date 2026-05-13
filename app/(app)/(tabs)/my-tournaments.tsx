import { useState, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '~/components/AppText';
import { TournamentCard } from '~/components/TournamentCard';
import { useTheme } from '~/hooks/useTheme';
import { useAuthStore } from '~/store/useAuthStore';
import { Tournament } from '~/types';

type Tab = 'joined' | 'organized';

// Mock — replace with Supabase queries filtered by useAuthStore user.id
const JOINED: Tournament[] = [];
const ORGANIZED: Tournament[] = [];

export default function MyTournamentsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const profile = useAuthStore((s) => s.profile);

  const [activeTab, setActiveTab] = useState<Tab>('joined');

  const data = activeTab === 'joined' ? JOINED : ORGANIZED;
  const isOrganizer = profile?.role === 'organizer' || profile?.role === 'admin';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <AppText variant="heading" weight="bold">My Events</AppText>
        {isOrganizer && (
          <TouchableOpacity style={styles.createBtn}>
            <Ionicons name="add" size={18} color="#fff" />
            <AppText variant="label" weight="semiBold" color="#fff">
              Create
            </AppText>
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {(['joined', 'organized'] as Tab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <AppText
              variant="bodyLg"
              weight={activeTab === tab ? 'semiBold' : 'regular'}
              color={activeTab === tab ? colors.primary : colors.textMuted}
            >
              {tab === 'joined' ? 'Joined' : 'Organized'}
            </AppText>
            {activeTab === tab && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {data.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons
            name={activeTab === 'joined' ? 'trophy-outline' : 'calendar-outline'}
            size={56}
            color={colors.textMuted}
          />
          <AppText variant="title" weight="semiBold" center style={styles.emptyTitle}>
            {activeTab === 'joined' ? 'No tournaments joined yet' : 'No tournaments organized yet'}
          </AppText>
          <AppText variant="body" color={colors.textSecondary} center>
            {activeTab === 'joined'
              ? 'Explore and register for upcoming tournaments.'
              : 'Create your first tournament and manage it here.'}
          </AppText>
          <TouchableOpacity
            style={[styles.emptyAction, { backgroundColor: colors.primary }]}
            activeOpacity={0.85}
          >
            <AppText variant="bodyLg" weight="semiBold" color="#fff">
              {activeTab === 'joined' ? 'Browse Tournaments' : 'Create Tournament'}
            </AppText>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={data}
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
    tabBar: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      marginHorizontal: 20,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 12,
      position: 'relative',
    },
    tabActive: {},
    tabIndicator: {
      position: 'absolute',
      bottom: -1,
      left: 0,
      right: 0,
      height: 2,
      backgroundColor: colors.primary,
      borderRadius: 1,
    },
    list: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 24,
    },
    empty: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
      paddingBottom: 80,
      gap: 10,
    },
    emptyTitle: {
      marginTop: 8,
    },
    emptyAction: {
      marginTop: 20,
      paddingHorizontal: 28,
      paddingVertical: 14,
      borderRadius: 12,
    },
  });
}
