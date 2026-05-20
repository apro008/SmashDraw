import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '~/hooks/useTheme';
import { AppText } from './AppText';
import { Tournament, TournamentStatus } from '~/types';

const STATUS_CONFIG: Record<TournamentStatus, { label: string; color: string; bg: string }> = {
  open: { label: 'Open', color: '#16A34A', bg: '#DCFCE7' },
  ongoing: { label: 'Live', color: '#D97706', bg: '#FEF3C7' },
  paused: { label: 'Paused', color: '#7C3AED', bg: '#EDE9FE' },
  completed: { label: 'Ended', color: '#6B7280', bg: '#F3F4F6' },
  draft: { label: 'Draft', color: '#6B7280', bg: '#F3F4F6' },
  cancelled: { label: 'Cancelled', color: '#DC2626', bg: '#FEE2E2' },
};

const GRADIENT_COLORS = ['#1A73E8', '#0D47A1', '#7C3AED', '#BE185D', '#065F46', '#B45309'];

interface Props {
  tournament: Tournament;
  onPress: () => void;
  compact?: boolean;
  action?: CardAction;
  secondaryAction?: CardAction;
  menuActions?: CardAction[];
}

interface CardAction {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  destructive?: boolean;
  onPress: () => void;
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

export function TournamentCard({
  action,
  menuActions,
  secondaryAction,
  tournament,
  onPress,
  compact = false,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [menuOpen, setMenuOpen] = useState(false);
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
        <View style={styles.courtLines}>
          <View style={styles.courtCenterLine} />
          <View style={styles.courtNet} />
          <View style={[styles.courtServiceLine, { left: '24%' }]} />
          <View style={[styles.courtServiceLine, { right: '24%' }]} />
        </View>
        <View style={styles.shuttleMark}>
          <View style={styles.shuttleCork} />
          <View style={styles.shuttleFeathers}>
            <View style={styles.feather} />
            <View style={[styles.feather, styles.featherMid]} />
            <View style={styles.feather} />
          </View>
        </View>
        <View style={styles.bannerTitle}>
          <Ionicons name="tennisball" size={16} color="rgba(255,255,255,0.92)" />
          <AppText variant="caption" weight="semiBold" color="rgba(255,255,255,0.92)">
            Badminton
          </AppText>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
          <AppText variant="xs" weight="semiBold" color={statusCfg.color}>
            {statusCfg.label}
          </AppText>
        </View>
      </View>

      <View style={styles.body}>
        {menuActions && menuActions.length > 0 ? (
          <TouchableOpacity
            style={styles.menuButton}
            onPress={(event) => {
              event.stopPropagation();
              setMenuOpen((current) => !current);
            }}
            activeOpacity={0.75}
          >
            <Ionicons name="ellipsis-vertical" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        ) : null}

        {menuOpen && menuActions && menuActions.length > 0 ? (
          <View style={styles.menu}>
            {menuActions.map((item) => (
              <TouchableOpacity
                key={item.label}
                style={styles.menuItem}
                disabled={item.loading}
                onPress={(event) => {
                  event.stopPropagation();
                  setMenuOpen(false);
                  item.onPress();
                }}
                activeOpacity={0.75}
              >
                {item.icon ? (
                  <Ionicons
                    name={item.icon}
                    size={16}
                    color={item.destructive ? colors.danger : colors.text}
                  />
                ) : null}
                <AppText
                  variant="label"
                  weight="medium"
                  color={item.destructive ? colors.danger : colors.text}
                >
                  {item.label}
                </AppText>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

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
              <View
                key={cat.id}
                style={[styles.catBadge, { backgroundColor: colors.primaryLight }]}
              >
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

        {action || secondaryAction ? (
          <View style={styles.actionsRow}>
            {action ? (
              <CardActionButton action={action} styles={styles} colors={colors} primary />
            ) : null}
            {secondaryAction ? (
              <CardActionButton action={secondaryAction} styles={styles} colors={colors} />
            ) : null}
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

function CardActionButton({
  action,
  colors,
  primary,
  styles,
}: {
  action: CardAction;
  colors: ReturnType<typeof useTheme>['colors'];
  primary?: boolean;
  styles: ReturnType<typeof makeStyles>;
}) {
  const fg = primary ? '#fff' : action.destructive ? colors.danger : colors.primary;
  return (
    <TouchableOpacity
      style={[
        styles.actionButton,
        primary ? styles.primaryAction : styles.secondaryAction,
        action.destructive && !primary ? styles.destructiveAction : null,
      ]}
      onPress={(event) => {
        event.stopPropagation();
        action.onPress();
      }}
      disabled={action.loading}
      activeOpacity={0.85}
    >
      {action.icon ? <Ionicons name={action.icon} size={17} color={fg} /> : null}
      <AppText variant="label" weight="semiBold" color={fg}>
        {action.label}
      </AppText>
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
      position: 'relative',
    },
    courtLines: {
      borderColor: 'rgba(255,255,255,0.22)',
      borderRadius: 10,
      borderWidth: 1,
      bottom: 10,
      left: 12,
      opacity: 0.9,
      position: 'absolute',
      right: 58,
      top: 12,
    },
    courtCenterLine: {
      backgroundColor: 'rgba(255,255,255,0.2)',
      bottom: 0,
      left: '50%',
      position: 'absolute',
      top: 0,
      width: 1,
    },
    courtNet: {
      backgroundColor: 'rgba(255,255,255,0.32)',
      height: 1,
      left: 0,
      position: 'absolute',
      right: 0,
      top: '50%',
    },
    courtServiceLine: {
      backgroundColor: 'rgba(255,255,255,0.18)',
      bottom: 0,
      position: 'absolute',
      top: 0,
      width: 1,
    },
    shuttleMark: {
      alignItems: 'center',
      justifyContent: 'center',
      position: 'absolute',
      right: 12,
      top: 12,
      transform: [{ rotate: '-18deg' }],
    },
    shuttleCork: {
      backgroundColor: '#FDE68A',
      borderRadius: 7,
      height: 14,
      width: 14,
    },
    shuttleFeathers: {
      flexDirection: 'row',
      gap: 2,
      marginTop: -1,
    },
    feather: {
      backgroundColor: 'rgba(255,255,255,0.9)',
      borderRadius: 5,
      height: 24,
      width: 8,
    },
    featherMid: {
      height: 29,
    },
    bannerTitle: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 5,
      left: 22,
      position: 'absolute',
      top: 18,
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
      position: 'relative',
    },
    menuButton: {
      alignItems: 'center',
      borderRadius: 16,
      height: 32,
      justifyContent: 'center',
      position: 'absolute',
      right: 10,
      top: 10,
      width: 32,
      zIndex: 3,
    },
    menu: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      elevation: 8,
      minWidth: 170,
      overflow: 'hidden',
      position: 'absolute',
      right: 12,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 10,
      top: 42,
      zIndex: 4,
    },
    menuItem: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 9,
      minHeight: 44,
      paddingHorizontal: 12,
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
    actionsRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
      marginTop: 10,
    },
    actionButton: {
      alignItems: 'center',
      borderRadius: 10,
      borderWidth: 1,
      flex: 1,
      flexDirection: 'row',
      gap: 6,
      justifyContent: 'center',
      paddingVertical: 10,
    },
    primaryAction: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    secondaryAction: {
      backgroundColor: 'transparent',
      borderColor: colors.primary,
    },
    destructiveAction: {
      borderColor: colors.danger,
    },
  });
}
