import { View, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useRef, useEffect, useMemo, useState } from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '~/hooks/useTheme';
import { AppText } from './AppText';
import { Tournament, TournamentStatus } from '~/types';
import { getEffectiveTournamentStatus } from '~/lib/tournaments';

// ─── Status config ─────────────────────────────────────────────────────────────
// Solid colored pill with white text; "Ended" uses a light neutral.
const STATUS_CONFIG: Record<
  TournamentStatus,
  { label: string; color: string; bg: string; dot?: boolean }
> = {
  open: { label: 'Open', color: '#fff', bg: '#16A34A' },
  ongoing: { label: 'Live', color: '#fff', bg: '#EA580C', dot: true },
  paused: { label: 'Paused', color: '#fff', bg: '#7C3AED' },
  completed: { label: 'Ended', color: '#52525B', bg: '#F4F4F5' },
  draft: { label: 'Draft', color: '#fff', bg: '#374151' },
  cancelled: { label: 'Cancelled', color: '#fff', bg: '#DC2626' },
};

// Per-category type theming — used by CategoryRow in the detail screen too
export const CATEGORY_TYPE: Record<string, { color: string; abbr: string }> = {
  "Men's Singles": { color: '#1A73E8', abbr: 'MS' },
  "Women's Singles": { color: '#EC4899', abbr: 'WS' },
  "Men's Doubles": { color: '#0EA5E9', abbr: 'MD' },
  "Women's Doubles": { color: '#F472B6', abbr: 'WD' },
  'Mixed Doubles': { color: '#8B5CF6', abbr: 'XD' },
  "Boys' Singles": { color: '#06B6D4', abbr: 'BS' },
  "Girls' Singles": { color: '#F43F5E', abbr: 'GS' },
  "Boys' Under-15": { color: '#10B981', abbr: 'B15' },
  "Girls' Under-15": { color: '#14B8A6', abbr: 'G15' },
  'Veterans Singles': { color: '#F59E0B', abbr: 'VET' },
};

const BANNER_COLORS = ['#1A73E8', '#0D47A1', '#7C3AED', '#BE185D', '#065F46', '#B45309'];

interface CardAction {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  destructive?: boolean;
  onPress: () => void;
}

interface Props {
  tournament: Tournament;
  onPress: () => void;
  compact?: boolean;
  action?: CardAction;
  secondaryAction?: CardAction;
  menuActions?: CardAction[];
  /**
   * Visually retires the card — ended/cancelled events keep their place in the
   * list but stop competing with live ones for attention.
   */
  dimmed?: boolean;
}

/** Muted banner for retired cards, so the bright hash colour stops shouting. */
const DIMMED_BANNER = '#94A3B8';

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function hashColor(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return BANNER_COLORS[Math.abs(hash) % BANNER_COLORS.length];
}

// Pulsing dot shown inside the "Live" status badge
function LiveDot() {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.15, duration: 500, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);
  return (
    <Animated.View
      style={{
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#fff',
        opacity: pulse,
        marginRight: 5,
      }}
    />
  );
}

export function TournamentCard({
  action,
  menuActions,
  secondaryAction,
  tournament,
  onPress,
  compact = false,
  dimmed = false,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [menuOpen, setMenuOpen] = useState(false);
  const hasMenu = !!menuActions && menuActions.length > 0;

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const onPressIn = () =>
    Animated.spring(scaleAnim, {
      toValue: 0.965,
      useNativeDriver: true,
      friction: 8,
      tension: 150,
    }).start();
  const onPressOut = () =>
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 8,
      tension: 150,
    }).start();

  const statusCfg = STATUS_CONFIG[getEffectiveTournamentStatus(tournament)] ?? STATUS_CONFIG.open;
  const bannerColor = dimmed ? DIMMED_BANNER : hashColor(tournament.id);
  const dateRange =
    tournament.start_date === tournament.end_date
      ? formatDate(tournament.start_date)
      : `${formatDate(tournament.start_date)} – ${formatDate(tournament.end_date)}`;
  const entryFee =
    tournament.categories && tournament.categories.length > 0
      ? Math.min(...tournament.categories.map((c) => c.entry_fee))
      : null;

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }], opacity: dimmed ? 0.66 : 1 }}>
      <TouchableOpacity
        style={[styles.card, dimmed && styles.cardDimmed]}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
      >
        {/* ── Coloured banner ──────────────────────────────── */}
        <View style={[styles.banner, { backgroundColor: bannerColor }]}>
          {/* Subtle badminton court lines */}
          <View style={styles.courtLines}>
            <View style={styles.courtCenterLine} />
            <View style={styles.courtNet} />
            <View style={[styles.courtServiceLine, { left: '24%' }]} />
            <View style={[styles.courtServiceLine, { right: '24%' }]} />
          </View>

          {/* Shuttlecock watermark — feathers fan at top, cork at bottom */}
          <View style={styles.shuttleMark}>
            <View style={styles.shuttleFeathers}>
              <View style={[styles.feather, { transform: [{ rotate: '-14deg' }] }]} />
              <View style={[styles.feather, { transform: [{ rotate: '-7deg' }] }]} />
              <View style={[styles.feather, styles.featherTall]} />
              <View style={[styles.feather, { transform: [{ rotate: '7deg' }] }]} />
              <View style={[styles.feather, { transform: [{ rotate: '14deg' }] }]} />
            </View>
            <View style={styles.shuttleCork} />
          </View>

          {/* Sport label — bottom-left */}
          <View style={styles.bannerSportLabel}>
            <MaterialCommunityIcons name="badminton" size={16} color="rgba(255,255,255,0.92)" />
            <AppText variant="caption" weight="semiBold" color="rgba(255,255,255,0.92)">
              Badminton
            </AppText>
          </View>

          {/* Status pill — bottom-right of banner */}
          <View style={[styles.statusPill, { backgroundColor: statusCfg.bg }]}>
            {statusCfg.dot && <LiveDot />}
            <AppText variant="xs" weight="bold" color={statusCfg.color}>
              {statusCfg.label}
            </AppText>
          </View>
        </View>

        {/* ── Body ─────────────────────────────────────────── */}
        <View style={styles.body}>
          {/* Menu button */}
          {menuActions && menuActions.length > 0 ? (
            <TouchableOpacity
              style={styles.menuButton}
              onPress={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
              activeOpacity={0.75}
            >
              <Ionicons name="ellipsis-vertical" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}

          {/* Dropdown menu */}
          {menuOpen && menuActions && menuActions.length > 0 ? (
            <View style={styles.menu}>
              {menuActions.map((item) => (
                <TouchableOpacity
                  key={item.label}
                  style={styles.menuItem}
                  disabled={item.loading}
                  onPress={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    item.onPress();
                  }}
                  activeOpacity={0.75}
                >
                  {item.icon ? (
                    <Ionicons
                      name={item.icon}
                      size={15}
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

          {/*
            Wraps to a second line, then ellipsises. The right inset clears the
            absolutely-positioned menu button — without it the text runs
            underneath the ⋮ instead of truncating before it.
          */}
          <AppText
            variant="title"
            weight="semiBold"
            numberOfLines={2}
            style={hasMenu ? styles.titleWithMenu : undefined}
          >
            {tournament.title}
          </AppText>

          <View style={styles.row}>
            <Ionicons name="location-outline" size={13} color={colors.textMuted} />
            <AppText
              variant="caption"
              color={colors.textSecondary}
              style={styles.rowText}
              numberOfLines={1}
            >
              {tournament.venue}, {tournament.city}
            </AppText>
          </View>

          <View style={styles.row}>
            <Ionicons name="calendar-outline" size={13} color={colors.textMuted} />
            <AppText variant="caption" color={colors.textSecondary} style={styles.rowText}>
              {dateRange}
            </AppText>
          </View>

          {/* Category type badges */}
          {!compact && tournament.categories && tournament.categories.length > 0 && (
            <View style={styles.categories}>
              {tournament.categories.slice(0, 4).map((cat) => {
                const typeCfg = CATEGORY_TYPE[cat.name];
                const catColor = typeCfg?.color ?? colors.primary;
                return (
                  <View
                    key={cat.id}
                    style={[
                      styles.catBadge,
                      { backgroundColor: catColor + '18', borderColor: catColor + '50' },
                    ]}
                  >
                    <AppText variant="xs" weight="semiBold" color={catColor}>
                      {typeCfg?.abbr ?? cat.name}
                    </AppText>
                  </View>
                );
              })}
              {tournament.categories.length > 4 && (
                <AppText variant="xs" color={colors.textMuted}>
                  +{tournament.categories.length - 4}
                </AppText>
              )}
            </View>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            {entryFee !== null ? (
              <AppText variant="label" weight="semiBold" color={bannerColor}>
                From ₹{entryFee}
              </AppText>
            ) : (
              <AppText variant="label" color={colors.textMuted}>
                Free entry
              </AppText>
            )}
            {tournament.prize_pool ? (
              <View style={styles.prizeRow}>
                <Ionicons name="gift-outline" size={12} color={colors.textMuted} />
                <AppText variant="caption" color={colors.textMuted} style={{ marginLeft: 3 }}>
                  {tournament.prize_pool}
                </AppText>
              </View>
            ) : null}
          </View>

          {/* Action buttons */}
          {action || secondaryAction ? (
            <View style={styles.actionsRow}>
              {action ? (
                <CardActionButton
                  action={action}
                  colors={colors}
                  styles={styles}
                  primary
                  bannerColor={bannerColor}
                />
              ) : null}
              {secondaryAction ? (
                <CardActionButton
                  action={secondaryAction}
                  colors={colors}
                  styles={styles}
                  bannerColor={bannerColor}
                />
              ) : null}
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function CardActionButton({
  action,
  colors,
  primary,
  styles,
  bannerColor,
}: {
  action: CardAction;
  colors: ReturnType<typeof useTheme>['colors'];
  primary?: boolean;
  styles: ReturnType<typeof makeStyles>;
  bannerColor: string;
}) {
  const fg = primary ? '#fff' : action.destructive ? colors.danger : bannerColor;
  return (
    <TouchableOpacity
      style={[
        styles.actionButton,
        primary
          ? [styles.primaryAction, { backgroundColor: bannerColor, borderColor: bannerColor }]
          : action.destructive
            ? styles.destructiveAction
            : [styles.secondaryAction, { borderColor: bannerColor }],
      ]}
      onPress={(e) => {
        e.stopPropagation();
        action.onPress();
      }}
      disabled={action.loading}
      activeOpacity={0.85}
    >
      {action.icon ? <Ionicons name={action.icon} size={15} color={fg} /> : null}
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
    // Retired cards also drop their lift, so they sit flatter on the page.
    cardDimmed: {
      shadowOpacity: 0,
      elevation: 0,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },

    // Banner
    banner: {
      height: 88,
      justifyContent: 'flex-end',
      padding: 10,
      position: 'relative',
    },
    courtLines: {
      position: 'absolute',
      top: 10,
      left: 12,
      right: 58,
      bottom: 10,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.22)',
      borderRadius: 8,
      overflow: 'hidden',
    },
    courtCenterLine: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: '50%',
      width: 1,
      backgroundColor: 'rgba(255,255,255,0.18)',
    },
    courtNet: {
      position: 'absolute',
      top: '50%',
      left: 0,
      right: 0,
      height: 1,
      backgroundColor: 'rgba(255,255,255,0.28)',
    },
    courtServiceLine: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: 1,
      backgroundColor: 'rgba(255,255,255,0.14)',
    },
    shuttleMark: {
      position: 'absolute',
      right: 14,
      top: 8,
      alignItems: 'center',
      opacity: 0.28,
      transform: [{ rotate: '15deg' }],
    },
    shuttleFeathers: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 2,
    },
    feather: {
      width: 7,
      height: 26,
      borderTopLeftRadius: 4,
      borderTopRightRadius: 4,
      borderBottomLeftRadius: 1,
      borderBottomRightRadius: 1,
      backgroundColor: 'rgba(255,255,255,0.95)',
    },
    featherTall: {
      height: 32,
    },
    shuttleCork: {
      width: 16,
      height: 10,
      borderRadius: 8,
      backgroundColor: '#FDE68A',
      marginTop: -1,
    },
    bannerSportLabel: {
      position: 'absolute',
      bottom: 10,
      left: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    statusPill: {
      position: 'absolute',
      bottom: 10,
      right: 10,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 20,
    },

    // Body
    body: {
      padding: 14,
      gap: 5,
      position: 'relative',
    },
    /*
     * Clears the ⋮ button: it sits 10 from the card edge and is 32 wide, while
     * the body is padded 14 — so the text must give up (10 + 32) - 14 = 28,
     * plus a little breathing room.
     */
    titleWithMenu: {
      paddingRight: 34,
    },
    menuButton: {
      position: 'absolute',
      right: 10,
      top: 10,
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 3,
    },
    menu: {
      position: 'absolute',
      right: 12,
      top: 44,
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 12,
      minWidth: 170,
      overflow: 'hidden',
      elevation: 8,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 10,
      zIndex: 4,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      minHeight: 44,
      paddingHorizontal: 12,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    rowText: { flex: 1 },
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
      borderWidth: 1,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 6,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    prizeRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    actionsRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 8,
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1.5,
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
      backgroundColor: 'transparent',
      borderColor: colors.danger,
    },
  });
}
