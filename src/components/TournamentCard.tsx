import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '~/hooks/useTheme';
import { AppText } from './AppText';
import { Tournament, TournamentStatus } from '~/types';

const STATUS_CONFIG: Record<TournamentStatus, { label: string; color: string; bg: string }> = {
  open: { label: 'Open', color: '#16A34A', bg: '#DCFCE7' },
  ongoing: { label: 'Live', color: '#D97706', bg: '#FEF3C7' },
  completed: { label: 'Ended', color: '#6B7280', bg: '#F3F4F6' },
  draft: { label: 'Draft', color: '#6B7280', bg: '#F3F4F6' },
  cancelled: { label: 'Cancelled', color: '#DC2626', bg: '#FEE2E2' },
};

const GRADIENT_COLORS = ['#1A73E8', '#0D47A1', '#7C3AED', '#BE185D', '#065F46', '#B45309'];

interface Props {
  tournament: Tournament;
  onPress: () => void;
  compact?: boolean;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function hashColor(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return GRADIENT_COLORS[Math.abs(hash) % GRADIENT_COLORS.length];
}

export function TournamentCard({ tournament, onPress, compact = false }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const statusCfg = STATUS_CONFIG[tournament.status] ?? STATUS_CONFIG.open;
  const accentColor = hashColor(tournament.id);
  const dateRange =
    tournament.start_date === tournament.end_date
      ? formatDate(tournament.start_date)
      : `${formatDate(tournament.start_date)} – ${formatDate(tournament.end_date)}`;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      {/* Color banner */}
      <View style={[styles.banner, { backgroundColor: accentColor }]}>
        <View style={styles.bannerOverlay}>
          <Ionicons name="trophy" size={36} color="rgba(255,255,255,0.25)" />
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
          <AppText variant="xs" weight="semiBold" color={statusCfg.color}>
            {statusCfg.label}
          </AppText>
        </View>
      </View>

      <View style={styles.body}>
        <AppText variant="title" weight="semiBold" numberOfLines={1}>
          {tournament.title}
        </AppText>

        <View style={styles.row}>
          <Ionicons name="location-outline" size={13} color={colors.textMuted} />
          <AppText variant="caption" color={colors.textSecondary} style={styles.rowText}>
            {tournament.venue}, {tournament.city}
          </AppText>
        </View>

        <View style={styles.row}>
          <Ionicons name="calendar-outline" size={13} color={colors.textMuted} />
          <AppText variant="caption" color={colors.textSecondary} style={styles.rowText}>
            {dateRange}
          </AppText>
        </View>

        {!compact && tournament.categories && tournament.categories.length > 0 && (
          <View style={styles.categories}>
            {tournament.categories.slice(0, 3).map((cat) => (
              <View key={cat.id} style={[styles.catBadge, { backgroundColor: colors.primaryLight }]}>
                <AppText variant="xs" weight="medium" color={colors.primary}>
                  {cat.name}
                </AppText>
              </View>
            ))}
            {tournament.categories.length > 3 && (
              <AppText variant="xs" color={colors.textMuted}>
                +{tournament.categories.length - 3} more
              </AppText>
            )}
          </View>
        )}

        <View style={styles.footer}>
          {tournament.categories && tournament.categories.length > 0 ? (
            <AppText variant="label" weight="semiBold" color={colors.primary}>
              From ₹{Math.min(...tournament.categories.map((c) => c.entry_fee))}
            </AppText>
          ) : (
            <AppText variant="label" color={colors.textMuted}>
              Free entry
            </AppText>
          )}
          {tournament.prize_pool && (
            <View style={styles.prizeRow}>
              <Ionicons name="gift-outline" size={12} color={colors.textMuted} />
              <AppText variant="caption" color={colors.textMuted} style={{ marginLeft: 3 }}>
                {tournament.prize_pool}
              </AppText>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      overflow: 'hidden',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 8,
      elevation: 3,
    },
    banner: {
      height: 80,
      justifyContent: 'flex-end',
      padding: 10,
    },
    bannerOverlay: {
      position: 'absolute',
      right: 12,
      top: 8,
    },
    statusBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    body: {
      padding: 14,
      gap: 5,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    rowText: {
      flex: 1,
    },
    categories: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 4,
    },
    catBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 6,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    prizeRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
  });
}
