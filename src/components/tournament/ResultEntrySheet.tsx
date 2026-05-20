import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppButton } from '~/components/AppButton';
import { AppText } from '~/components/AppText';
import { isDoublesCategory } from '~/constants/TournamentCategories';
import { saveTournamentResult, TournamentRegistrationDetails } from '~/lib/tournaments';
import { useAlert } from '~/providers/AlertProvider';
import { useAuthStore } from '~/store/useAuthStore';
import { Tournament, TournamentCategory } from '~/types';
import { useTheme } from '~/hooks/useTheme';

interface ResultEntrySheetProps {
  registrations: TournamentRegistrationDetails[];
  tournament: Tournament;
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}

interface Contestant {
  id: string;
  userId: string;
  categoryId: string;
  name: string;
  detail: string;
}

export function ResultEntrySheet({
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

  const categories = tournament.categories ?? [];
  const [category, setCategory] = useState<TournamentCategory | null>(categories[0] ?? null);
  const contestants = useMemo(
    () => buildContestants(registrations, category?.id ?? null),
    [category?.id, registrations]
  );
  const [player1Id, setPlayer1Id] = useState('');
  const [player2Id, setPlayer2Id] = useState('');
  const [winnerSide, setWinnerSide] = useState<1 | 2>(1);
  const [player1Score, setPlayer1Score] = useState('');
  const [player2Score, setPlayer2Score] = useState('');
  const [prizeMoney, setPrizeMoney] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const nextCategory = categories[0] ?? null;
    setCategory(nextCategory);
    const nextContestants = buildContestants(registrations, nextCategory?.id ?? null);
    setPlayer1Id(nextContestants[0]?.id ?? '');
    setPlayer2Id(nextContestants[1]?.id ?? '');
    setWinnerSide(1);
    setPlayer1Score('');
    setPlayer2Score('');
    setPrizeMoney('');
    setNotes('');
  }, [categories, registrations, visible]);

  useEffect(() => {
    setPlayer1Id(contestants[0]?.id ?? '');
    setPlayer2Id(contestants[1]?.id ?? '');
    setWinnerSide(1);
  }, [contestants]);

  const player1 = contestants.find((item) => item.id === player1Id) ?? null;
  const player2 = contestants.find((item) => item.id === player2Id) ?? null;
  const winner = winnerSide === 1 ? player1 : player2;
  const score1 = Number(player1Score);
  const score2 = Number(player2Score);
  const prize = prizeMoney.trim() ? Number(prizeMoney) : null;
  const canSave =
    !!user?.id &&
    !!category &&
    !!player1 &&
    !!player2 &&
    player1.id !== player2.id &&
    Number.isFinite(score1) &&
    Number.isFinite(score2) &&
    score1 >= 0 &&
    score2 >= 0 &&
    (!prizeMoney.trim() || (prize !== null && Number.isFinite(prize) && prize >= 0));

  const handleSave = async () => {
    if (!canSave || !category || !player1 || !player2 || !winner || !user?.id) return;

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
        player1Score: score1,
        player2Score: score2,
        prizeMoneyReceived: prize,
        notes: notes.trim() || null,
        uploadedBy: user.id,
      });
      showAlert({
        type: 'success',
        title: 'Result uploaded',
        message: 'Players can now view this match result.',
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
          <View>
            <AppText variant="title" weight="bold">
              Finish Match
            </AppText>
            <AppText variant="caption" color={colors.textSecondary}>
              Upload score, winner, and prize details
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
                  onPress={() => setCategory(item)}
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
                At least two approved entries are needed in this category before a result can be
                uploaded.
              </AppText>
            </View>
          ) : (
            <>
              <ContestantPicker
                colors={colors}
                contestants={contestants}
                label="Side A"
                selectedId={player1Id}
                setSelectedId={setPlayer1Id}
                styles={styles}
              />
              <ContestantPicker
                colors={colors}
                contestants={contestants}
                excludedId={player1Id}
                label="Side B"
                selectedId={player2Id}
                setSelectedId={setPlayer2Id}
                styles={styles}
              />
            </>
          )}

          <AppText variant="label" weight="semiBold" color={colors.textMuted} style={styles.label}>
            WINNER
          </AppText>
          <View style={styles.segment}>
            <Pressable
              disabled={!player1}
              onPress={() => setWinnerSide(1)}
              style={[styles.segmentItem, winnerSide === 1 ? styles.segmentActive : null]}
            >
              <AppText
                variant="caption"
                weight="semiBold"
                color={winnerSide === 1 ? colors.primary : colors.textSecondary}
              >
                {player1?.name ?? 'Side A'}
              </AppText>
            </Pressable>
            <Pressable
              disabled={!player2}
              onPress={() => setWinnerSide(2)}
              style={[styles.segmentItem, winnerSide === 2 ? styles.segmentActive : null]}
            >
              <AppText
                variant="caption"
                weight="semiBold"
                color={winnerSide === 2 ? colors.primary : colors.textSecondary}
              >
                {player2?.name ?? 'Side B'}
              </AppText>
            </Pressable>
          </View>

          <View style={styles.scoreRow}>
            <Field
              colors={colors}
              keyboardType="number-pad"
              label="Side A score"
              onChangeText={setPlayer1Score}
              styles={styles}
              value={player1Score}
            />
            <Field
              colors={colors}
              keyboardType="number-pad"
              label="Side B score"
              onChangeText={setPlayer2Score}
              styles={styles}
              value={player2Score}
            />
          </View>

          <Field
            colors={colors}
            keyboardType="number-pad"
            label="Prize money received"
            onChangeText={setPrizeMoney}
            placeholder="Amount in rupees"
            styles={styles}
            value={prizeMoney}
          />
          <Field
            colors={colors}
            label="Result details"
            multiline
            onChangeText={setNotes}
            placeholder="Final notes, walkover reason, referee remarks..."
            styles={styles}
            value={notes}
          />

          <AppButton
            disabled={!canSave}
            loading={saving}
            onPress={handleSave}
            style={styles.submitButton}
            title="Upload Result"
          />
        </ScrollView>
      </View>
    </Modal>
  );
}

function ContestantPicker({
  colors,
  contestants,
  excludedId,
  label,
  selectedId,
  setSelectedId,
  styles,
}: {
  colors: ReturnType<typeof useTheme>['colors'];
  contestants: Contestant[];
  excludedId?: string;
  label: string;
  selectedId: string;
  setSelectedId: (id: string) => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.pickerBlock}>
      <AppText variant="label" weight="medium" color={colors.textSecondary}>
        {label}
      </AppText>
      <View style={styles.optionList}>
        {contestants
          .filter((item) => item.id !== excludedId)
          .map((item) => {
            const selected = selectedId === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => setSelectedId(item.id)}
                style={[styles.option, selected ? styles.optionActive : null]}
              >
                <View style={{ flex: 1 }}>
                  <AppText variant="caption" weight="semiBold">
                    {item.name}
                  </AppText>
                  {item.detail ? (
                    <AppText variant="xs" color={colors.textMuted}>
                      {item.detail}
                    </AppText>
                  ) : null}
                </View>
                {selected ? (
                  <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                ) : null}
              </Pressable>
            );
          })}
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

function buildContestants(
  registrations: TournamentRegistrationDetails[],
  categoryId: string | null
): Contestant[] {
  return registrations
    .filter((registration) => registration.status === 'approved')
    .filter((registration) => !categoryId || registration.category_id === categoryId)
    .map((registration) => {
      const notes = parseRegistrationNotes(registration.notes);
      const playerName = notes.playerName ?? registration.player?.name ?? 'Player';
      const partnerName = notes.partnerName;
      const isDoubles = isDoublesCategory(registration.category?.name ?? '');
      return {
        id: registration.id,
        userId: registration.user_id,
        categoryId: registration.category_id,
        name: isDoubles && partnerName ? `${playerName} / ${partnerName}` : playerName,
        detail: registration.player?.city ?? '',
      };
    });
}

function parseRegistrationNotes(notes: string | null) {
  if (!notes) return {};
  try {
    return JSON.parse(notes) as {
      playerName?: string;
      partnerName?: string | null;
    };
  } catch {
    return {};
  }
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
      alignItems: 'center',
      flexDirection: 'row',
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
    pickerBlock: {
      gap: 8,
      marginTop: 10,
    },
    optionList: {
      gap: 7,
    },
    option: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 10,
      padding: 10,
    },
    optionActive: {
      backgroundColor: colors.primaryLight,
      borderColor: colors.primary,
    },
    segment: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: 'row',
      overflow: 'hidden',
    },
    segmentItem: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: 8,
    },
    segmentActive: {
      backgroundColor: colors.primaryLight,
    },
    scoreRow: {
      flexDirection: 'row',
      gap: 10,
    },
    field: {
      flex: 1,
      marginTop: 12,
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
