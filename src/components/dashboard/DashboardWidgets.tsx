import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText } from '~/components/AppText';
import { useTheme } from '~/hooks/useTheme';
import { Tournament } from '~/types';

export interface ChartDatum {
  label: string;
  value: number;
  color?: string;
}

// ─── MetricTile ────────────────────────────────────────────────────────────────

interface MetricTileProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | number;
  tone: string;
  sublabel?: string;
}

export function MetricTile({ icon, label, sublabel, tone, value }: MetricTileProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.metricTile}>
      <View style={[styles.metricIcon, { backgroundColor: `${tone}20` }]}>
        <Ionicons name={icon} size={18} color={tone} />
      </View>
      <AppText variant="heading" weight="bold" numberOfLines={1}>
        {value}
      </AppText>
      <AppText variant="caption" weight="medium" color={colors.textSecondary} numberOfLines={1}>
        {label}
      </AppText>
      {sublabel ? (
        <AppText variant="xs" color={colors.textMuted} numberOfLines={1}>
          {sublabel}
        </AppText>
      ) : null}
    </View>
  );
}

// ─── MetricPill ────────────────────────────────────────────────────────────────

interface MetricPillProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | number;
  tone: string;
}

export function MetricPill({ icon, label, tone, value }: MetricPillProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={[styles.metricPill, { borderColor: `${tone}35` }]}>
      <View style={[styles.metricPillIcon, { backgroundColor: `${tone}18` }]}>
        <Ionicons name={icon} size={18} color={tone} />
      </View>
      <View>
        <AppText variant="title" weight="bold" numberOfLines={1}>
          {value}
        </AppText>
        <AppText variant="xs" color={colors.textSecondary} numberOfLines={1}>
          {label}
        </AppText>
      </View>
    </View>
  );
}

// ─── ActionTile ────────────────────────────────────────────────────────────────

interface ActionTileProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  note: string;
  onPress: () => void;
  tone: string;
}

export function ActionTile({ icon, label, note, onPress, tone }: ActionTileProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.actionTile}>
      <View style={[styles.actionIcon, { backgroundColor: `${tone}18` }]}>
        <Ionicons name={icon} size={20} color={tone} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="label" weight="semiBold" numberOfLines={1}>
          {label}
        </AppText>
        <AppText variant="xs" color={colors.textMuted} numberOfLines={1}>
          {note}
        </AppText>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

// ─── TournamentSnippet ────────────────────────────────────────────────────────

const SNIPPET_BANNER_COLORS = ['#1A73E8', '#0D47A1', '#7C3AED', '#BE185D', '#065F46', '#B45309'];

function snippetHashColor(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return SNIPPET_BANNER_COLORS[Math.abs(hash) % SNIPPET_BANNER_COLORS.length];
}

const SNIPPET_STATUS: Record<string, { label: string; bg: string }> = {
  open: { label: 'Open', bg: '#16A34A' },
  ongoing: { label: 'Live', bg: '#EA580C' },
  completed: { label: 'Ended', bg: '#6B7280' },
  draft: { label: 'Draft', bg: '#374151' },
  cancelled: { label: 'Cancelled', bg: '#DC2626' },
  paused: { label: 'Paused', bg: '#7C3AED' },
};

function formatSnippetDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

interface TournamentSnippetProps {
  tournament: Tournament;
  onPress: () => void;
}

export function TournamentSnippet({ tournament, onPress }: TournamentSnippetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const bannerColor = snippetHashColor(tournament.id);
  const status = SNIPPET_STATUS[tournament.status] ?? SNIPPET_STATUS.open;

  return (
    <TouchableOpacity style={styles.snippet} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.snippetBanner, { backgroundColor: bannerColor }]}>
        {/* Subtle court decoration */}
        <View style={styles.snippetCourtLine} />
        <View style={[styles.snippetCourtVLine, { left: '38%' }]} />
        <View style={styles.snippetStatusPill}>
          <View style={[styles.snippetStatusBg, { backgroundColor: status.bg }]}>
            <AppText variant="xs" weight="bold" color="#fff" numberOfLines={1}>
              {status.label}
            </AppText>
          </View>
        </View>
      </View>
      <View style={styles.snippetBody}>
        <AppText variant="label" weight="semiBold" numberOfLines={2}>
          {tournament.title}
        </AppText>
        <View style={styles.snippetRow}>
          <Ionicons name="location-outline" size={11} color={colors.textMuted} />
          <AppText variant="xs" color={colors.textSecondary} numberOfLines={1} style={{ flex: 1 }}>
            {tournament.city}
          </AppText>
        </View>
        <View style={styles.snippetRow}>
          <Ionicons name="calendar-outline" size={11} color={colors.textMuted} />
          <AppText variant="xs" color={colors.textMuted}>
            {formatSnippetDate(tournament.start_date)}
          </AppText>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Charts (used by organizer/admin dashboards) ───────────────────────────────

export function BarChart({ data, title }: { data: ChartDatum[]; title: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const maxValue = Math.max(...data.map((item) => item.value), 1);

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <AppText variant="title" weight="semiBold">
          {title}
        </AppText>
        <Ionicons name="bar-chart-outline" size={18} color={colors.textMuted} />
      </View>
      <View style={styles.barArea}>
        {data.map((item) => {
          const height = Math.max((item.value / maxValue) * 112, item.value > 0 ? 14 : 6);
          return (
            <View key={item.label} style={styles.barSlot}>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      backgroundColor: item.color ?? colors.primary,
                      height,
                    },
                  ]}
                />
              </View>
              <AppText
                variant="xs"
                weight="semiBold"
                color={colors.textSecondary}
                numberOfLines={1}
              >
                {item.label}
              </AppText>
              <AppText variant="xs" color={colors.textMuted}>
                {item.value}
              </AppText>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function StatusChart({ data, title }: { data: ChartDatum[]; title: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <AppText variant="title" weight="semiBold">
          {title}
        </AppText>
        <AppText variant="caption" color={colors.textMuted}>
          {total} total
        </AppText>
      </View>
      <View style={styles.segmentTrack}>
        {data.map((item) => (
          <View
            key={item.label}
            style={[
              styles.segment,
              {
                backgroundColor: item.color ?? colors.primary,
                flex: total > 0 ? Math.max(item.value, 0.2) : 1,
              },
            ]}
          />
        ))}
      </View>
      <View style={styles.legendGrid}>
        {data.map((item) => (
          <View key={item.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: item.color ?? colors.primary }]} />
            <AppText
              variant="xs"
              color={colors.textSecondary}
              numberOfLines={1}
              style={{ flex: 1 }}
            >
              {item.label}
            </AppText>
            <AppText variant="xs" weight="semiBold">
              {item.value}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

export function TrendGraph({ data, title }: { data: ChartDatum[]; title: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const maxValue = Math.max(...data.map((item) => item.value), 1);

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <AppText variant="title" weight="semiBold">
          {title}
        </AppText>
        <Ionicons name="analytics-outline" size={18} color={colors.textMuted} />
      </View>
      <View style={styles.sparkArea}>
        {data.map((item, index) => {
          const height = Math.max((item.value / maxValue) * 86, item.value > 0 ? 12 : 5);
          return (
            <View key={`${item.label}-${index}`} style={styles.sparkSlot}>
              <View
                style={[
                  styles.sparkBar,
                  {
                    backgroundColor: item.color ?? colors.primary,
                    height,
                  },
                ]}
              />
              <AppText variant="xs" color={colors.textMuted} numberOfLines={1}>
                {item.label}
              </AppText>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    // MetricTile
    metricTile: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      flex: 1,
      minWidth: '46%',
      padding: 14,
    },
    metricIcon: {
      alignItems: 'center',
      borderRadius: 10,
      height: 36,
      justifyContent: 'center',
      marginBottom: 10,
      width: 36,
    },

    // MetricPill
    metricPill: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    metricPillIcon: {
      alignItems: 'center',
      borderRadius: 10,
      height: 38,
      justifyContent: 'center',
      width: 38,
    },

    // ActionTile
    actionTile: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 10,
      padding: 12,
    },
    actionIcon: {
      alignItems: 'center',
      borderRadius: 10,
      height: 38,
      justifyContent: 'center',
      width: 38,
    },

    // TournamentSnippet
    snippet: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      overflow: 'hidden',
      width: 180,
    },
    snippetBanner: {
      height: 72,
      justifyContent: 'flex-end',
      overflow: 'hidden',
      padding: 8,
      position: 'relative',
    },
    snippetCourtLine: {
      backgroundColor: 'rgba(255,255,255,0.14)',
      height: 1,
      left: 0,
      position: 'absolute',
      right: 0,
      top: '50%',
    },
    snippetCourtVLine: {
      backgroundColor: 'rgba(255,255,255,0.1)',
      bottom: 0,
      position: 'absolute',
      top: 0,
      width: 1,
    },
    snippetStatusPill: {
      alignSelf: 'flex-end',
    },
    snippetStatusBg: {
      borderRadius: 20,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    snippetBody: {
      gap: 5,
      padding: 10,
    },
    snippetRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 4,
    },

    // Charts (organizer/admin)
    chartCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      padding: 14,
    },
    chartHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    barArea: {
      alignItems: 'flex-end',
      flexDirection: 'row',
      gap: 8,
      height: 158,
    },
    barSlot: {
      alignItems: 'center',
      flex: 1,
      gap: 5,
      justifyContent: 'flex-end',
    },
    barTrack: {
      alignItems: 'center',
      backgroundColor: colors.background,
      borderRadius: 10,
      height: 118,
      justifyContent: 'flex-end',
      overflow: 'hidden',
      width: '100%',
    },
    barFill: {
      borderTopLeftRadius: 10,
      borderTopRightRadius: 10,
      width: '100%',
    },
    segmentTrack: {
      backgroundColor: colors.background,
      borderRadius: 999,
      flexDirection: 'row',
      gap: 3,
      height: 16,
      overflow: 'hidden',
    },
    segment: {
      height: 16,
    },
    legendGrid: {
      gap: 9,
      marginTop: 14,
    },
    legendItem: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    legendDot: {
      borderRadius: 5,
      height: 10,
      width: 10,
    },
    sparkArea: {
      alignItems: 'flex-end',
      flexDirection: 'row',
      gap: 6,
      height: 122,
    },
    sparkSlot: {
      alignItems: 'center',
      flex: 1,
      gap: 6,
      justifyContent: 'flex-end',
    },
    sparkBar: {
      borderRadius: 999,
      width: '68%',
    },
  });
}
