import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '~/components/AppButton';
import { AppText } from '~/components/AppText';
import { SkeletonLoader } from '~/components/common/SkeletonLoader';
import { ContestantPicker, ManualContestantInput } from '~/components/tournament/ContestantPicker';
import { isDoublesCategory } from '~/constants/TournamentCategories';
import { useTheme } from '~/hooks/useTheme';
import { buildContestants, createGuestContestant, type Contestant } from '~/lib/contestants';
import {
  createEmptyGames,
  hasPartialGame as hasIncompleteGame,
  summarizeScore,
  type GameScore,
} from '~/lib/matchScore';
import {
  fetchTournamentById,
  fetchTournamentRegistrations,
  getResultAccess,
  saveTournamentResult,
  TournamentRegistrationDetails,
  updateTournamentStatus,
} from '~/lib/tournaments';
import { useAlert } from '~/providers/AlertProvider';
import { useAuthStore } from '~/store/useAuthStore';
import { Tournament, TournamentCategory } from '~/types';

export default function FinishTournamentResultScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const tournamentId = Array.isArray(id) ? id[0] : id;
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const { showAlert } = useAlert();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [registrations, setRegistrations] = useState<TournamentRegistrationDetails[]>([]);
  const [category, setCategory] = useState<TournamentCategory | null>(null);
  const [guests, setGuests] = useState<Contestant[]>([]);
  const [player1Id, setPlayer1Id] = useState('');
  const [player2Id, setPlayer2Id] = useState('');
  const [games, setGames] = useState<GameScore[]>(createEmptyGames);
  const [prizeMoney, setPrizeMoney] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!tournamentId) return;
    setLoading(true);
    try {
      const nextTournament = await fetchTournamentById(tournamentId);
      if (!nextTournament) throw new Error('Tournament not found.');
      const nextRegistrations = await fetchTournamentRegistrations(tournamentId);
      const nextCategory = nextTournament.categories?.[0] ?? null;
      setTournament(nextTournament);
      setRegistrations(nextRegistrations);
      setCategory(nextCategory);
      const nextContestants = buildContestants(nextRegistrations, nextCategory?.id ?? null);
      setPlayer1Id(nextContestants[0]?.id ?? '');
      setPlayer2Id(nextContestants[1]?.id ?? '');
    } catch (err: any) {
      showAlert({
        type: 'danger',
        title: 'Unable to open result screen',
        message: err?.message ?? 'Please try again.',
      });
    } finally {
      setLoading(false);
    }
  }, [showAlert, tournamentId]);

  useEffect(() => {
    load();
  }, [load]);

  const resultAccess = getResultAccess(tournament, user?.id, profile?.role);
  const canFinish = resultAccess.canManage;
  const categories = tournament?.categories ?? [];
  const registeredContestants = useMemo(
    () => buildContestants(registrations, category?.id ?? null),
    [category?.id, registrations]
  );
  const contestants = useMemo(
    () => [
      ...registeredContestants,
      ...guests.filter((guest) => !category?.id || guest.categoryId === category.id),
    ],
    [category?.id, guests, registeredContestants]
  );

  const handleSelectCategory = (next: TournamentCategory) => {
    if (next.id === category?.id) return;
    setCategory(next);
    const nextContestants = buildContestants(registrations, next.id);
    setPlayer1Id(nextContestants[0]?.id ?? '');
    setPlayer2Id(nextContestants[1]?.id ?? '');
  };

  const handleAddGuest = (name: string) => {
    const guest = createGuestContestant(name, category?.id ?? null);
    setGuests((current) => [...current, guest]);
    // Drop the new name straight into whichever side is still empty.
    if (!player1Id) setPlayer1Id(guest.id);
    else if (!player2Id) setPlayer2Id(guest.id);
  };

  const handleRemoveGuest = (guestId: string) => {
    setGuests((current) => current.filter((guest) => guest.id !== guestId));
    if (player1Id === guestId) setPlayer1Id('');
    if (player2Id === guestId) setPlayer2Id('');
  };

  const player1 = contestants.find((item) => item.id === player1Id) ?? null;
  const player2 = contestants.find((item) => item.id === player2Id) ?? null;
  const scoreSummary = useMemo(() => summarizeScore(games), [games]);
  const winner =
    scoreSummary?.winnerSide === 1 ? player1 : scoreSummary?.winnerSide === 2 ? player2 : null;
  const prize = prizeMoney.trim() ? Number(prizeMoney) : null;
  const hasPartialGame = hasIncompleteGame(games);
  const canSave =
    !!user?.id &&
    !!tournament &&
    canFinish &&
    !!category &&
    !!player1 &&
    !!player2 &&
    player1.id !== player2.id &&
    !!scoreSummary &&
    !hasPartialGame &&
    (!prizeMoney.trim() || (prize !== null && Number.isFinite(prize) && prize >= 0));

  const updateGameScore = (index: number, side: keyof GameScore, value: string) => {
    const nextValue = value.replace(/[^\d]/g, '').slice(0, 2);
    setGames((current) =>
      current.map((game, gameIndex) =>
        gameIndex === index ? { ...game, [side]: nextValue } : game
      )
    );
  };

  const handleSubmit = async () => {
    if (
      !canSave ||
      !user?.id ||
      !tournament ||
      !category ||
      !player1 ||
      !player2 ||
      !winner ||
      !scoreSummary
    ) {
      return;
    }

    setSaving(true);
    try {
      await saveTournamentResult({
        tournamentId: tournament.id,
        categoryId: category.id,
        player1Id: player1.userId,
        player2Id: player2.userId,
        player1Name: player1.name,
        player2Name: player2.name,
        winnerId: winner.userId,
        winnerName: winner.name,
        player1Score: scoreSummary.player1Games,
        player2Score: scoreSummary.player2Games,
        scoreText: scoreSummary.scoreText,
        prizeMoneyReceived: prize,
        notes: notes.trim() || null,
        uploadedBy: user.id,
      });
      await updateTournamentStatus(tournament.id, 'completed');
      showAlert({
        type: 'success',
        title: 'Tournament finished',
        message: 'The result is uploaded and players can view the scorecard.',
      });
      router.replace({ pathname: '/(app)/tournament/[id]', params: { id: tournament.id } });
    } catch (err: any) {
      showAlert({
        type: 'danger',
        title: 'Could not finish tournament',
        message: err?.message ?? 'Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <AppText variant="title" weight="bold">
            Finish Tournament
          </AppText>
          <View style={styles.iconButton} />
        </View>
        <View style={styles.loadingScroll}>
          <SkeletonLoader variant="detail" count={3} />
        </View>
      </SafeAreaView>
    );
  }

  if (!tournament || !canFinish) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <AppText variant="title" weight="bold">
            Finish Tournament
          </AppText>
          <View style={styles.iconButton} />
        </View>
        <View style={styles.empty}>
          <Ionicons name="lock-closed-outline" size={46} color={colors.textMuted} />
          <AppText variant="title" weight="semiBold" center>
            {resultAccess.lockedByCloseWindow ? 'Tournament closed' : 'Organizer access only'}
          </AppText>
          <AppText variant="body" color={colors.textSecondary} center>
            {resultAccess.lockedByCloseWindow
              ? 'This tournament closed a week after its last match day. Ask an admin to add or correct a result now.'
              : 'Only the organizer who created this tournament, or an admin, can finish it and upload results.'}
          </AppText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <AppText variant="title" weight="bold" numberOfLines={1}>
            Finish Tournament
          </AppText>
          <AppText variant="caption" color={colors.textSecondary} numberOfLines={1}>
            {tournament.title}
          </AppText>
        </View>
        <View style={styles.iconButton} />
      </View>

      <KeyboardAwareScrollView
        bottomOffset={18}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.scoreHero}>
          <View style={styles.heroTop}>
            <View>
              <AppText variant="label" weight="semiBold" color="rgba(255,255,255,0.72)">
                FINAL SCORECARD
              </AppText>
              <AppText variant="heading" weight="bold" color="#fff" style={styles.heroTitle}>
                {winner?.name ?? 'Winner pending'}
              </AppText>
            </View>
            <View style={styles.heroBadge}>
              <Ionicons name="trophy-outline" size={17} color="#FDE68A" />
              <AppText variant="caption" weight="semiBold" color="#fff">
                Result
              </AppText>
            </View>
          </View>
          <View style={styles.heroScoreRow}>
            <ScorePill
              colors={colors}
              label="Games"
              value={
                scoreSummary ? `${scoreSummary.player1Games}-${scoreSummary.player2Games}` : '--'
              }
            />
            <ScorePill
              colors={colors}
              label="Points"
              value={
                scoreSummary ? `${scoreSummary.player1Points}-${scoreSummary.player2Points}` : '--'
              }
            />
            <ScorePill
              colors={colors}
              label="Sets"
              value={scoreSummary ? String(scoreSummary.completedGames) : '0'}
            />
          </View>
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
          <AppText variant="caption" color={colors.textSecondary} style={{ flex: 1 }}>
            Badminton matches are usually best of 3 games. Each game goes to 21 points, with a
            2-point lead after 20-all and a 30-point cap at 29-all.
          </AppText>
        </View>

        <SectionTitle title="Category" />
        <View style={styles.chipGrid}>
          {categories.map((item) => {
            const selected = category?.id === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => handleSelectCategory(item)}
                style={[styles.chip, selected ? styles.chipActive : null]}
              >
                <AppText
                  variant="caption"
                  weight="semiBold"
                  color={selected ? colors.primary : colors.textSecondary}
                >
                  {item.name}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        <SectionTitle title="Players / Teams" />
        {contestants.length < 2 ? (
          <View style={styles.infoBox}>
            <Ionicons name="people-outline" size={18} color={colors.primary} />
            <AppText variant="caption" color={colors.textSecondary} style={{ flex: 1 }}>
              Fewer than two approved entries in this category. Add the missing players by name
              below — they don&apos;t need a SmashDraw account.
            </AppText>
          </View>
        ) : null}
        <View style={styles.contestantGrid}>
          <ContestantPicker
            contestants={contestants}
            label="Side A"
            onRemoveGuest={handleRemoveGuest}
            onSelect={setPlayer1Id}
            selectedId={player1Id}
          />
          <ContestantPicker
            contestants={contestants}
            excludedId={player1Id}
            label="Side B"
            onRemoveGuest={handleRemoveGuest}
            onSelect={setPlayer2Id}
            selectedId={player2Id}
          />
          <ManualContestantInput
            isDoubles={isDoublesCategory(category?.name ?? '')}
            onAdd={handleAddGuest}
          />
        </View>

        <SectionTitle title="Scorecard" />
        <View style={styles.scorecard}>
          <View style={styles.scoreHeaderRow}>
            <AppText variant="xs" weight="semiBold" color={colors.textMuted} style={styles.sideCol}>
              SIDE
            </AppText>
            {[1, 2, 3].map((gameNumber) => (
              <AppText
                key={gameNumber}
                variant="xs"
                weight="semiBold"
                color={colors.textMuted}
                style={styles.gameHeader}
              >
                G{gameNumber}
              </AppText>
            ))}
            <AppText variant="xs" weight="semiBold" color={colors.textMuted} style={styles.winCol}>
              W
            </AppText>
          </View>
          <ScoreRow
            colors={colors}
            games={games}
            isWinner={scoreSummary?.winnerSide === 1}
            label={player1?.name ?? 'Side A'}
            side="a"
            styles={styles}
            updateGameScore={updateGameScore}
          />
          <ScoreRow
            colors={colors}
            games={games}
            isWinner={scoreSummary?.winnerSide === 2}
            label={player2?.name ?? 'Side B'}
            side="b"
            styles={styles}
            updateGameScore={updateGameScore}
          />
        </View>
        {hasPartialGame ? (
          <AppText variant="caption" color={colors.danger} style={styles.helperText}>
            Complete both scores for each game you enter.
          </AppText>
        ) : null}
        {!scoreSummary && !hasPartialGame ? (
          <AppText variant="caption" color={colors.textMuted} style={styles.helperText}>
            Enter at least one completed game with a clear winner.
          </AppText>
        ) : null}

        <View style={styles.field}>
          <AppText
            variant="label"
            weight="medium"
            color={colors.textSecondary}
            style={styles.label}
          >
            Prize money received (Rs)
          </AppText>
          <TextInput
            keyboardType="number-pad"
            onChangeText={setPrizeMoney}
            placeholder="Optional"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={prizeMoney}
          />
        </View>

        <View style={styles.field}>
          <AppText
            variant="label"
            weight="medium"
            color={colors.textSecondary}
            style={styles.label}
          >
            Result details
          </AppText>
          <TextInput
            multiline
            onChangeText={setNotes}
            placeholder="Final round, walkover reason, scorer notes..."
            placeholderTextColor={colors.textMuted}
            style={[styles.input, styles.textarea]}
            textAlignVertical="top"
            value={notes}
          />
        </View>

        <AppButton
          disabled={!canSave}
          loading={saving}
          onPress={handleSubmit}
          style={styles.submitButton}
          title="Upload Result & Finish"
        />
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <AppText variant="label" weight="semiBold" style={{ marginTop: 22, marginBottom: 9 }}>
      {title}
    </AppText>
  );
}

function ScorePill({
  colors,
  label,
  value,
}: {
  colors: ReturnType<typeof useTheme>['colors'];
  label: string;
  value: string;
}) {
  return (
    <View style={{ flex: 1 }}>
      <AppText variant="xs" weight="semiBold" color="rgba(255,255,255,0.6)">
        {label}
      </AppText>
      <AppText variant="title" weight="bold" color="#fff">
        {value}
      </AppText>
    </View>
  );
}

function ScoreRow({
  colors,
  games,
  isWinner,
  label,
  side,
  styles,
  updateGameScore,
}: {
  colors: ReturnType<typeof useTheme>['colors'];
  games: GameScore[];
  isWinner: boolean;
  label: string;
  side: keyof GameScore;
  styles: ReturnType<typeof makeStyles>;
  updateGameScore: (index: number, side: keyof GameScore, value: string) => void;
}) {
  return (
    <View style={[styles.scoreEntryRow, isWinner ? styles.scoreEntryWinner : null]}>
      <View style={styles.sideCol}>
        <AppText variant="caption" weight="semiBold" numberOfLines={2}>
          {label}
        </AppText>
      </View>
      {games.map((game, index) => (
        <TextInput
          key={`${side}-${index}`}
          keyboardType="number-pad"
          maxLength={2}
          onChangeText={(value) => updateGameScore(index, side, value)}
          placeholder="-"
          placeholderTextColor={colors.textMuted}
          style={styles.scoreInput}
          textAlign="center"
          value={game[side]}
        />
      ))}
      <View style={styles.winCol}>
        {isWinner ? <Ionicons name="trophy" size={18} color={colors.success} /> : null}
      </View>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    safe: {
      backgroundColor: colors.background,
      flex: 1,
    },
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
      justifyContent: 'space-between',
      paddingBottom: 12,
      paddingHorizontal: 16,
      paddingTop: 10,
    },
    headerTitle: {
      alignItems: 'center',
      flex: 1,
    },
    iconButton: {
      alignItems: 'center',
      borderRadius: 18,
      height: 36,
      justifyContent: 'center',
      width: 36,
    },
    loading: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
    },
    loadingScroll: {
      paddingHorizontal: 18,
    },
    empty: {
      alignItems: 'center',
      flex: 1,
      gap: 10,
      justifyContent: 'center',
      paddingHorizontal: 28,
    },
    scroll: {
      paddingBottom: 34,
      paddingHorizontal: 18,
    },
    scoreHero: {
      backgroundColor: '#123C69',
      borderRadius: 16,
      overflow: 'hidden',
      padding: 18,
    },
    heroTop: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 12,
      justifyContent: 'space-between',
    },
    heroTitle: {
      marginTop: 4,
    },
    heroBadge: {
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.14)',
      borderRadius: 999,
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    heroScoreRow: {
      backgroundColor: 'rgba(255,255,255,0.1)',
      borderRadius: 12,
      flexDirection: 'row',
      gap: 12,
      marginTop: 20,
      padding: 12,
    },
    infoBox: {
      alignItems: 'flex-start',
      backgroundColor: colors.primaryLight,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 9,
      marginTop: 14,
      padding: 12,
    },
    chipGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    chipActive: {
      backgroundColor: colors.primaryLight,
      borderColor: colors.primary,
    },
    contestantGrid: {
      gap: 12,
    },
    scorecard: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      overflow: 'hidden',
    },
    scoreHeaderRow: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: 'row',
      minHeight: 38,
      paddingHorizontal: 10,
    },
    scoreEntryRow: {
      alignItems: 'center',
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: 'row',
      minHeight: 64,
      paddingHorizontal: 10,
    },
    scoreEntryWinner: {
      backgroundColor: colors.primaryLight,
    },
    sideCol: {
      flex: 1.8,
      paddingRight: 8,
    },
    gameHeader: {
      textAlign: 'center',
      width: 48,
    },
    scoreInput: {
      backgroundColor: colors.inputBg,
      borderColor: colors.border,
      borderRadius: 10,
      borderWidth: 1,
      color: colors.text,
      fontFamily: 'Inter_SemiBold',
      fontSize: 16,
      height: 42,
      marginHorizontal: 3,
      width: 42,
    },
    winCol: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 28,
    },
    helperText: {
      marginTop: 8,
    },
    field: {
      marginTop: 16,
    },
    label: {
      marginBottom: 7,
    },
    input: {
      backgroundColor: colors.inputBg,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      color: colors.text,
      fontFamily: 'Inter_Regular',
      fontSize: 15,
      minHeight: 48,
      paddingHorizontal: 14,
    },
    textarea: {
      minHeight: 104,
      paddingTop: 12,
    },
    submitButton: {
      marginTop: 24,
    },
  });
}
