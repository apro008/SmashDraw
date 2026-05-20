import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '~/components/AppText';
import { AppButton } from '~/components/AppButton';
import { useTheme } from '~/hooks/useTheme';
import { Tournament, TournamentCategory, TournamentMatchResult, TournamentStatus } from '~/types';
import { addCalendarEvent } from '~/lib/calendar';
import { useAlert } from '~/providers/AlertProvider';
import {
  fetchTournamentById,
  fetchTournamentResults,
  fetchTournamentRegistrations,
  fetchUserTournamentRegistrations,
  TournamentRegistrationDetails,
  updateRegistrationStatus,
  updateTournamentStatus,
} from '~/lib/tournaments';
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

const STATUS_CONFIG: Record<TournamentStatus, { label: string; color: string; bg: string }> = {
  open: { label: 'Open', color: '#16A34A', bg: '#DCFCE7' },
  ongoing: { label: 'Live', color: '#D97706', bg: '#FEF3C7' },
  paused: { label: 'Paused', color: '#7C3AED', bg: '#EDE9FE' },
  completed: { label: 'Ended', color: '#6B7280', bg: '#F3F4F6' },
  draft: { label: 'Draft', color: '#6B7280', bg: '#F3F4F6' },
  cancelled: { label: 'Cancelled', color: '#DC2626', bg: '#FEE2E2' },
};

const REGISTRATION_STATUS_CONFIG = {
  pending: { label: 'Pending', color: '#D97706', bg: '#FEF3C7' },
  approved: { label: 'Approved', color: '#16A34A', bg: '#DCFCE7' },
  rejected: { label: 'Rejected', color: '#DC2626', bg: '#FEE2E2' },
  waitlisted: { label: 'Waitlisted', color: '#7C3AED', bg: '#EDE9FE' },
};

const GRADIENT_COLORS = ['#1A73E8', '#0D47A1', '#7C3AED', '#BE185D', '#065F46', '#B45309'];

function hashColor(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return GRADIENT_COLORS[Math.abs(hash) % GRADIENT_COLORS.length];
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

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
        style={{ height: 9, backgroundColor: softColor, borderRadius: 999, overflow: 'hidden' }}
      >
        <View
          style={{
            height: 9,
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
          {counts.waitlisted > 0 ? (
            <StatusMiniPill color="#7C3AED" label={`${counts.waitlisted} waitlisted`} />
          ) : null}
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
  return (
    <View style={styles.catRow}>
      <View style={styles.catTop}>
        <AppText variant="bodyLg" weight="semiBold">
          {cat.name}
        </AppText>
        <AppText variant="title" weight="bold" color={colors.primary}>
          ₹{cat.entry_fee}
        </AppText>
      </View>
      <View style={styles.catMeta}>
        <View style={[styles.skillBadge, { backgroundColor: colors.surface }]}>
          <AppText variant="xs" weight="medium" color={colors.textSecondary}>
            {cat.skill_level.charAt(0).toUpperCase() + cat.skill_level.slice(1)}
          </AppText>
        </View>
        {cat.prize && (
          <View style={styles.prizeBadge}>
            <Ionicons name="gift-outline" size={11} color={colors.textMuted} />
            <AppText variant="xs" color={colors.textMuted}>
              {' '}
              {cat.prize}
            </AppText>
          </View>
        )}
      </View>
      <SlotsBar
        categoryName={cat.name}
        counts={counts}
        current={cat.current_players}
        max={cat.max_players}
        colors={colors}
      />
    </View>
  );
}

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

function getRegistrationCountsByCategory(registrations: TournamentRegistrationDetails[]) {
  const counts = new Map<string, RegistrationStatusCounts>();
  registrations.forEach((registration) => {
    const current = counts.get(registration.category_id) ?? {
      approved: 0,
      pending: 0,
      rejected: 0,
      waitlisted: 0,
    };
    current[registration.status] += 1;
    counts.set(registration.category_id, current);
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

function RegistrationRow({
  registration,
  onStatusChange,
  statusLoading,
  colors,
  styles,
}: {
  registration: TournamentRegistrationDetails;
  onStatusChange?: (registrationId: string, status: 'approved' | 'rejected' | 'waitlisted') => void;
  statusLoading?: boolean;
  colors: any;
  styles: any;
}) {
  const details = parseRegistrationNotes(registration.notes);
  const playerName = details.playerName ?? registration.player?.name ?? 'Player';
  const phone = details.phone ?? registration.player?.phone;
  const email = details.email ?? registration.player?.email;
  const statusCfg = REGISTRATION_STATUS_CONFIG[registration.status];

  return (
    <View style={styles.registrationRow}>
      <View style={styles.registrationTop}>
        <View style={{ flex: 1 }}>
          <AppText variant="bodyLg" weight="semiBold">
            {playerName}
          </AppText>
          <AppText variant="caption" color={colors.textSecondary}>
            {registration.category?.name ?? 'Category'}
          </AppText>
        </View>
        <View style={[styles.registrationStatus, { backgroundColor: statusCfg.bg }]}>
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
      {onStatusChange ? (
        <View style={styles.registrationActions}>
          {registration.status !== 'approved' ? (
            <TouchableOpacity
              activeOpacity={0.8}
              disabled={statusLoading}
              onPress={() => onStatusChange(registration.id, 'approved')}
              style={[styles.statusAction, styles.approveAction, statusLoading && styles.disabled]}
            >
              <Ionicons name="checkmark" size={14} color="#fff" />
              <AppText variant="xs" weight="semiBold" color="#fff">
                Approve
              </AppText>
            </TouchableOpacity>
          ) : null}
          {registration.status !== 'waitlisted' ? (
            <TouchableOpacity
              activeOpacity={0.8}
              disabled={statusLoading}
              onPress={() => onStatusChange(registration.id, 'waitlisted')}
              style={[styles.statusAction, styles.waitlistAction, statusLoading && styles.disabled]}
            >
              <Ionicons name="time-outline" size={14} color="#7C3AED" />
              <AppText variant="xs" weight="semiBold" color="#7C3AED">
                Waitlist
              </AppText>
            </TouchableOpacity>
          ) : null}
          {registration.status !== 'rejected' ? (
            <TouchableOpacity
              activeOpacity={0.8}
              disabled={statusLoading}
              onPress={() => onStatusChange(registration.id, 'rejected')}
              style={[styles.statusAction, styles.rejectAction, statusLoading && styles.disabled]}
            >
              <Ionicons name="close" size={14} color="#DC2626" />
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

function ResultCard({
  colors,
  result,
  styles,
}: {
  colors: any;
  result: TournamentMatchResult;
  styles: any;
}) {
  const player1Score = result.player1_score ?? 0;
  const player2Score = result.player2_score ?? 0;
  const maxScore = Math.max(player1Score, player2Score, 1);
  const player1Won = result.winner_name === result.player1_name;
  const player2Won = result.winner_name === result.player2_name;

  return (
    <View style={styles.resultCard}>
      <View style={styles.resultHeader}>
        <View style={{ flex: 1 }}>
          <AppText variant="bodyLg" weight="semiBold">
            {result.category?.name ?? 'Match Result'}
          </AppText>
          <AppText variant="caption" color={colors.textMuted}>
            Match #{result.match_number}
            {result.completed_at ? ` • ${formatDate(result.completed_at)}` : ''}
          </AppText>
        </View>
        <View style={styles.winnerBadge}>
          <Ionicons name="trophy-outline" size={13} color="#B45309" />
          <AppText variant="xs" weight="semiBold" color="#B45309">
            Winner
          </AppText>
        </View>
      </View>

      <View style={styles.scoreGrid}>
        <ScoreLine
          colors={colors}
          name={result.player1_name ?? 'Side A'}
          score={player1Score}
          maxScore={maxScore}
          styles={styles}
          won={player1Won}
        />
        <ScoreLine
          colors={colors}
          name={result.player2_name ?? 'Side B'}
          score={player2Score}
          maxScore={maxScore}
          styles={styles}
          won={player2Won}
        />
      </View>

      <View style={styles.resultMetaGrid}>
        <View style={styles.resultMetaTile}>
          <AppText variant="xs" color={colors.textMuted}>
            Final score
          </AppText>
          <AppText variant="body" weight="semiBold">
            {result.score ?? `${player1Score}-${player2Score}`}
          </AppText>
        </View>
        {result.prize_money_received ? (
          <View style={styles.resultMetaTile}>
            <AppText variant="xs" color={colors.textMuted}>
              Prize received
            </AppText>
            <AppText variant="body" weight="semiBold" color={colors.primary}>
              ₹{result.prize_money_received}
            </AppText>
          </View>
        ) : null}
      </View>

      {result.result_notes ? (
        <AppText variant="caption" color={colors.textSecondary} style={{ marginTop: 10 }}>
          {result.result_notes}
        </AppText>
      ) : null}
    </View>
  );
}

function ScoreLine({
  colors,
  maxScore,
  name,
  score,
  styles,
  won,
}: {
  colors: any;
  maxScore: number;
  name: string;
  score: number;
  styles: any;
  won: boolean;
}) {
  const width = `${Math.max((score / maxScore) * 100, 5)}%` as any;
  return (
    <View style={styles.scoreLine}>
      <View style={styles.scoreLineTop}>
        <AppText variant="caption" weight={won ? 'semiBold' : 'regular'} style={{ flex: 1 }}>
          {name}
        </AppText>
        <AppText variant="title" weight="bold" color={won ? colors.primary : colors.textSecondary}>
          {score}
        </AppText>
      </View>
      <View style={styles.scoreTrack}>
        <View
          style={[
            styles.scoreFill,
            { width, backgroundColor: won ? colors.primary : colors.textMuted },
          ]}
        />
      </View>
    </View>
  );
}

export default function TournamentDetailScreen() {
  const { finishMatch, id } = useLocalSearchParams<{ finishMatch?: string; id: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { showAlert } = useAlert();
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [registrationVisible, setRegistrationVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [registrations, setRegistrations] = useState<TournamentRegistrationDetails[]>([]);
  const [myRegistrations, setMyRegistrations] = useState<TournamentRegistrationDetails[]>([]);
  const [results, setResults] = useState<TournamentMatchResult[]>([]);
  const [updatingRegistrationId, setUpdatingRegistrationId] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [resultEntryVisible, setResultEntryVisible] = useState(false);
  const [handledFinishParam, setHandledFinishParam] = useState(false);

  const loadTournament = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const nextTournament = await fetchTournamentById(id);
      setTournament(nextTournament);
      setResults(nextTournament ? await fetchTournamentResults(id) : []);
      const canViewRegistrations =
        !!nextTournament && (nextTournament.organizer_id === user?.id || profile?.role === 'admin');
      setRegistrations(canViewRegistrations ? await fetchTournamentRegistrations(id) : []);
      const shouldLoadMyEntries =
        !!nextTournament && !!user?.id && nextTournament.organizer_id !== user.id;
      setMyRegistrations(
        shouldLoadMyEntries ? await fetchUserTournamentRegistrations(id, user.id) : []
      );
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
    if (handledFinishParam || finishMatch !== '1' || profile?.role !== 'admin' || !tournament) {
      return;
    }
    setResultEntryVisible(true);
    setHandledFinishParam(true);
  }, [finishMatch, handledFinishParam, profile?.role, tournament]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.notFound}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!tournament) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.notFound}>
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

  const statusCfg = STATUS_CONFIG[tournament.status];
  const accentColor = hashColor(tournament.id);
  const dateRange =
    tournament.start_date === tournament.end_date
      ? formatDate(tournament.start_date)
      : `${formatDate(tournament.start_date)} – ${formatDate(tournament.end_date)}`;
  const totalSlots = tournament.categories?.reduce((s, c) => s + c.max_players, 0) ?? 0;
  const filledSlots = tournament.categories?.reduce((s, c) => s + c.current_players, 0) ?? 0;
  const registeredCategoryIds = myRegistrations
    .map((registration) => registration.category_id)
    .filter(Boolean);
  const openCategoryCount = tournament.categories?.length ?? 0;
  const hasJoined = myRegistrations.length > 0;
  const myEntryStatus = myRegistrations[0]?.status ?? null;
  const myEntryStatusCfg = myEntryStatus ? REGISTRATION_STATUS_CONFIG[myEntryStatus] : null;
  const canJoinAnotherCategory = registeredCategoryIds.length < openCategoryCount;
  const canRegister =
    profile?.role === 'player' &&
    tournament.status === 'open' &&
    tournament.organizer_id !== user?.id &&
    openCategoryCount > 0 &&
    canJoinAnotherCategory;
  const canViewRegistrations = tournament.organizer_id === user?.id || profile?.role === 'admin';
  const canManageResults = profile?.role === 'admin';
  const approvedRegistrationCount = registrations.filter(
    (registration) => registration.status === 'approved'
  ).length;
  const pendingRegistrationCount = registrations.filter(
    (registration) => registration.status === 'pending'
  ).length;
  const rejectedRegistrationCount = registrations.filter(
    (registration) => registration.status === 'rejected'
  ).length;
  const waitlistedRegistrationCount = registrations.filter(
    (registration) => registration.status === 'waitlisted'
  ).length;
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
      const startDate = new Date(`${tournament.start_date}T09:00:00+05:30`);
      const endDate = new Date(`${tournament.end_date}T18:00:00+05:30`);
      await addCalendarEvent({
        title: tournament.title,
        location: getTournamentLocationLabel(tournament),
        notes: tournament.description ?? undefined,
        startDate,
        endDate,
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
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <AppText variant="bodyLg" weight="semiBold" style={{ flex: 1 }} numberOfLines={1}>
          Tournament Details
        </AppText>
        <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
          <AppText variant="xs" weight="semiBold" color={statusCfg.color}>
            {statusCfg.label}
          </AppText>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Banner */}
        <View style={[styles.banner, { backgroundColor: accentColor }]}>
          <Ionicons
            name="trophy"
            size={56}
            color="rgba(255,255,255,0.15)"
            style={styles.bannerIcon}
          />
          <View style={styles.bannerContent}>
            <AppText variant="heading" weight="bold" color="#fff" style={{ lineHeight: 28 }}>
              {tournament.title}
            </AppText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 }}>
              <Ionicons name="person-outline" size={13} color="rgba(255,255,255,0.75)" />
              <AppText variant="caption" color="rgba(255,255,255,0.75)">
                {tournament.organizer_name}
              </AppText>
            </View>
          </View>
        </View>

        {/* Key info tiles */}
        <View style={styles.infoGrid}>
          <View style={[styles.infoTile, { flex: 1 }]}>
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            <AppText variant="xs" color={colors.textMuted} style={{ marginTop: 4 }}>
              Date
            </AppText>
            <AppText variant="label" weight="semiBold">
              {dateRange}
            </AppText>
          </View>
          <View style={[styles.infoTile, { flex: 1 }]}>
            <Ionicons name="location-outline" size={18} color={colors.primary} />
            <AppText variant="xs" color={colors.textMuted} style={{ marginTop: 4 }}>
              City
            </AppText>
            <AppText variant="label" weight="semiBold">
              {tournament.city}
            </AppText>
          </View>
        </View>
        <View style={styles.infoGrid}>
          <View style={[styles.infoTile, { flex: 1 }]}>
            <Ionicons name="time-outline" size={18} color={colors.primary} />
            <AppText variant="xs" color={colors.textMuted} style={{ marginTop: 4 }}>
              Reg. Deadline
            </AppText>
            <AppText variant="label" weight="semiBold">
              {formatDate(tournament.registration_deadline)}
            </AppText>
          </View>
          {tournament.prize_pool && (
            <View style={[styles.infoTile, { flex: 1 }]}>
              <Ionicons name="gift-outline" size={18} color={colors.primary} />
              <AppText variant="xs" color={colors.textMuted} style={{ marginTop: 4 }}>
                Prize Pool
              </AppText>
              <AppText variant="label" weight="semiBold">
                {tournament.prize_pool}
              </AppText>
            </View>
          )}
        </View>

        {canManageResults ? (
          <View style={styles.section}>
            <AppText variant="title" weight="semiBold" style={styles.sectionTitle}>
              Admin Tools
            </AppText>
            <View style={styles.adminActions}>
              <TouchableOpacity
                activeOpacity={0.85}
                disabled={statusUpdating}
                onPress={() =>
                  handleTournamentStatusChange(tournament.status === 'paused' ? 'open' : 'paused')
                }
                style={[styles.adminAction, tournament.status !== 'paused' && styles.pauseAction]}
              >
                <Ionicons
                  name={tournament.status === 'paused' ? 'play-outline' : 'pause-outline'}
                  size={17}
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
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setResultEntryVisible(true)}
                style={[styles.adminAction, styles.finishAction]}
              >
                <Ionicons name="flag-outline" size={17} color="#fff" />
                <AppText variant="label" weight="semiBold" color="#fff">
                  Finish Match
                </AppText>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* Venue */}
        <View style={styles.section}>
          <AppText variant="title" weight="semiBold" style={styles.sectionTitle}>
            Venue
          </AppText>
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
                {tournament.venue_address && (
                  <AppText variant="body" color={colors.textSecondary} style={{ marginTop: 2 }}>
                    {tournament.venue_address}
                  </AppText>
                )}
              </View>
              {hasMapLocation ? (
                <View style={styles.mapButton}>
                  <Ionicons name="navigate-outline" size={18} color={colors.primary} />
                </View>
              ) : null}
            </View>
            <View style={styles.venueMeta}>
              {tournament.max_courts ? (
                <View style={styles.inlineMeta}>
                  <Ionicons name="grid-outline" size={13} color={colors.textMuted} />
                  <AppText variant="caption" color={colors.textMuted}>
                    {tournament.max_courts} courts
                  </AppText>
                </View>
              ) : null}
              {exactCoordinates ? (
                <View style={styles.inlineMeta}>
                  <Ionicons name="pin-outline" size={13} color={colors.textMuted} />
                  <AppText variant="caption" color={colors.textMuted}>
                    Exact pin saved
                  </AppText>
                </View>
              ) : null}
              {hasMapLocation ? (
                <View style={styles.inlineMeta}>
                  <Ionicons name="map-outline" size={13} color={colors.primary} />
                  <AppText variant="caption" weight="semiBold" color={colors.primary}>
                    Open in Maps
                  </AppText>
                </View>
              ) : null}
            </View>
          </TouchableOpacity>
        </View>

        {/* Categories */}
        {tournament.categories && tournament.categories.length > 0 && (
          <View style={styles.section}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <AppText variant="title" weight="semiBold" style={styles.sectionTitle}>
                Categories
              </AppText>
              <AppText variant="caption" color={colors.textMuted}>
                {filledSlots}/{totalSlots} approved slots filled
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
        )}

        {/* Results */}
        {results.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.registrationsHeader}>
              <AppText variant="title" weight="semiBold" style={styles.sectionTitle}>
                Results
              </AppText>
              <View style={styles.resultCountBadge}>
                <Ionicons name="stats-chart-outline" size={13} color={colors.primary} />
                <AppText variant="xs" weight="semiBold" color={colors.primary}>
                  {results.length} match{results.length === 1 ? '' : 'es'}
                </AppText>
              </View>
            </View>
            <View style={styles.resultList}>
              {results.map((result) => (
                <ResultCard key={result.id} result={result} colors={colors} styles={styles} />
              ))}
            </View>
          </View>
        ) : null}

        {!canViewRegistrations && hasJoined ? (
          <View style={styles.section}>
            <View style={styles.registrationsHeader}>
              <AppText variant="title" weight="semiBold" style={styles.sectionTitle}>
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
                    size={14}
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
                {myRegistrations.map((registration) => (
                  <RegistrationRow
                    key={registration.id}
                    registration={registration}
                    colors={colors}
                    styles={styles}
                  />
                ))}
              </View>
              <View style={styles.editNotice}>
                <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
                <AppText variant="caption" color={colors.textSecondary} style={{ flex: 1 }}>
                  Need to edit player, partner, phone, or notes? Please contact the organizer so
                  they can update your entry correctly.
                </AppText>
              </View>
            </View>
          </View>
        ) : null}

        {canViewRegistrations ? (
          <View style={styles.section}>
            <View style={styles.registrationsTitleBlock}>
              <AppText variant="title" weight="semiBold" style={styles.sectionTitle}>
                Joined Players
              </AppText>
              <AppText variant="caption" color={colors.textMuted}>
                {approvedRegistrationCount} joined / {pendingRegistrationCount} pending /{' '}
                {rejectedRegistrationCount} rejected
                {waitlistedRegistrationCount > 0
                  ? ` / ${waitlistedRegistrationCount} waitlisted`
                  : ''}
              </AppText>
            </View>
            {pendingRegistrationCount > 0 ? (
              <View style={styles.pendingNotice}>
                <Ionicons name="hourglass-outline" size={15} color="#D97706" />
                <AppText variant="caption" color={colors.textSecondary} style={{ flex: 1 }}>
                  {pendingRegistrationCount} pending entry
                  {pendingRegistrationCount === 1 ? '' : 'ies'} needs organizer approval.
                </AppText>
              </View>
            ) : null}
            <View style={styles.card}>
              {registrations.length === 0 ? (
                <AppText variant="body" color={colors.textSecondary}>
                  No players have joined yet.
                </AppText>
              ) : (
                <View style={styles.registrationsList}>
                  {registrations.map((registration) => (
                    <RegistrationRow
                      key={registration.id}
                      registration={registration}
                      onStatusChange={handleRegistrationStatusChange}
                      statusLoading={updatingRegistrationId === registration.id}
                      colors={colors}
                      styles={styles}
                    />
                  ))}
                </View>
              )}
            </View>
          </View>
        ) : null}

        {/* Description */}
        {tournament.description && (
          <View style={styles.section}>
            <AppText variant="title" weight="semiBold" style={styles.sectionTitle}>
              About
            </AppText>
            <View style={styles.card}>
              <AppText variant="body" color={colors.textSecondary} style={{ lineHeight: 22 }}>
                {tournament.description}
              </AppText>
            </View>
          </View>
        )}

        {/* Rules */}
        {tournament.rules && (
          <View style={styles.section}>
            <AppText variant="title" weight="semiBold" style={styles.sectionTitle}>
              Rules
            </AppText>
            <View style={styles.card}>
              <AppText variant="body" color={colors.textSecondary} style={{ lineHeight: 22 }}>
                {tournament.rules}
              </AppText>
            </View>
          </View>
        )}

        {/* Payment */}
        {tournament.payment_address && (
          <View style={styles.section}>
            <AppText variant="title" weight="semiBold" style={styles.sectionTitle}>
              Payment
            </AppText>
            <View style={styles.card}>
              <View style={styles.paymentRow}>
                <Ionicons name="card-outline" size={16} color={colors.primary} />
                <AppText variant="body" color={colors.textSecondary} style={{ flex: 1 }}>
                  {tournament.payment_address}
                </AppText>
              </View>
            </View>
          </View>
        )}

        {/* Contact */}
        {(contactPhones.length > 0 || tournament.contact_email) && (
          <View style={styles.section}>
            <AppText variant="title" weight="semiBold" style={styles.sectionTitle}>
              Contact
            </AppText>
            <View style={styles.card}>
              {contactPhones.map((phone, index) => (
                <View key={phone} style={[styles.contactRow, index > 0 ? { marginTop: 10 } : null]}>
                  <Ionicons name="call-outline" size={16} color={colors.primary} />
                  <AppText variant="body">{phone}</AppText>
                </View>
              ))}
              {tournament.contact_email && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    marginTop: contactPhones.length > 0 ? 10 : 0,
                  }}
                >
                  <Ionicons name="mail-outline" size={16} color={colors.primary} />
                  <AppText variant="body">{tournament.contact_email}</AppText>
                </View>
              )}
            </View>
          </View>
        )}

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
          title={hasJoined ? 'Join Another Category' : 'Register for this Tournament'}
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
      <ResultEntrySheet
        tournament={tournament}
        registrations={registrations}
        visible={resultEntryVisible}
        onClose={() => setResultEntryVisible(false)}
        onSaved={loadTournament}
      />
    </SafeAreaView>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    notFound: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    navBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
    },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    scroll: {
      paddingBottom: 16,
    },
    banner: {
      paddingHorizontal: 20,
      paddingVertical: 24,
      position: 'relative',
      overflow: 'hidden',
    },
    bannerIcon: {
      position: 'absolute',
      right: 16,
      top: 12,
    },
    bannerContent: {
      paddingRight: 60,
    },
    infoGrid: {
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 16,
      marginTop: 12,
    },
    infoTile: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    section: {
      paddingHorizontal: 16,
      marginTop: 24,
    },
    sectionTitle: {
      marginBottom: 10,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    adminActions: {
      flexDirection: 'row',
      gap: 10,
    },
    adminAction: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      flex: 1,
      flexDirection: 'row',
      gap: 7,
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: 10,
    },
    pauseAction: {
      backgroundColor: '#FEF2F2',
      borderColor: '#FECACA',
    },
    finishAction: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    venueHeader: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 12,
    },
    venueMeta: {
      alignItems: 'center',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginTop: 10,
    },
    inlineMeta: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 5,
    },
    mapButton: {
      alignItems: 'center',
      backgroundColor: colors.primaryLight,
      borderRadius: 999,
      height: 36,
      justifyContent: 'center',
      width: 36,
    },
    catList: {
      gap: 10,
    },
    catRow: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 10,
    },
    catTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    catMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    skillBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    prizeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    registrationsHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    registrationsTitleBlock: {
      marginBottom: 10,
    },
    registrationsList: {
      gap: 12,
    },
    registrationRow: {
      borderBottomColor: colors.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
      gap: 8,
      paddingBottom: 12,
    },
    registrationTop: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
    },
    registrationStatus: {
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    registrationActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 2,
    },
    statusAction: {
      alignItems: 'center',
      borderRadius: 999,
      flexDirection: 'row',
      gap: 4,
      minHeight: 32,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    approveAction: {
      backgroundColor: '#16A34A',
    },
    waitlistAction: {
      backgroundColor: '#F5F3FF',
      borderColor: '#DDD6FE',
      borderWidth: 1,
    },
    rejectAction: {
      backgroundColor: '#FEF2F2',
      borderColor: '#FECACA',
      borderWidth: 1,
    },
    disabled: {
      opacity: 0.5,
    },
    enteredBadge: {
      alignItems: 'center',
      backgroundColor: colors.primaryLight,
      borderColor: colors.primary,
      borderRadius: 999,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 4,
      paddingHorizontal: 9,
      paddingVertical: 4,
    },
    registrationMeta: {
      gap: 3,
    },
    editNotice: {
      alignItems: 'flex-start',
      backgroundColor: colors.background,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 8,
      marginTop: 14,
      padding: 12,
    },
    pendingNotice: {
      alignItems: 'flex-start',
      backgroundColor: '#FFFBEB',
      borderColor: '#FDE68A',
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 8,
      marginBottom: 10,
      padding: 12,
    },
    resultCountBadge: {
      alignItems: 'center',
      backgroundColor: colors.primaryLight,
      borderColor: colors.primary,
      borderRadius: 999,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 5,
      paddingHorizontal: 9,
      paddingVertical: 4,
    },
    resultList: {
      gap: 12,
    },
    resultCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      padding: 14,
    },
    resultHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
    },
    winnerBadge: {
      alignItems: 'center',
      backgroundColor: '#FEF3C7',
      borderColor: '#FDE68A',
      borderRadius: 999,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    scoreGrid: {
      gap: 12,
      marginTop: 14,
    },
    scoreLine: {
      gap: 6,
    },
    scoreLineTop: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
    },
    scoreTrack: {
      backgroundColor: colors.background,
      borderRadius: 999,
      height: 10,
      overflow: 'hidden',
    },
    scoreFill: {
      borderRadius: 999,
      height: 10,
    },
    resultMetaGrid: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 14,
    },
    resultMetaTile: {
      backgroundColor: colors.background,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      flex: 1,
      padding: 10,
    },
    paymentRow: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 10,
    },
    contactRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
    },
    bottomBar: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    calendarButton: {
      minWidth: 150,
    },
  });
}
