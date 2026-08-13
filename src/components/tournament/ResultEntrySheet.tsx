import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppButton } from '~/components/AppButton';
import { AppText } from '~/components/AppText';
import { ContestantPicker, ManualContestantInput } from '~/components/tournament/ContestantPicker';
import { isDoublesCategory } from '~/constants/TournamentCategories';
import {
  buildContestants,
  createGuestContestant,
  findContestantId,
  type Contestant,
} from '~/lib/contestants';
import {
  createEmptyGames,
  gamesFromScoreText,
  hasPartialGame,
  summarizeScore,
  type GameScore,
} from '~/lib/matchScore';
import {
  saveTournamentResult,
  TournamentRegistrationDetails,
  updateTournamentResult,
} from '~/lib/tournaments';
import { useAlert } from '~/providers/AlertProvider';
import { useAuthStore } from '~/store/useAuthStore';
import { Tournament, TournamentCategory, TournamentMatchResult } from '~/types';
import { useTheme } from '~/hooks/useTheme';

interface ResultEntrySheetProps {
  registrations: TournamentRegistrationDetails[];
  tournament: Tournament;
  initialResult?: TournamentMatchResult | null;
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function ResultEntrySheet({
  initialResult,
  onClose,
  onSaved,
  registrations,
  tournament,
  visible,
}: ResultEntrySheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { showAlert } = useAlert();
  const user = useAuthStore((s) => s.user);

  const categories = useMemo(() => tournament.categories ?? [], [tournament.categories]);
  const [category, setCategory] = useState<TournamentCategory | null>(categories[0] ?? null);
  const [guests, setGuests] = useState<Contestant[]>([]);
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
  const [player1Id, setPlayer1Id] = useState('');
  const [player2Id, setPlayer2Id] = useState('');
  const [games, setGames] = useState<GameScore[]>(createEmptyGames);
  const [prizeMoney, setPrizeMoney] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const isEditing = !!initialResult;
  // A fixture opened straight from the draw has both sides but no score yet, so
  // it is being recorded for the first time rather than corrected.
  const isRecordingFixture = isEditing && !initialResult?.score;

  useEffect(() => {
    if (!visible) return;
    const nextCategory =
      categories.find((item) => item.id === initialResult?.category_id) ?? categories[0] ?? null;
    setCategory(nextCategory);
    const nextContestants = buildContestants(registrations, nextCategory?.id ?? null);
    // A saved result can name players who never registered — bring them back as manual entries.
    const nextGuests: Contestant[] = [];
    const resolveSide = (userId?: string | null, name?: string | null, excludeId?: string) => {
      const matched = findContestantId(nextContestants, userId, name);
      if (matched && matched !== excludeId) return matched;
      if (initialResult && name) {
        const guest = createGuestContestant(name, nextCategory?.id ?? null, userId ?? null);
        nextGuests.push(guest);
        return guest.id;
      }
      return nextContestants.find((item) => item.id !== excludeId)?.id ?? '';
    };
    const nextPlayer1Id = resolveSide(initialResult?.player1_id, initialResult?.player1_name);
    const nextPlayer2Id = resolveSide(
      initialResult?.player2_id,
      initialResult?.player2_name,
      nextPlayer1Id
    );
    setGuests(nextGuests);
    setPlayer1Id(nextPlayer1Id);
    setPlayer2Id(nextPlayer2Id);
    setGames(initialResult ? gamesFromScoreText(initialResult.score) : createEmptyGames());
    setPrizeMoney(initialResult?.prize_money_received?.toString() ?? '');
    setNotes(initialResult?.result_notes ?? '');
  }, [categories, initialResult, registrations, visible]);

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
  const partialGame = hasPartialGame(games);
  const winner =
    scoreSummary?.winnerSide === 1 ? player1 : scoreSummary?.winnerSide === 2 ? player2 : null;
  const prize = prizeMoney.trim() ? Number(prizeMoney) : null;
  const canSave =
    !!user?.id &&
    !!category &&
    !!player1 &&
    !!player2 &&
    player1.id !== player2.id &&
    !!scoreSummary &&
    !partialGame &&
    (!prizeMoney.trim() || (prize !== null && Number.isFinite(prize) && prize >= 0));

  const updateGameScore = (index: number, side: keyof GameScore, value: string) => {
    const nextValue = value.replace(/[^\d]/g, '').slice(0, 2);
    setGames((current) =>
      current.map((game, gameIndex) =>
        gameIndex === index ? { ...game, [side]: nextValue } : game
      )
    );
  };

  const handleSave = async () => {
    if (!canSave || !category || !player1 || !player2 || !winner || !scoreSummary || !user?.id) {
      return;
    }

    setSaving(true);
    try {
      const payload = {
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
      };
      if (initialResult) {
        await updateTournamentResult(initialResult.id, payload);
      } else {
        await saveTournamentResult(payload);
      }
      showAlert({
        type: 'success',
        title: isRecordingFixture
          ? 'Result saved'
          : initialResult
            ? 'Result updated'
            : 'Result uploaded',
        message: isRecordingFixture
          ? 'The bracket is updated — build the next round from the draw screen.'
          : initialResult
            ? 'The latest scorecard is now visible to players.'
            : 'This match result is now visible to players. Other matches are unaffected.',
      });
      onSaved();
      onClose();
    } catch (err: any) {
      showAlert({
        type: 'danger',
        title: 'Could not upload result',
        message: err?.message ?? 'Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <AppText variant="title" weight="bold">
              {isRecordingFixture
                ? `Match #${initialResult?.match_number} Result`
                : isEditing
                  ? `Update Match #${initialResult?.match_number}`
                  : 'Add Match Result'}
            </AppText>
            <AppText variant="caption" color={colors.textSecondary}>
              {isRecordingFixture
                ? 'Both sides come from the draw — just enter the score.'
                : isEditing
                  ? 'Only this match is changed — every other result stays as it is.'
                  : 'Upload the result of a single match without ending the tournament.'}
            </AppText>
          </View>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={20} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <AppText variant="label" weight="semiBold" color={colors.textMuted} style={styles.label}>
            CATEGORY
          </AppText>
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

          <AppText variant="label" weight="semiBold" color={colors.textMuted} style={styles.label}>
            PLAYERS / TEAMS
          </AppText>
          {contestants.length < 2 ? (
            <View style={styles.notice}>
              <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
              <AppText variant="caption" color={colors.textSecondary} style={{ flex: 1 }}>
                Fewer than two approved entries in this category. Add the missing players by name
                below — they don&apos;t need a SmashDraw account.
              </AppText>
            </View>
          ) : null}
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

          <AppText variant="label" weight="semiBold" color={colors.textMuted} style={styles.label}>
            SCORECARD
          </AppText>
          <View style={styles.scorecard}>
            <View style={styles.scoreHeaderRow}>
              <AppText
                variant="xs"
                weight="semiBold"
                color={colors.textMuted}
                style={styles.sideCol}
              >
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
              <View style={styles.winCol} />
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
          {partialGame ? (
            <AppText variant="caption" color={colors.danger} style={styles.helperText}>
              Complete both scores for each game you enter.
            </AppText>
          ) : scoreSummary ? (
            <AppText variant="caption" color={colors.textSecondary} style={styles.helperText}>
              Winner: {winner?.name} · {scoreSummary.player1Games}-{scoreSummary.player2Games} games
              ({scoreSummary.scoreText})
            </AppText>
          ) : (
            <AppText variant="caption" color={colors.textMuted} style={styles.helperText}>
              Enter at least one completed game with a clear winner.
            </AppText>
          )}

          <Field
            colors={colors}
            keyboardType="number-pad"
            label="Prize money received"
            onChangeText={setPrizeMoney}
            placeholder="Amount in rupees (optional)"
            styles={styles}
            value={prizeMoney}
          />
          <Field
            colors={colors}
            label="Result details"
            multiline
            onChangeText={setNotes}
            placeholder="Round name, walkover reason, referee remarks..."
            styles={styles}
            value={notes}
          />

          <AppButton
            disabled={!canSave}
            loading={saving}
            onPress={handleSave}
            style={styles.submitButton}
            title={isEditing ? 'Save Changes' : 'Upload Result'}
          />
        </ScrollView>
      </View>
    </Modal>
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
        {isWinner ? <Ionicons name="trophy" size={17} color={colors.success} /> : null}
      </View>
    </View>
  );
}

function Field({
  colors,
  keyboardType,
  label,
  multiline,
  onChangeText,
  placeholder,
  styles,
  value,
}: {
  colors: ReturnType<typeof useTheme>['colors'];
  keyboardType?: 'default' | 'number-pad';
  label: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  placeholder?: string;
  styles: ReturnType<typeof makeStyles>;
  value: string;
}) {
  return (
    <View style={styles.field}>
      <AppText
        variant="label"
        weight="medium"
        color={colors.textSecondary}
        style={styles.fieldLabel}
      >
        {label}
      </AppText>
      <TextInput
        keyboardType={keyboardType}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, multiline ? styles.textarea : null]}
        textAlignVertical={multiline ? 'top' : 'center'}
        value={value}
      />
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay,
    },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      bottom: 0,
      left: 0,
      maxHeight: '90%',
      paddingBottom: 24,
      paddingHorizontal: 20,
      paddingTop: 18,
      position: 'absolute',
      right: 0,
    },
    header: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    closeButton: {
      alignItems: 'center',
      height: 36,
      justifyContent: 'center',
      width: 36,
    },
    label: {
      marginBottom: 8,
      marginTop: 14,
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
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    chipActive: {
      backgroundColor: colors.primaryLight,
      borderColor: colors.primary,
    },
    notice: {
      alignItems: 'flex-start',
      backgroundColor: colors.primaryLight,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 8,
      padding: 12,
    },
    scorecard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      overflow: 'hidden',
    },
    scoreHeaderRow: {
      alignItems: 'center',
      backgroundColor: colors.inputBg,
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: 'row',
      minHeight: 36,
      paddingHorizontal: 10,
    },
    scoreEntryRow: {
      alignItems: 'center',
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: 'row',
      minHeight: 62,
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
      width: 26,
    },
    helperText: {
      marginTop: 8,
    },
    field: {
      flex: 1,
      marginTop: 14,
    },
    fieldLabel: {
      marginBottom: 6,
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
      minHeight: 88,
      paddingTop: 12,
    },
    submitButton: {
      marginTop: 22,
    },
  });
}
