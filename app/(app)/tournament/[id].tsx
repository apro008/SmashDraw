import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '~/components/AppText';
import { AppButton } from '~/components/AppButton';
import { SkeletonLoader } from '~/components/common/SkeletonLoader';
import { useTheme } from '~/hooks/useTheme';
import { CATEGORY_TYPE } from '~/components/TournamentCard';
import { Tournament, TournamentCategory, TournamentMatchResult, TournamentStatus } from '~/types';
import { addCalendarEvent } from '~/lib/calendar';
import { useAlert } from '~/providers/AlertProvider';
import {
  closeTournamentIfDue,
  fetchTournamentById,
  fetchTournamentResults,
  fetchTournamentRegistrations,
  fetchUserTournamentRegistrations,
  getDaysUntilClose,
  getEffectiveTournamentStatus,
  getResultAccess,
  isTournamentClosed,
  removeTournamentEntry,
  TournamentRegistrationDetails,
  updateRegistrationStatus,
  updateTournamentStatus,
} from '~/lib/tournaments';
import { fetchTournamentMatches, pendingMatches, roundLabel } from '~/lib/draw';
import { AddEntrySheet } from '~/components/tournament/AddEntrySheet';
import { RegistrationSheet } from '~/components/tournament/RegistrationSheet';
import { ResultEntrySheet } from '~/components/tournament/ResultEntrySheet';
import { useAuthStore } from '~/store/useAuthStore';
import { isDoublesCategory } from '~/constants/TournamentCategories';
import {
  getTournamentCoordinates,
  getTournamentLocationLabel,
  openTournamentMap,
} from '~/lib/maps';

type RegistrationStatusCounts = Record<'approved' | 'pending' | 'rejected' | 'waitlisted', number>;

const STATUS_CONFIG: Record<
  TournamentStatus,
  { label: string; color: string; bg: string; dot?: boolean }
> = {
  open: { label: 'Open', color: '#fff', bg: '#16A34A' },
  ongoing: { label: 'Live', color: '#fff', bg: '#EA580C', dot: true },
  paused: { label: 'Paused', color: '#fff', bg: '#7C3AED' },
  completed: { label: 'Ended', color: '#4B5563', bg: '#F3F4F6' },
  draft: { label: 'Draft', color: '#fff', bg: '#374151' },
  cancelled: { label: 'Cancelled', color: '#fff', bg: '#DC2626' },
};

const REGISTRATION_STATUS_CONFIG = {
  pending: { label: 'Pending', color: '#D97706', bg: '#FEF3C7' },
  approved: { label: 'Approved', color: '#16A34A', bg: '#DCFCE7' },
  rejected: { label: 'Rejected', color: '#DC2626', bg: '#FEE2E2' },
  waitlisted: { label: 'Waitlisted', color: '#7C3AED', bg: '#EDE9FE' },
};

const HASH_COLORS = ['#1A73E8', '#0D47A1', '#7C3AED', '#BE185D', '#065F46', '#B45309'];

const CATEGORY_ABBR: Record<string, string> = {
  "Men's Singles": 'MS',
  "Women's Singles": 'WS',
  "Men's Doubles": 'MD',
  "Women's Doubles": 'WD',
  'Mixed Doubles': 'XD',
  "Boys' Singles": 'BS',
  "Girls' Singles": 'GS',
  "Boys' Under-15": 'B15',
  "Girls' Under-15": 'G15',
  'Veterans Singles': 'VET',
};

function hashColor(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return HASH_COLORS[Math.abs(hash) % HASH_COLORS.length];
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatShortDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/** Winner ids are authoritative; older rows may only carry the winner name. */
function didSideWin(result: TournamentMatchResult, side: 1 | 2) {
  const playerId = side === 1 ? result.player1_id : result.player2_id;
  const playerName = side === 1 ? result.player1_name : result.player2_name;
  if (result.winner_id && playerId) return result.winner_id === playerId;
  return !!result.winner_name && result.winner_name === playerName;
}

function getCategoryColor(name: string) {
  return CATEGORY_TYPE[name]?.color ?? '#1A73E8';
}

function getCategoryAbbr(name: string) {
  return (
    CATEGORY_ABBR[name] ??
    name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 3)
  );
}

// ─── Live dot (pulsing indicator for ongoing) ───────────────────────────────
function LiveDot({ color = '#fff' }: { color?: string }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.2, duration: 550, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 550, useNativeDriver: true }),
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
        backgroundColor: color,
        opacity: pulse,
        marginRight: 4,
      }}
    />
  );
}

// ─── Quick stat chip ─────────────────────────────────────────────────────────
function StatChip({
  icon,
  label,
  value,
  colors,
  highlight,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  colors: any;
  highlight?: boolean;
}) {
  return (
    <View
      style={{
        backgroundColor: highlight ? colors.primaryLight : colors.surface,
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        alignItems: 'center',
        gap: 4,
        minWidth: 90,
        borderWidth: 1,
        borderColor: highlight ? colors.primary + '40' : colors.border,
      }}
    >
      <Ionicons name={icon} size={16} color={highlight ? colors.primary : colors.textMuted} />
      <AppText variant="xs" color={colors.textMuted}>
        {label}
      </AppText>
      <AppText variant="label" weight="semiBold" color={highlight ? colors.primary : colors.text}>
        {value}
      </AppText>
    </View>
  );
}

// ─── Slots bar ───────────────────────────────────────────────────────────────
function SlotsBar({
  categoryName,
  colors,
  counts,
  current,
  max,
}: {
  categoryName: string;
  colors: any;
  counts?: RegistrationStatusCounts;
  current: number;
  max: number;
}) {
  const approved = counts?.approved ?? current;
  const pct = Math.min(approved / max, 1);
  const left = max - approved;
  const barColor = pct >= 0.9 ? '#DC2626' : pct >= 0.7 ? '#D97706' : '#16A34A';
  const softColor = pct >= 0.9 ? '#FEE2E2' : pct >= 0.7 ? '#FEF3C7' : '#DCFCE7';
  const entryLabel = isDoublesCategory(categoryName) ? 'teams joined' : 'players joined';
  const remainingLabel = isDoublesCategory(categoryName) ? 'teams left' : 'spots left';
  const statusLabel = pct >= 1 ? 'Full' : pct >= 0.75 ? 'Filling fast' : 'Open now';

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <AppText variant="xs" color={colors.textMuted}>
          {approved}/{max} {entryLabel}
        </AppText>
        <AppText variant="xs" weight="semiBold" color={barColor}>
          {left} {remainingLabel}
        </AppText>
      </View>
      <View
        style={{ height: 8, backgroundColor: softColor, borderRadius: 999, overflow: 'hidden' }}
      >
        <View
          style={{
            height: 8,
            width: `${pct * 100}%` as any,
            backgroundColor: barColor,
            borderRadius: 999,
          }}
        />
      </View>
      <AppText variant="xs" weight="semiBold" color={barColor}>
        {statusLabel}
      </AppText>
      {counts ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <StatusMiniPill color="#16A34A" label={`${counts.approved} approved`} />
          <StatusMiniPill color="#D97706" label={`${counts.pending} pending`} />
          <StatusMiniPill color="#DC2626" label={`${counts.rejected} rejected`} />
          {counts.waitlisted > 0 && (
            <StatusMiniPill color="#7C3AED" label={`${counts.waitlisted} waitlisted`} />
          )}
        </View>
      ) : null}
    </View>
  );
}

function StatusMiniPill({ color, label }: { color: string; label: string }) {
  return (
    <View
      style={{
        borderColor: color,
        borderRadius: 999,
        borderWidth: 1,
        paddingHorizontal: 7,
        paddingVertical: 2,
      }}
    >
      <AppText variant="xs" weight="semiBold" color={color}>
        {label}
      </AppText>
    </View>
  );
}

// ─── Category row ─────────────────────────────────────────────────────────────
function CategoryRow({
  cat,
  colors,
  counts,
  styles,
}: {
  cat: TournamentCategory;
  colors: any;
  counts?: RegistrationStatusCounts;
  styles: any;
}) {
  const catColor = getCategoryColor(cat.name);
  const abbr = getCategoryAbbr(cat.name);

  return (
    <View style={styles.catRow}>
      <View style={[styles.catAccentStrip, { backgroundColor: catColor }]} />
      <View style={styles.catInner}>
        <View style={styles.catTop}>
          <View style={{ flex: 1 }}>
            <View style={styles.catNameRow}>
              <View style={[styles.catAbbrChip, { backgroundColor: catColor + '20' }]}>
                <AppText variant="xs" weight="bold" color={catColor}>
                  {abbr}
                </AppText>
              </View>
              <AppText variant="bodyLg" weight="semiBold" style={{ flex: 1 }} numberOfLines={1}>
                {cat.name}
              </AppText>
            </View>
          </View>
          <View
            style={[
              styles.catFeeChip,
              { backgroundColor: catColor + '18', borderColor: catColor + '45' },
            ]}
          >
            <AppText variant="label" weight="bold" color={catColor}>
              ₹{cat.entry_fee}
            </AppText>
          </View>
        </View>
        <View style={styles.catMetaRow}>
          <View style={[styles.skillBadge, { borderColor: colors.border }]}>
            <Ionicons name="stats-chart-outline" size={10} color={colors.textMuted} />
            <AppText variant="xs" weight="medium" color={colors.textSecondary}>
              {cat.skill_level.charAt(0).toUpperCase() + cat.skill_level.slice(1)}
            </AppText>
          </View>
          {cat.prize ? (
            <View style={styles.catPrizeBadge}>
              <Ionicons name="trophy-outline" size={10} color="#B45309" />
              <AppText variant="xs" color="#B45309">
                {cat.prize}
              </AppText>
            </View>
          ) : null}
        </View>
        <SlotsBar
          categoryName={cat.name}
          counts={counts}
          current={cat.current_players}
          max={cat.max_players}
          colors={colors}
        />
      </View>
    </View>
  );
}

// ─── Result card (match rows layout) ─────────────────────────────────────────
function ResultCard({
  colors,
  isMine,
  result,
  styles,
}: {
  colors: any;
  isMine?: boolean;
  result: TournamentMatchResult;
  styles: any;
}) {
  const p1Score = result.player1_score ?? 0;
  const p2Score = result.player2_score ?? 0;
  const p1Won = didSideWin(result, 1);
  const p2Won = didSideWin(result, 2);
  const catColor = getCategoryColor(result.category?.name ?? '');
  const abbr = result.category?.name ? getCategoryAbbr(result.category.name) : '?';

  return (
    <View style={[styles.resultCard, isMine ? styles.resultCardMine : null]}>
      <View style={[styles.resultAccentStrip, { backgroundColor: catColor }]} />
      <View style={styles.resultInner}>
        {/* Header */}
        <View style={styles.resultHeader}>
          <View
            style={[
              styles.resultCatChip,
              { backgroundColor: catColor + '20', borderColor: catColor + '45' },
            ]}
          >
            <AppText variant="xs" weight="bold" color={catColor}>
              {abbr}
            </AppText>
          </View>
          <AppText variant="xs" color={colors.textMuted} style={{ flex: 1 }} numberOfLines={1}>
            {result.category?.name ?? 'Match'} · #{result.match_number}
          </AppText>
          {isMine ? (
            <View style={[styles.resultMineChip, { borderColor: colors.primary }]}>
              <AppText variant="xs" weight="semiBold" color={colors.primary}>
                Your match
              </AppText>
            </View>
          ) : null}
          {result.completed_at ? (
            <AppText variant="xs" color={colors.textMuted}>
              {formatShortDate(result.completed_at)}
            </AppText>
          ) : null}
        </View>

        {/* Stacked player rows */}
        <View style={styles.matchRows}>
          <View style={[styles.matchRow, p1Won && styles.matchRowWon]}>
            <View style={styles.matchRowLeft}>
              {p1Won ? (
                <Ionicons name="trophy" size={13} color="#B45309" />
              ) : (
                <View style={{ width: 13 }} />
              )}
              <AppText
                variant="label"
                weight={p1Won ? 'semiBold' : 'regular'}
                numberOfLines={1}
                style={{ flex: 1 }}
                color={p1Won ? colors.text : colors.textSecondary}
              >
                {result.player1_name ?? 'Side A'}
              </AppText>
            </View>
            <AppText style={[styles.matchScore, { color: p1Won ? '#B45309' : colors.textMuted }]}>
              {p1Score}
            </AppText>
          </View>

          <View style={styles.matchDivider} />

          <View style={[styles.matchRow, p2Won && styles.matchRowWon]}>
            <View style={styles.matchRowLeft}>
              {p2Won ? (
                <Ionicons name="trophy" size={13} color="#B45309" />
              ) : (
                <View style={{ width: 13 }} />
              )}
              <AppText
                variant="label"
                weight={p2Won ? 'semiBold' : 'regular'}
                numberOfLines={1}
                style={{ flex: 1 }}
                color={p2Won ? colors.text : colors.textSecondary}
              >
                {result.player2_name ?? 'Side B'}
              </AppText>
            </View>
            <AppText style={[styles.matchScore, { color: p2Won ? '#B45309' : colors.textMuted }]}>
              {p2Score}
            </AppText>
          </View>
        </View>

        {/* Footer */}
        {result.score || result.prize_money_received || result.result_notes ? (
          <View style={styles.resultFooter}>
            {result.score ? (
              <View style={styles.resultScorePill}>
                <AppText variant="xs" color={colors.textSecondary} weight="semiBold">
                  {result.score}
                </AppText>
              </View>
            ) : null}
            {result.prize_money_received ? (
              <View style={styles.resultPrizePill}>
                <Ionicons name="cash-outline" size={11} color="#B45309" />
                <AppText variant="xs" weight="semiBold" color="#B45309">
                  ₹{result.prize_money_received}
                </AppText>
              </View>
            ) : null}
            {result.result_notes ? (
              <AppText variant="xs" color={colors.textMuted} numberOfLines={1} style={{ flex: 1 }}>
                {result.result_notes}
              </AppText>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ─── Registration row ─────────────────────────────────────────────────────────
function parseRegistrationNotes(notes: string | null) {
  if (!notes) return {};
  try {
    return JSON.parse(notes) as {
      playerName?: string;
      phone?: string;
      email?: string;
      partnerName?: string | null;
      partnerPhone?: string | null;
      notes?: string | null;
    };
  } catch {
    return { notes };
  }
}

function RegistrationRow({
  registration,
  onRemove,
  onStatusChange,
  statusLoading,
  colors,
  styles,
}: {
  registration: TournamentRegistrationDetails;
  onRemove?: (id: string) => void;
  onStatusChange?: (id: string, status: 'approved' | 'rejected' | 'waitlisted') => void;
  statusLoading?: boolean;
  colors: any;
  styles: any;
}) {
  const details = parseRegistrationNotes(registration.notes);
  const playerName = details.playerName ?? registration.player?.name ?? 'Player';
  const phone = details.phone ?? registration.player?.phone;
  const email = details.email ?? registration.player?.email;
  const statusCfg = REGISTRATION_STATUS_CONFIG[registration.status];
  const catColor = getCategoryColor(registration.category?.name ?? '');
  const addedByOrganizer = !!registration.added_by;

  return (
    <View style={styles.registrationRow}>
      <View style={styles.registrationTop}>
        <View style={[styles.registrationCatDot, { backgroundColor: catColor }]} />
        <View style={{ flex: 1 }}>
          <AppText variant="bodyLg" weight="semiBold">
            {playerName}
          </AppText>
          <AppText variant="caption" color={colors.textSecondary}>
            {registration.category?.name ?? 'Category'}
            {addedByOrganizer ? ' · added by organizer' : ''}
          </AppText>
        </View>
        <View style={[styles.registrationStatusPill, { backgroundColor: statusCfg.bg }]}>
          <AppText variant="xs" weight="semiBold" color={statusCfg.color}>
            {statusCfg.label}
          </AppText>
        </View>
      </View>
      <View style={styles.registrationMeta}>
        {phone ? (
          <AppText variant="caption" color={colors.textMuted}>
            Phone: {phone}
          </AppText>
        ) : null}
        {email ? (
          <AppText variant="caption" color={colors.textMuted}>
            Email: {email}
          </AppText>
        ) : null}
        {details.partnerName ? (
          <AppText variant="caption" color={colors.textMuted}>
            Partner: {details.partnerName}
            {details.partnerPhone ? ` (${details.partnerPhone})` : ''}
          </AppText>
        ) : null}
        {details.notes ? (
          <AppText variant="caption" color={colors.textMuted}>
            Notes: {details.notes}
          </AppText>
        ) : null}
      </View>
      {onStatusChange || (onRemove && addedByOrganizer) ? (
        <View style={styles.registrationActions}>
          {onRemove && addedByOrganizer ? (
            <TouchableOpacity
              activeOpacity={0.8}
              disabled={statusLoading}
              onPress={() => onRemove(registration.id)}
              style={[styles.statusAction, styles.rejectAction, statusLoading && styles.disabled]}
            >
              <Ionicons name="trash-outline" size={13} color="#DC2626" />
              <AppText variant="xs" weight="semiBold" color="#DC2626">
                Remove
              </AppText>
            </TouchableOpacity>
          ) : null}
          {onStatusChange && registration.status !== 'approved' ? (
            <TouchableOpacity
              activeOpacity={0.8}
              disabled={statusLoading}
              onPress={() => onStatusChange(registration.id, 'approved')}
              style={[styles.statusAction, styles.approveAction, statusLoading && styles.disabled]}
            >
              <Ionicons name="checkmark" size={13} color="#fff" />
              <AppText variant="xs" weight="semiBold" color="#fff">
                Approve
              </AppText>
            </TouchableOpacity>
          ) : null}
          {onStatusChange && registration.status !== 'waitlisted' ? (
            <TouchableOpacity
              activeOpacity={0.8}
              disabled={statusLoading}
              onPress={() => onStatusChange(registration.id, 'waitlisted')}
              style={[styles.statusAction, styles.waitlistAction, statusLoading && styles.disabled]}
            >
              <Ionicons name="time-outline" size={13} color="#7C3AED" />
              <AppText variant="xs" weight="semiBold" color="#7C3AED">
                Waitlist
              </AppText>
            </TouchableOpacity>
          ) : null}
          {onStatusChange && registration.status !== 'rejected' ? (
            <TouchableOpacity
              activeOpacity={0.8}
              disabled={statusLoading}
              onPress={() => onStatusChange(registration.id, 'rejected')}
              style={[styles.statusAction, styles.rejectAction, statusLoading && styles.disabled]}
            >
              <Ionicons name="close" size={13} color="#DC2626" />
              <AppText variant="xs" weight="semiBold" color="#DC2626">
                Reject
              </AppText>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function groupRegistrationsByCategory(regs: TournamentRegistrationDetails[]) {
  const map = new Map<
    string,
    { catId: string; catName: string; items: TournamentRegistrationDetails[] }
  >();
  for (const r of regs) {
    const key = r.category_id;
    const name = r.category?.name ?? 'Unknown';
    if (!map.has(key)) map.set(key, { catId: key, catName: name, items: [] });
    map.get(key)!.items.push(r);
  }
  return Array.from(map.values());
}

function getRegistrationCountsByCategory(registrations: TournamentRegistrationDetails[]) {
  const counts = new Map<string, RegistrationStatusCounts>();
  registrations.forEach((r) => {
    const current = counts.get(r.category_id) ?? {
      approved: 0,
      pending: 0,
      rejected: 0,
      waitlisted: 0,
    };
    current[r.status] += 1;
    counts.set(r.category_id, current);
  });
  return counts;
}

function getCategoryStatusCounts(
  countsByCategory: Map<string, RegistrationStatusCounts>,
  category: TournamentCategory
) {
  return (
    countsByCategory.get(category.id) ?? {
      approved: category.current_players,
      pending: 0,
      rejected: 0,
      waitlisted: 0,
    }
  );
}

// ─── Category registration section (collapsible) ─────────────────────────────
function CategoryRegistrationSection({
  catName,
  items,
  onRemove,
  onStatusChange,
  updatingId,
  colors,
  styles,
  isFirst,
}: {
  catName: string;
  items: TournamentRegistrationDetails[];
  onRemove?: (id: string) => void;
  onStatusChange?: (id: string, status: 'approved' | 'rejected' | 'waitlisted') => void;
  updatingId: string | null;
  colors: any;
  styles: any;
  isFirst: boolean;
}) {
  const [open, setOpen] = useState(true);
  const catColor = getCategoryColor(catName);
  const abbr = getCategoryAbbr(catName);
  const approved = items.filter((r) => r.status === 'approved').length;
  const pending = items.filter((r) => r.status === 'pending').length;
  const waitlisted = items.filter((r) => r.status === 'waitlisted').length;

  return (
    <View style={[styles.catRegSection, !isFirst && styles.catRegSectionBorder]}>
      <TouchableOpacity
        style={styles.catRegHeader}
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.75}
      >
        <View style={[styles.catRegAbbrChip, { backgroundColor: catColor + '22' }]}>
          <AppText variant="xs" weight="bold" color={catColor}>
            {abbr}
          </AppText>
        </View>
        <AppText variant="label" weight="semiBold" style={{ flex: 1 }} numberOfLines={1}>
          {catName}
        </AppText>
        <View style={styles.catRegCounts}>
          {approved > 0 ? (
            <View style={[styles.catRegCountPill, { backgroundColor: '#DCFCE7' }]}>
              <Ionicons name="checkmark" size={10} color="#16A34A" />
              <AppText variant="xs" weight="bold" color="#16A34A">
                {approved}
              </AppText>
            </View>
          ) : null}
          {pending > 0 ? (
            <View style={[styles.catRegCountPill, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="time-outline" size={10} color="#D97706" />
              <AppText variant="xs" weight="bold" color="#D97706">
                {pending}
              </AppText>
            </View>
          ) : null}
          {waitlisted > 0 ? (
            <View style={[styles.catRegCountPill, { backgroundColor: '#EDE9FE' }]}>
              <Ionicons name="hourglass-outline" size={10} color="#7C3AED" />
              <AppText variant="xs" weight="bold" color="#7C3AED">
                {waitlisted}
              </AppText>
            </View>
          ) : null}
          <AppText variant="xs" color={colors.textMuted}>
            {items.length} total
          </AppText>
        </View>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={15}
          color={colors.textMuted}
          style={{ marginLeft: 6 }}
        />
      </TouchableOpacity>

      {open ? (
        <View style={styles.catRegBody}>
          {items.map((r) => (
            <RegistrationRow
              key={r.id}
              registration={r}
              onRemove={onRemove}
              onStatusChange={onStatusChange}
              statusLoading={updatingId === r.id}
              colors={colors}
              styles={styles}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function TournamentDetailScreen() {
  const { finishMatch, id } = useLocalSearchParams<{ finishMatch?: string; id: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { confirm, showAlert } = useAlert();
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);

  const [calendarLoading, setCalendarLoading] = useState(false);
  const [registrationVisible, setRegistrationVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [registrations, setRegistrations] = useState<TournamentRegistrationDetails[]>([]);
  const [myRegistrations, setMyRegistrations] = useState<TournamentRegistrationDetails[]>([]);
  const [results, setResults] = useState<TournamentMatchResult[]>([]);
  const [matches, setMatches] = useState<TournamentMatchResult[]>([]);
  const [resultMatch, setResultMatch] = useState<TournamentMatchResult | null>(null);
  const [updatingRegistrationId, setUpdatingRegistrationId] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [resultEntryVisible, setResultEntryVisible] = useState(false);
  const [addEntryVisible, setAddEntryVisible] = useState(false);
  const [handledFinishParam, setHandledFinishParam] = useState(false);

  const loadTournament = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      let next = await fetchTournamentById(id);
      const canViewReg = !!next && (next.organizer_id === user?.id || profile?.role === 'admin');
      // A tournament reads as finished a week after its last match day. Organizers and admins
      // are the only roles allowed to write the status, so they persist it on view.
      if (next && canViewReg) {
        try {
          if (await closeTournamentIfDue(next)) next = { ...next, status: 'completed' };
        } catch {
          // Non-fatal: the screen still renders the closed state from the end date.
        }
      }
      setTournament(next);
      setResults(next ? await fetchTournamentResults(id) : []);
      // The whole bracket, not just the played matches — this is what tells the
      // screen a draw exists and which fixtures are still waiting on a score.
      setMatches(next ? await fetchTournamentMatches(id) : []);
      setRegistrations(canViewReg ? await fetchTournamentRegistrations(id) : []);
      const loadMyEntries = !!next && !!user?.id && next.organizer_id !== user.id;
      setMyRegistrations(loadMyEntries ? await fetchUserTournamentRegistrations(id, user.id) : []);
    } catch (err: any) {
      showAlert({
        type: 'danger',
        title: 'Unable to load tournament',
        message: err?.message ?? 'Please try again.',
      });
    } finally {
      setLoading(false);
    }
  }, [id, profile?.role, showAlert, user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadTournament();
    }, [loadTournament])
  );

  useEffect(() => {
    if (handledFinishParam || finishMatch !== '1' || !tournament) return;
    if (!getResultAccess(tournament, user?.id, profile?.role).canManage) return;
    setResultEntryVisible(true);
    setHandledFinishParam(true);
  }, [finishMatch, handledFinishParam, profile?.role, tournament, user?.id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.navBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <AppText variant="title" weight="bold">
            Tournament
          </AppText>
        </View>
        <ScrollView
          contentContainerStyle={styles.loadingScroll}
          showsVerticalScrollIndicator={false}
        >
          <SkeletonLoader variant="detail" count={3} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!tournament) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.textMuted} />
          <AppText variant="title" color={colors.textMuted} center style={{ marginTop: 12 }}>
            Tournament not found
          </AppText>
          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
            <AppText variant="body" color={colors.primary}>
              Go back
            </AppText>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const effectiveStatus = getEffectiveTournamentStatus(tournament);
  const isClosed = isTournamentClosed(tournament);
  const daysUntilClose = getDaysUntilClose(tournament);
  const statusCfg = STATUS_CONFIG[effectiveStatus];
  const accentColor = hashColor(tournament.id);
  const dateRange =
    tournament.start_date === tournament.end_date
      ? formatDate(tournament.start_date)
      : `${formatDate(tournament.start_date)} – ${formatDate(tournament.end_date)}`;

  const totalSlots = tournament.categories?.reduce((s, c) => s + c.max_players, 0) ?? 0;
  const filledSlots = tournament.categories?.reduce((s, c) => s + c.current_players, 0) ?? 0;
  const registeredCategoryIds = myRegistrations.map((r) => r.category_id).filter(Boolean);
  const openCategoryCount = tournament.categories?.length ?? 0;
  const hasJoined = myRegistrations.length > 0;
  const myEntryStatus = myRegistrations[0]?.status ?? null;
  const myEntryStatusCfg = myEntryStatus ? REGISTRATION_STATUS_CONFIG[myEntryStatus] : null;
  const canJoinAnotherCategory = registeredCategoryIds.length < openCategoryCount;
  const canRegister =
    profile?.role === 'player' &&
    effectiveStatus === 'open' &&
    tournament.organizer_id !== user?.id &&
    openCategoryCount > 0 &&
    canJoinAnotherCategory;
  const canViewRegistrations = tournament.organizer_id === user?.id || profile?.role === 'admin';
  const resultAccess = getResultAccess(tournament, user?.id, profile?.role);
  const canManageResults = resultAccess.canManage;
  const myResults = user?.id
    ? results.filter((r) => r.player1_id === user.id || r.player2_id === user.id)
    : [];

  const drawPublished = matches.length > 0;
  const pendingDrawMatches = pendingMatches(matches);
  const categoryNameById = new Map(
    (tournament.categories ?? []).map((category) => [category.id, category.name])
  );
  // Round 1's size fixes a category's bracket, so its depth follows from the
  // number of opening matches — that is what turns a round number into "Semi-final".
  const roundsByCategory = matches.reduce<Record<string, number>>((acc, match) => {
    if (match.round === 1) acc[match.category_id] = (acc[match.category_id] ?? 0) + 1;
    return acc;
  }, {});
  const depthOf = (categoryId: string) =>
    roundsByCategory[categoryId] ? Math.log2(roundsByCategory[categoryId] * 2) : 0;

  const openResultSheet = (match: TournamentMatchResult | null) => {
    setResultMatch(match);
    setResultEntryVisible(true);
  };

  const approvedCount = registrations.filter((r) => r.status === 'approved').length;
  const pendingCount = registrations.filter((r) => r.status === 'pending').length;
  const rejectedCount = registrations.filter((r) => r.status === 'rejected').length;
  const waitlistedCount = registrations.filter((r) => r.status === 'waitlisted').length;
  const statusCountsByCategory = getRegistrationCountsByCategory(registrations);
  const exactCoordinates = getTournamentCoordinates(tournament);
  const hasMapLocation = !!tournament.venue_map_url || !!exactCoordinates;
  const contactPhones = [
    tournament.contact_phone,
    tournament.contact_phone_2,
    tournament.contact_phone_3,
  ].filter(Boolean);

  const handleAddToCalendar = async () => {
    setCalendarLoading(true);
    try {
      await addCalendarEvent({
        title: tournament.title,
        location: getTournamentLocationLabel(tournament),
        notes: tournament.description ?? undefined,
        startDate: new Date(`${tournament.start_date}T09:00:00+05:30`),
        endDate: new Date(`${tournament.end_date}T18:00:00+05:30`),
      });
      showAlert({
        type: 'success',
        title: 'Added to Calendar',
        message: 'Tournament reminder has been added to your device calendar.',
      });
    } catch (err: any) {
      showAlert({
        type: 'danger',
        title: 'Calendar unavailable',
        message: err?.message ?? 'Unable to add this event to your calendar.',
      });
    } finally {
      setCalendarLoading(false);
    }
  };

  const handleOpenMap = async () => {
    if (!hasMapLocation) return;
    await openTournamentMap(tournament);
  };

  const handleOpenDetailedResult = () => {
    router.push({ pathname: '/(app)/tournament-result/[id]', params: { id: tournament.id } });
  };

  const handleRegistrationStatusChange = async (
    registrationId: string,
    status: 'approved' | 'rejected' | 'waitlisted'
  ) => {
    setUpdatingRegistrationId(registrationId);
    try {
      await updateRegistrationStatus(registrationId, status);
      await loadTournament();
      showAlert({
        type: 'success',
        title: 'Registration updated',
        message:
          status === 'approved'
            ? 'Player entry has been approved.'
            : status === 'waitlisted'
              ? 'Player entry has been moved to waitlist.'
              : 'Player entry has been rejected.',
      });
    } catch (err: any) {
      showAlert({
        type: 'danger',
        title: 'Could not update registration',
        message: err?.message ?? 'Please check your organizer permissions and try again.',
      });
    } finally {
      setUpdatingRegistrationId(null);
    }
  };

  const handleRemoveEntry = (registrationId: string) => {
    confirm({
      title: 'Remove entry?',
      message: 'This deletes the entry you added. Player registrations are declined, not removed.',
      confirmText: 'Remove',
      destructive: true,
      onConfirm: async () => {
        setUpdatingRegistrationId(registrationId);
        try {
          await removeTournamentEntry(registrationId);
          await loadTournament();
        } catch (err: any) {
          showAlert({
            type: 'danger',
            title: 'Could not remove entry',
            message: err?.message ?? 'Please try again.',
          });
        } finally {
          setUpdatingRegistrationId(null);
        }
      },
    });
  };

  const handleTournamentStatusChange = async (status: TournamentStatus) => {
    setStatusUpdating(true);
    try {
      await updateTournamentStatus(tournament.id, status);
      await loadTournament();
      showAlert({
        type: 'success',
        title: status === 'paused' ? 'Tournament paused' : 'Tournament updated',
        message:
          status === 'paused'
            ? 'New registrations are stopped for now.'
            : 'The tournament status has been updated.',
      });
    } catch (err: any) {
      showAlert({
        type: 'danger',
        title: 'Could not update tournament',
        message: err?.message ?? 'Please check admin permissions and try again.',
      });
    } finally {
      setStatusUpdating(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Nav bar */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <AppText variant="bodyLg" weight="semiBold" style={{ flex: 1 }} numberOfLines={1}>
          Tournament Details
        </AppText>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* ── Banner ── */}
        <View style={[styles.banner, { backgroundColor: accentColor }]}>
          {/* Badminton court decoration */}
          <View style={StyleSheet.absoluteFill}>
            <View style={styles.courtOuter} />
            <View style={styles.courtNet} />
            <View style={styles.courtCenter} />
            <View style={[styles.courtService, { left: '22%' }]} />
            <View style={[styles.courtService, { right: '22%' }]} />
          </View>

          {/* Shuttlecock watermark */}
          <View style={styles.shuttleWrap}>
            <View style={styles.shuttleCork} />
            <View style={styles.shuttleFeathers}>
              {([22, 28, 24] as number[]).map((h, i) => (
                <View key={i} style={[styles.feather, { height: h }]} />
              ))}
            </View>
          </View>

          {/* Top row: sport chip + status pill */}
          <View style={styles.bannerTopRow}>
            <View style={styles.bannerSportChip}>
              <Ionicons name="tennisball" size={11} color="rgba(255,255,255,0.9)" />
              <AppText variant="xs" weight="semiBold" color="rgba(255,255,255,0.9)">
                Badminton
              </AppText>
            </View>
            <View style={[styles.bannerStatusPill, { backgroundColor: statusCfg.bg }]}>
              {statusCfg.dot && <LiveDot color={statusCfg.color} />}
              <AppText variant="xs" weight="bold" color={statusCfg.color}>
                {statusCfg.label}
              </AppText>
            </View>
          </View>

          {/* Title + organizer */}
          <View style={styles.bannerContent}>
            <AppText
              variant="heading"
              weight="bold"
              color="#fff"
              numberOfLines={2}
              style={{ lineHeight: 30 }}
            >
              {tournament.title}
            </AppText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 }}>
              <Ionicons name="person-circle-outline" size={14} color="rgba(255,255,255,0.8)" />
              <AppText variant="caption" color="rgba(255,255,255,0.8)">
                by {tournament.organizer_name}
              </AppText>
            </View>
          </View>
        </View>

        {/* ── Quick stat strip ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.statsScroll}
          contentContainerStyle={styles.statsContent}
        >
          <StatChip
            icon="calendar-outline"
            label="Dates"
            value={dateRange}
            colors={colors}
            highlight
          />
          <StatChip icon="location-outline" label="City" value={tournament.city} colors={colors} />
          <StatChip
            icon="time-outline"
            label="Deadline"
            value={formatDate(tournament.registration_deadline)}
            colors={colors}
          />
          {tournament.max_courts ? (
            <StatChip
              icon="grid-outline"
              label="Courts"
              value={`${tournament.max_courts}`}
              colors={colors}
            />
          ) : null}
          {tournament.prize_pool ? (
            <StatChip
              icon="trophy-outline"
              label="Prize"
              value={tournament.prize_pool}
              colors={colors}
              highlight
            />
          ) : null}
          <StatChip
            icon="people-outline"
            label="Slots"
            value={`${filledSlots}/${totalSlots}`}
            colors={colors}
          />
        </ScrollView>

        {/* ── Draw (everyone, once it is published) ── */}
        {drawPublished ? (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View style={[styles.sectionAccentDot, { backgroundColor: accentColor }]} />
              <View style={{ flex: 1 }}>
                <AppText variant="title" weight="semiBold">
                  Draw
                </AppText>
                <AppText variant="xs" color={colors.textMuted}>
                  {matches.length} match{matches.length === 1 ? '' : 'es'} drawn ·{' '}
                  {pendingDrawMatches.length} still to play
                </AppText>
              </View>
            </View>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() =>
                router.push({ pathname: '/(app)/draw/[id]', params: { id: tournament.id } })
              }
              style={styles.manageResultsLink}
            >
              <Ionicons name="git-branch-outline" size={15} color={colors.primary} />
              <AppText variant="label" weight="semiBold" color={colors.primary} style={{ flex: 1 }}>
                See the bracket and who you play
              </AppText>
              <Ionicons name="chevron-forward" size={15} color={colors.primary} />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ── Results ── */}
        {results.length > 0 || effectiveStatus === 'completed' ? (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View style={[styles.sectionAccentDot, { backgroundColor: accentColor }]} />
              <View style={{ flex: 1 }}>
                <AppText variant="title" weight="semiBold">
                  Results
                </AppText>
                <AppText variant="xs" color={colors.textMuted}>
                  {results.length} completed match{results.length === 1 ? '' : 'es'}
                  {myResults.length > 0 ? ` · you played ${myResults.length}` : ''}
                </AppText>
              </View>
              {results.length > 0 ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleOpenDetailedResult}
                  style={[
                    styles.sectionLinkBtn,
                    { borderColor: accentColor + '50', backgroundColor: accentColor + '12' },
                  ]}
                >
                  <Ionicons name="stats-chart-outline" size={13} color={accentColor} />
                  <AppText variant="xs" weight="semiBold" color={accentColor}>
                    See all
                  </AppText>
                </TouchableOpacity>
              ) : null}
            </View>
            {results.length === 0 ? (
              <View style={styles.card}>
                <AppText variant="body" color={colors.textSecondary}>
                  This tournament has ended and no scorecard has been published yet.
                </AppText>
              </View>
            ) : (
              <View style={styles.resultList}>
                {/* Own matches first so a player sees their own scoreline immediately */}
                {[...myResults, ...results.filter((r) => !myResults.includes(r))]
                  .slice(0, 2)
                  .map((r) => (
                    <ResultCard
                      key={r.id}
                      result={r}
                      colors={colors}
                      isMine={myResults.includes(r)}
                      styles={styles}
                    />
                  ))}
              </View>
            )}
          </View>
        ) : null}

        {/* ── Result management (organizer + admin) ── */}
        {canManageResults ? (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View style={[styles.sectionAccentDot, { backgroundColor: '#DC2626' }]} />
              <View style={{ flex: 1 }}>
                <AppText variant="title" weight="semiBold">
                  {resultAccess.isAdmin ? 'Admin Tools' : 'Organizer Tools'}
                </AppText>
                <AppText variant="xs" color={colors.textMuted}>
                  {isClosed
                    ? 'Closed a week after the last match day — admin edits still allowed.'
                    : `Results editable for ${daysUntilClose} more day${daysUntilClose === 1 ? '' : 's'}.`}
                </AppText>
              </View>
            </View>
            <View style={styles.adminActions}>
              {resultAccess.isAdmin ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  disabled={statusUpdating}
                  onPress={() =>
                    handleTournamentStatusChange(tournament.status === 'paused' ? 'open' : 'paused')
                  }
                  style={[
                    styles.adminAction,
                    tournament.status !== 'paused' ? styles.pauseAction : styles.resumeAction,
                  ]}
                >
                  <Ionicons
                    name={tournament.status === 'paused' ? 'play-outline' : 'pause-outline'}
                    size={16}
                    color={tournament.status === 'paused' ? colors.primary : '#DC2626'}
                  />
                  <AppText
                    variant="label"
                    weight="semiBold"
                    color={tournament.status === 'paused' ? colors.primary : '#DC2626'}
                  >
                    {tournament.status === 'paused' ? 'Resume' : 'Pause'}
                  </AppText>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => openResultSheet(null)}
                style={[styles.adminAction, styles.finishAction]}
              >
                <Ionicons name="add-circle-outline" size={16} color="#fff" />
                <AppText variant="label" weight="semiBold" color="#fff">
                  Add Match Result
                </AppText>
              </TouchableOpacity>
            </View>

            {/*
              Fixtures the draw already paired up. Opening one seeds the result
              sheet with both sides and writes the score back to that same match,
              so the bracket advances instead of gaining a duplicate row.
            */}
            {pendingDrawMatches.length > 0 ? (
              <View style={styles.pendingMatchList}>
                <AppText variant="xs" weight="semiBold" color={colors.textMuted}>
                  WAITING ON A SCORE
                </AppText>
                {pendingDrawMatches.slice(0, 6).map((match) => (
                  <TouchableOpacity
                    key={match.id}
                    activeOpacity={0.85}
                    onPress={() => openResultSheet(match)}
                    style={styles.pendingMatchRow}
                  >
                    <View style={{ flex: 1 }}>
                      <AppText variant="label" weight="semiBold" numberOfLines={1}>
                        {match.player1_name} vs {match.player2_name}
                      </AppText>
                      <AppText variant="xs" color={colors.textMuted} numberOfLines={1}>
                        {categoryNameById.get(match.category_id) ?? 'Category'} ·{' '}
                        {roundLabel(match.round, depthOf(match.category_id))}
                      </AppText>
                    </View>
                    <Ionicons name="create-outline" size={16} color={colors.primary} />
                  </TouchableOpacity>
                ))}
                {pendingDrawMatches.length > 6 ? (
                  <AppText variant="xs" color={colors.textMuted}>
                    +{pendingDrawMatches.length - 6} more in the draw
                  </AppText>
                ) : null}
              </View>
            ) : null}
            {results.length > 0 ? (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleOpenDetailedResult}
                style={styles.manageResultsLink}
              >
                <Ionicons name="create-outline" size={15} color={colors.primary} />
                <AppText
                  variant="label"
                  weight="semiBold"
                  color={colors.primary}
                  style={{ flex: 1 }}
                >
                  Update an uploaded result
                </AppText>
                <Ionicons name="chevron-forward" size={15} color={colors.primary} />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {/* ── Venue ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionAccentDot, { backgroundColor: accentColor }]} />
            <AppText variant="title" weight="semiBold">
              Venue
            </AppText>
          </View>
          <TouchableOpacity
            activeOpacity={hasMapLocation ? 0.82 : 1}
            disabled={!hasMapLocation}
            onPress={handleOpenMap}
            style={styles.card}
          >
            <View style={styles.venueHeader}>
              <View style={{ flex: 1 }}>
                <AppText variant="bodyLg" weight="medium">
                  {tournament.venue}
                </AppText>
                {tournament.venue_address ? (
                  <AppText variant="body" color={colors.textSecondary} style={{ marginTop: 2 }}>
                    {tournament.venue_address}
                  </AppText>
                ) : null}
              </View>
              {hasMapLocation ? (
                <View style={[styles.mapBtn, { backgroundColor: accentColor + '18' }]}>
                  <Ionicons name="navigate-outline" size={18} color={accentColor} />
                </View>
              ) : null}
            </View>
            <View style={styles.venueMeta}>
              {tournament.max_courts ? (
                <View style={styles.inlineMeta}>
                  <Ionicons name="grid-outline" size={12} color={colors.textMuted} />
                  <AppText variant="caption" color={colors.textMuted}>
                    {tournament.max_courts} courts
                  </AppText>
                </View>
              ) : null}
              {exactCoordinates ? (
                <View style={styles.inlineMeta}>
                  <Ionicons name="pin-outline" size={12} color={colors.textMuted} />
                  <AppText variant="caption" color={colors.textMuted}>
                    Exact pin saved
                  </AppText>
                </View>
              ) : null}
              {hasMapLocation ? (
                <View style={styles.inlineMeta}>
                  <Ionicons name="map-outline" size={12} color={accentColor} />
                  <AppText variant="caption" weight="semiBold" color={accentColor}>
                    Open in Maps
                  </AppText>
                </View>
              ) : null}
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Categories ── */}
        {tournament.categories && tournament.categories.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View style={[styles.sectionAccentDot, { backgroundColor: accentColor }]} />
              <AppText variant="title" weight="semiBold" style={{ flex: 1 }}>
                Categories
              </AppText>
              <AppText variant="xs" color={colors.textMuted}>
                {filledSlots}/{totalSlots} slots filled
              </AppText>
            </View>
            <View style={styles.catList}>
              {tournament.categories.map((cat) => (
                <CategoryRow
                  key={cat.id}
                  cat={cat}
                  colors={colors}
                  counts={
                    canViewRegistrations
                      ? getCategoryStatusCounts(statusCountsByCategory, cat)
                      : undefined
                  }
                  styles={styles}
                />
              ))}
            </View>
          </View>
        ) : null}

        {/* ── Your entry ── */}
        {!canViewRegistrations && hasJoined ? (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View style={[styles.sectionAccentDot, { backgroundColor: accentColor }]} />
              <AppText variant="title" weight="semiBold" style={{ flex: 1 }}>
                Your Entry
              </AppText>
              {myEntryStatusCfg ? (
                <View
                  style={[
                    styles.enteredBadge,
                    { backgroundColor: myEntryStatusCfg.bg, borderColor: myEntryStatusCfg.color },
                  ]}
                >
                  <Ionicons
                    name={myEntryStatus === 'approved' ? 'checkmark-circle' : 'hourglass-outline'}
                    size={13}
                    color={myEntryStatusCfg.color}
                  />
                  <AppText variant="xs" weight="semiBold" color={myEntryStatusCfg.color}>
                    {myEntryStatus === 'approved' ? 'Joined' : myEntryStatusCfg.label}
                  </AppText>
                </View>
              ) : null}
            </View>
            <View style={styles.card}>
              <View style={styles.registrationsList}>
                {myRegistrations.map((r) => (
                  <RegistrationRow key={r.id} registration={r} colors={colors} styles={styles} />
                ))}
              </View>
              <View style={styles.editNotice}>
                <Ionicons name="information-circle-outline" size={15} color={colors.primary} />
                <AppText variant="caption" color={colors.textSecondary} style={{ flex: 1 }}>
                  Need to edit player, partner, phone, or notes? Please contact the organizer so
                  they can update your entry correctly.
                </AppText>
              </View>
            </View>
          </View>
        ) : null}

        {/* ── Joined players (organizer/admin view) ── */}
        {canViewRegistrations ? (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View style={[styles.sectionAccentDot, { backgroundColor: accentColor }]} />
              <View style={{ flex: 1 }}>
                <AppText variant="title" weight="semiBold">
                  Joined Players
                </AppText>
                <AppText variant="xs" color={colors.textMuted}>
                  {approvedCount} joined · {pendingCount} pending · {rejectedCount} rejected
                  {waitlistedCount > 0 ? ` · ${waitlistedCount} waitlisted` : ''}
                </AppText>
              </View>
            </View>
            {canManageResults ? (
              <View style={styles.rosterActions}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setAddEntryVisible(true)}
                  style={styles.rosterAction}
                >
                  <Ionicons name="person-add-outline" size={15} color={colors.primary} />
                  <AppText variant="caption" weight="semiBold" color={colors.primary}>
                    Add Entry
                  </AppText>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() =>
                    router.push({
                      pathname: '/(app)/draw/[id]',
                      params: { id: tournament.id },
                    })
                  }
                  style={styles.rosterAction}
                >
                  <Ionicons name="git-branch-outline" size={15} color={colors.primary} />
                  <AppText variant="caption" weight="semiBold" color={colors.primary}>
                    Manage Draw
                  </AppText>
                </TouchableOpacity>
              </View>
            ) : null}
            {pendingCount > 0 ? (
              <View style={styles.pendingNotice}>
                <Ionicons name="hourglass-outline" size={14} color="#D97706" />
                <AppText variant="caption" color={colors.textSecondary} style={{ flex: 1 }}>
                  {pendingCount} pending entr{pendingCount === 1 ? 'y' : 'ies'} needs organizer
                  approval.
                </AppText>
              </View>
            ) : null}
            <View style={styles.card}>
              {registrations.length === 0 ? (
                <AppText variant="body" color={colors.textSecondary}>
                  No players have joined yet.
                </AppText>
              ) : (
                (() => {
                  const grouped = groupRegistrationsByCategory(registrations);
                  const canChange =
                    effectiveStatus !== 'completed' && effectiveStatus !== 'cancelled'
                      ? handleRegistrationStatusChange
                      : undefined;
                  if (grouped.length <= 1) {
                    return (
                      <View style={styles.registrationsList}>
                        {registrations.map((r) => (
                          <RegistrationRow
                            key={r.id}
                            registration={r}
                            onRemove={canManageResults ? handleRemoveEntry : undefined}
                            onStatusChange={canChange}
                            statusLoading={updatingRegistrationId === r.id}
                            colors={colors}
                            styles={styles}
                          />
                        ))}
                      </View>
                    );
                  }
                  return (
                    <View>
                      {grouped.map((group, i) => (
                        <CategoryRegistrationSection
                          key={group.catId}
                          catName={group.catName}
                          items={group.items}
                          onRemove={canManageResults ? handleRemoveEntry : undefined}
                          onStatusChange={canChange}
                          updatingId={updatingRegistrationId}
                          colors={colors}
                          styles={styles}
                          isFirst={i === 0}
                        />
                      ))}
                    </View>
                  );
                })()
              )}
            </View>
          </View>
        ) : null}

        {/* ── About ── */}
        {tournament.description ? (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View style={[styles.sectionAccentDot, { backgroundColor: accentColor }]} />
              <AppText variant="title" weight="semiBold">
                About
              </AppText>
            </View>
            <View style={styles.card}>
              <AppText variant="body" color={colors.textSecondary} style={{ lineHeight: 22 }}>
                {tournament.description}
              </AppText>
            </View>
          </View>
        ) : null}

        {/* ── Rules ── */}
        {tournament.rules ? (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View style={[styles.sectionAccentDot, { backgroundColor: accentColor }]} />
              <AppText variant="title" weight="semiBold">
                Rules
              </AppText>
            </View>
            <View style={styles.card}>
              <AppText variant="body" color={colors.textSecondary} style={{ lineHeight: 22 }}>
                {tournament.rules}
              </AppText>
            </View>
          </View>
        ) : null}

        {/* ── Payment ── */}
        {tournament.payment_address ? (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View style={[styles.sectionAccentDot, { backgroundColor: accentColor }]} />
              <AppText variant="title" weight="semiBold">
                Payment
              </AppText>
            </View>
            <View style={styles.card}>
              <View style={styles.inlineMeta}>
                <Ionicons name="card-outline" size={15} color={accentColor} />
                <AppText variant="body" color={colors.textSecondary} style={{ flex: 1 }}>
                  {tournament.payment_address}
                </AppText>
              </View>
            </View>
          </View>
        ) : null}

        {/* ── Contact ── */}
        {contactPhones.length > 0 || tournament.contact_email ? (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View style={[styles.sectionAccentDot, { backgroundColor: accentColor }]} />
              <AppText variant="title" weight="semiBold">
                Contact
              </AppText>
            </View>
            <View style={styles.card}>
              {contactPhones.map((phone, i) => (
                <View key={phone} style={[styles.inlineMeta, i > 0 ? { marginTop: 10 } : null]}>
                  <Ionicons name="call-outline" size={15} color={accentColor} />
                  <AppText variant="body">{phone}</AppText>
                </View>
              ))}
              {tournament.contact_email ? (
                <View
                  style={[styles.inlineMeta, contactPhones.length > 0 ? { marginTop: 10 } : null]}
                >
                  <Ionicons name="mail-outline" size={15} color={accentColor} />
                  <AppText variant="body">{tournament.contact_email}</AppText>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom action bar */}
      <SafeAreaView
        edges={['bottom']}
        style={[styles.bottomBar, { backgroundColor: colors.background }]}
      >
        <AppButton
          title="Add to Calendar"
          variant="outline"
          onPress={handleAddToCalendar}
          loading={calendarLoading}
          style={styles.calendarButton}
          fullWidth={false}
        />
        <AppButton
          title={hasJoined ? 'Join Another Category' : 'Register'}
          onPress={() => setRegistrationVisible(true)}
          disabled={!canRegister}
          style={{ flex: 1 }}
          fullWidth={false}
        />
      </SafeAreaView>

      <RegistrationSheet
        tournament={tournament}
        visible={registrationVisible}
        onClose={() => setRegistrationVisible(false)}
        onRegistered={loadTournament}
        registeredCategoryIds={registeredCategoryIds}
      />
      {canManageResults ? (
        <>
          <ResultEntrySheet
            tournament={tournament}
            registrations={registrations}
            initialResult={resultMatch}
            visible={resultEntryVisible}
            onClose={() => {
              setResultEntryVisible(false);
              setResultMatch(null);
            }}
            onSaved={loadTournament}
          />
          <AddEntrySheet
            tournament={tournament}
            visible={addEntryVisible}
            onClose={() => setAddEntryVisible(false)}
            onAdded={loadTournament}
          />
        </>
      ) : null}
    </SafeAreaView>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // Nav
    navBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },

    scroll: { paddingBottom: 16 },
    loadingScroll: {
      paddingBottom: 32,
      paddingHorizontal: 16,
      paddingTop: 14,
    },

    // Banner
    banner: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 22,
      overflow: 'hidden',
    },
    courtOuter: {
      position: 'absolute',
      top: 10,
      left: 14,
      right: 14,
      bottom: 8,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.18)',
      borderRadius: 6,
    },
    courtNet: {
      position: 'absolute',
      top: '50%' as any,
      left: 14,
      right: 14,
      height: 1,
      backgroundColor: 'rgba(255,255,255,0.25)',
    },
    courtCenter: {
      position: 'absolute',
      top: 10,
      bottom: 8,
      left: '50%' as any,
      width: 1,
      backgroundColor: 'rgba(255,255,255,0.15)',
    },
    courtService: {
      position: 'absolute',
      top: 10,
      bottom: 8,
      width: 1,
      backgroundColor: 'rgba(255,255,255,0.12)',
    },
    shuttleWrap: {
      position: 'absolute',
      right: 14,
      bottom: 14,
      alignItems: 'center',
      opacity: 0.25,
      transform: [{ rotate: '-20deg' }],
    },
    shuttleCork: {
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: '#FDE68A',
    },
    shuttleFeathers: {
      flexDirection: 'row',
      gap: 3,
      marginTop: -2,
    },
    feather: {
      width: 9,
      borderRadius: 5,
      backgroundColor: 'rgba(255,255,255,0.9)',
    },
    bannerTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    bannerSportChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: 'rgba(0,0,0,0.18)',
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 20,
    },
    bannerStatusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
    },
    bannerContent: {
      paddingRight: 50,
    },

    // Quick stats
    statsScroll: { marginTop: 14 },
    statsContent: { paddingHorizontal: 16, gap: 10 },

    // Section
    section: { paddingHorizontal: 16, marginTop: 24 },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 12,
    },
    sectionAccentDot: {
      width: 4,
      height: 20,
      borderRadius: 2,
    },
    sectionLinkBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
    },

    // Generic card
    card: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },

    // Venue
    venueHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    venueMeta: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 12,
      marginTop: 10,
    },
    inlineMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    mapBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Categories
    catList: { gap: 10 },
    catRow: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    catAccentStrip: { width: 4, alignSelf: 'stretch' },
    catInner: { flex: 1, padding: 14, gap: 10 },
    catTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    catNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
    catAbbrChip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
    catFeeChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1 },
    catMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    skillBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    catPrizeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },

    // Result card (match rows layout)
    resultList: { gap: 12 },
    resultCard: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    resultCardMine: { borderColor: colors.primary, borderWidth: 1.5 },
    resultAccentStrip: { width: 4, alignSelf: 'stretch' },
    resultInner: { flex: 1, padding: 14, gap: 10 },
    resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    resultCatChip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
    resultMineChip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20, borderWidth: 1 },
    matchRows: {
      borderRadius: 10,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    matchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 8,
      backgroundColor: colors.background,
    },
    matchRowWon: {
      backgroundColor: '#FFFBEB',
    },
    matchRowLeft: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },
    matchScore: {
      fontSize: 20,
      fontWeight: '800',
      lineHeight: 24,
    },
    matchDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
    },
    resultFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },
    resultScorePill: {
      backgroundColor: colors.background,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    resultPrizePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: '#FFFBEB',
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderWidth: 1,
      borderColor: '#F59E0B40',
    },

    // Admin
    adminActions: { flexDirection: 'row', gap: 10 },
    adminAction: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      minHeight: 46,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    pauseAction: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
    resumeAction: { backgroundColor: colors.primaryLight, borderColor: colors.primary + '50' },
    finishAction: { backgroundColor: colors.primary, borderColor: colors.primary },
    manageResultsLink: {
      alignItems: 'center',
      backgroundColor: colors.primaryLight,
      borderColor: colors.primary + '50',
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 8,
      marginTop: 10,
      minHeight: 46,
      paddingHorizontal: 14,
    },
    pendingMatchList: {
      gap: 8,
      marginTop: 12,
    },
    pendingMatchRow: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 10,
      minHeight: 52,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },

    // Registrations
    rosterActions: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 10,
    },
    rosterAction: {
      alignItems: 'center',
      backgroundColor: colors.primaryLight,
      borderRadius: 999,
      flexDirection: 'row',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    registrationsList: { gap: 12 },
    registrationRow: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      gap: 8,
      paddingBottom: 12,
    },
    registrationTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    registrationCatDot: { width: 10, height: 10, borderRadius: 5 },
    registrationStatusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
    registrationMeta: { gap: 3, paddingLeft: 20 },
    registrationActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
    statusAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: 999,
      minHeight: 32,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    approveAction: { backgroundColor: '#16A34A' },
    waitlistAction: { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE', borderWidth: 1 },
    rejectAction: { backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderWidth: 1 },
    disabled: { opacity: 0.5 },

    enteredBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 999,
      borderWidth: 1,
    },
    editNotice: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      backgroundColor: colors.background,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      marginTop: 14,
    },
    pendingNotice: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      backgroundColor: '#FFFBEB',
      borderColor: '#FDE68A',
      borderRadius: 12,
      borderWidth: 1,
      padding: 12,
      marginBottom: 10,
    },

    // Category registration sections
    catRegSection: {
      paddingVertical: 2,
    },
    catRegSectionBorder: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      marginTop: 4,
      paddingTop: 4,
    },
    catRegHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 10,
    },
    catRegAbbrChip: {
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 6,
    },
    catRegCounts: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    catRegCountPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 20,
    },
    catRegBody: {
      gap: 12,
      paddingBottom: 8,
      paddingLeft: 2,
    },

    // Bottom bar
    bottomBar: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    calendarButton: { minWidth: 140 },
  });
}
