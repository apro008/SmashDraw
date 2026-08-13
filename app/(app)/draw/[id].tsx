import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '~/components/AppButton';
import { AppText } from '~/components/AppText';
import { SkeletonLoader } from '~/components/common/SkeletonLoader';
import { buildContestants } from '~/lib/contestants';
import {
  announceDraw,
  buildNextRound,
  clearCategoryDraw,
  fetchCategoryMatches,
  generateFirstRound,
  isMatchDecided,
  latestRound,
  matchesInRound,
  MIN_DRAW_ENTRIES,
  roundLabel,
  saveFirstRound,
  saveNextRound,
} from '~/lib/draw';
import {
  fetchTournamentById,
  fetchTournamentRegistrations,
  getResultAccess,
  TournamentRegistrationDetails,
} from '~/lib/tournaments';
import { useTheme } from '~/hooks/useTheme';
import { useAlert } from '~/providers/AlertProvider';
import { useAuthStore } from '~/store/useAuthStore';
import { Tournament, TournamentCategory, TournamentMatchResult } from '~/types';

export default function DrawScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { confirm, showAlert } = useAlert();
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);

  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [registrations, setRegistrations] = useState<TournamentRegistrationDetails[]>([]);
  const [category, setCategory] = useState<TournamentCategory | null>(null);
  const [matches, setMatches] = useState<TournamentMatchResult[]>([]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [next, regs] = await Promise.all([
        fetchTournamentById(id),
        fetchTournamentRegistrations(id),
      ]);
      setTournament(next);
      setRegistrations(regs);
      setCategory((current) => current ?? next?.categories?.[0] ?? null);
    } catch (err: any) {
      showAlert({
        type: 'danger',
        title: 'Unable to load draw',
        message: err?.message ?? 'Please try again.',
      });
    } finally {
      setLoading(false);
    }
  }, [id, showAlert]);

  useEffect(() => {
    load();
  }, [load]);

  const loadMatches = useCallback(async () => {
    if (!id || !category) {
      setMatches([]);
      return;
    }
    try {
      setMatches(await fetchCategoryMatches(id, category.id));
    } catch {
      setMatches([]);
    }
  }, [category, id]);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  const contestants = useMemo(
    () => buildContestants(registrations, category?.id ?? null),
    [category?.id, registrations]
  );

  const access = getResultAccess(tournament, user?.id, profile?.role);

  const myName = profile?.name?.trim().toLowerCase() ?? '';
  const isMyMatch = useCallback(
    (match: TournamentMatchResult) => {
      if (user?.id && (match.player1_id === user.id || match.player2_id === user.id)) return true;
      // A doubles side is stored as one combined team name, so an id check alone
      // misses the partner — fall back to looking for the viewer's own name.
      if (!myName) return false;
      return [match.player1_name, match.player2_name].some((name) =>
        name?.toLowerCase().includes(myName)
      );
    },
    [myName, user?.id]
  );

  const rounds = useMemo(() => {
    const highest = latestRound(matches);
    return Array.from({ length: highest }, (_, index) => matchesInRound(matches, index + 1));
  }, [matches]);

  // Round 1 fixes the bracket size, so the number of rounds follows from it.
  const totalRounds = rounds[0]?.length ? Math.log2(rounds[0].length * 2) : 0;
  const currentRound = latestRound(matches);
  const nextRoundPairings = currentRound > 0 ? buildNextRound(matches, currentRound) : null;
  const champion =
    currentRound > 0 && rounds[currentRound - 1]?.length === 1
      ? (rounds[currentRound - 1][0].winner_name ?? null)
      : null;

  const runDraw = async () => {
    if (!tournament || !category) return;
    setWorking(true);
    try {
      await saveFirstRound(tournament.id, category.id, generateFirstRound(contestants));
      await loadMatches();
      let told = 0;
      try {
        told = await announceDraw(tournament.id, category.id);
      } catch {
        // The draw is saved either way — a failed announcement is not worth undoing it.
      }
      showAlert({
        type: 'success',
        title: 'Draw generated',
        message:
          told > 0
            ? `${category.name} draw is live. ${told} player(s) notified.`
            : `${category.name} draw is live.`,
      });
    } catch (err: any) {
      showAlert({
        type: 'danger',
        title: 'Could not generate draw',
        message: err?.message ?? 'Please try again.',
      });
    } finally {
      setWorking(false);
    }
  };

  const handleGenerate = () => {
    if (contestants.length < MIN_DRAW_ENTRIES) {
      showAlert({
        type: 'warning',
        title: 'Not enough entries',
        message: `Approve at least ${MIN_DRAW_ENTRIES} entries in this category first.`,
      });
      return;
    }

    if (matches.length === 0) {
      runDraw();
      return;
    }

    const playedCount = matches.filter(
      (match) => match.status === 'completed' || match.status === 'live'
    ).length;

    confirm({
      title: 'Regenerate draw?',
      message:
        playedCount > 0
          ? `This deletes the current draw for ${category?.name}, including ${playedCount} recorded result(s). This cannot be undone.`
          : `This replaces the current ${category?.name} draw with a new random one.`,
      confirmText: 'Regenerate',
      destructive: true,
      onConfirm: runDraw,
    });
  };

  const handleNextRound = async () => {
    if (!tournament || !category || !nextRoundPairings) return;
    setWorking(true);
    try {
      await saveNextRound(tournament.id, category.id, currentRound + 1, nextRoundPairings);
      await loadMatches();
    } catch (err: any) {
      showAlert({
        type: 'danger',
        title: 'Could not build next round',
        message: err?.message ?? 'Please try again.',
      });
    } finally {
      setWorking(false);
    }
  };

  const handleClear = () => {
    if (!tournament || !category) return;
    confirm({
      title: 'Clear draw?',
      message: `Every match in ${category.name} will be deleted, results included.`,
      confirmText: 'Clear',
      destructive: true,
      onConfirm: async () => {
        setWorking(true);
        try {
          await clearCategoryDraw(tournament.id, category.id);
          await loadMatches();
        } catch (err: any) {
          showAlert({
            type: 'danger',
            title: 'Could not clear draw',
            message: err?.message ?? 'Please try again.',
          });
        } finally {
          setWorking(false);
        }
      },
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <NavBar colors={colors} styles={styles} subtitle={null} />
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <SkeletonLoader variant="detail" count={3} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!tournament) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <NavBar colors={colors} styles={styles} subtitle={null} />
        <View style={styles.centered}>
          <Ionicons name="lock-closed-outline" size={44} color={colors.textMuted} />
          <AppText variant="title" color={colors.textMuted} center style={{ marginTop: 12 }}>
            Tournament not found
          </AppText>
        </View>
      </SafeAreaView>
    );
  }

  const categories = tournament.categories ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <NavBar colors={colors} styles={styles} subtitle={tournament.title} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.chipGrid}>
          {categories.map((item) => {
            const selected = category?.id === item.id;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
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

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Ionicons name="people-outline" size={17} color={colors.primary} />
            <AppText variant="body" style={{ flex: 1 }}>
              {contestants.length} approved {contestants.length === 1 ? 'entry' : 'entries'}
            </AppText>
            {totalRounds > 0 ? (
              <AppText variant="xs" color={colors.textMuted}>
                {totalRounds} round{totalRounds === 1 ? '' : 's'}
              </AppText>
            ) : null}
          </View>
          <AppText variant="caption" color={colors.textSecondary}>
            {access.canManage
              ? 'The draw is a straight shuffle — no seeding. Entries are padded out to a full bracket with byes, and a bye advances automatically.'
              : 'The draw is a straight shuffle — no seeding. Your own matches are marked "You".'}
          </AppText>
        </View>

        {champion ? (
          <View style={styles.championCard}>
            <Ionicons name="trophy" size={20} color={colors.win} />
            <AppText variant="body" weight="semiBold" color={colors.win} style={{ flex: 1 }}>
              {champion} wins {category?.name}
            </AppText>
          </View>
        ) : null}

        {rounds.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="git-branch-outline" size={40} color={colors.textMuted} />
            <AppText variant="body" color={colors.textSecondary} center style={{ marginTop: 10 }}>
              {access.canManage
                ? `No draw yet for ${category?.name ?? 'this category'}.`
                : `The ${category?.name ?? ''} draw has not been published yet. You will get a notification when it is.`}
            </AppText>
          </View>
        ) : (
          rounds.map((roundMatches, index) => (
            <View key={index} style={styles.section}>
              <AppText variant="label" weight="semiBold" color={colors.textMuted}>
                {roundLabel(index + 1, totalRounds).toUpperCase()}
              </AppText>
              <View style={styles.card}>
                {roundMatches.map((match, matchIndex) => (
                  <MatchRow
                    key={match.id}
                    colors={colors}
                    isFirst={matchIndex === 0}
                    isMine={isMyMatch(match)}
                    match={match}
                    styles={styles}
                  />
                ))}
              </View>
            </View>
          ))
        )}

        {nextRoundPairings && access.canManage ? (
          <AppButton
            title={`Build ${roundLabel(currentRound + 1, totalRounds)}`}
            onPress={handleNextRound}
            loading={working}
            style={styles.actionButton}
            variant="outline"
          />
        ) : null}

        {rounds.length > 0 && access.canManage ? (
          <Pressable accessibilityRole="button" onPress={handleClear} style={styles.clearButton}>
            <AppText variant="caption" weight="semiBold" color={colors.danger}>
              Clear draw
            </AppText>
          </Pressable>
        ) : null}

        <View style={{ height: access.canManage ? 90 : 24 }} />
      </ScrollView>

      {access.canManage ? (
        <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
          <AppButton
            title={rounds.length === 0 ? 'Generate Draw' : 'Regenerate Draw'}
            onPress={handleGenerate}
            loading={working}
            disabled={!category}
          />
        </SafeAreaView>
      ) : null}
    </SafeAreaView>
  );
}

function NavBar({
  colors,
  styles,
  subtitle,
}: {
  colors: ReturnType<typeof useTheme>['colors'];
  styles: ReturnType<typeof makeStyles>;
  subtitle: string | null;
}) {
  return (
    <View style={styles.navBar}>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backBtn}>
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <AppText variant="title" weight="bold">
          Draw
        </AppText>
        {subtitle ? (
          <AppText variant="xs" color={colors.textMuted} numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

function MatchRow({
  colors,
  isFirst,
  isMine,
  match,
  styles,
}: {
  colors: ReturnType<typeof useTheme>['colors'];
  isFirst: boolean;
  isMine: boolean;
  match: TournamentMatchResult;
  styles: ReturnType<typeof makeStyles>;
}) {
  const bye = !match.player2_name;
  const decided = isMatchDecided(match);
  const winnerName = match.winner_name;

  return (
    <View
      style={[
        styles.matchRow,
        isFirst ? null : styles.matchRowDivider,
        isMine ? styles.matchRowMine : null,
      ]}
    >
      <View style={styles.matchNumber}>
        <AppText variant="xs" weight="semiBold" color={isMine ? colors.primary : colors.textMuted}>
          {match.match_number}
        </AppText>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <SideLabel
          colors={colors}
          isWinner={decided && winnerName === match.player1_name}
          name={match.player1_name ?? 'TBD'}
        />
        <SideLabel
          colors={colors}
          isWinner={decided && winnerName === match.player2_name}
          name={bye ? 'Bye' : (match.player2_name ?? 'TBD')}
          muted={bye}
        />
      </View>
      {match.score ? (
        <AppText variant="xs" color={colors.textMuted}>
          {match.score}
        </AppText>
      ) : bye ? (
        <Ionicons name="arrow-forward" size={15} color={colors.textMuted} />
      ) : null}
      {isMine ? (
        <View style={styles.minePill}>
          <AppText variant="xs" weight="bold" color={colors.primary}>
            You
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

function SideLabel({
  colors,
  isWinner,
  muted,
  name,
}: {
  colors: ReturnType<typeof useTheme>['colors'];
  isWinner: boolean;
  muted?: boolean;
  name: string;
}) {
  return (
    <View style={{ alignItems: 'center', flexDirection: 'row', gap: 6 }}>
      <AppText
        variant="body"
        weight={isWinner ? 'semiBold' : 'regular'}
        color={muted ? colors.textMuted : isWinner ? colors.win : colors.text}
        numberOfLines={1}
        style={{ flex: 1 }}
      >
        {name}
      </AppText>
      {isWinner ? <Ionicons name="checkmark" size={14} color={colors.win} /> : null}
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    safe: {
      backgroundColor: colors.background,
      flex: 1,
    },
    navBar: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    backBtn: {
      alignItems: 'center',
      height: 38,
      justifyContent: 'center',
      width: 38,
    },
    scroll: {
      padding: 20,
      paddingTop: 6,
    },
    centered: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
      padding: 24,
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
      paddingHorizontal: 13,
      paddingVertical: 7,
    },
    chipActive: {
      backgroundColor: colors.primaryLight,
      borderColor: colors.primary,
    },
    summaryCard: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      gap: 8,
      marginTop: 16,
      padding: 14,
    },
    summaryRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    championCard: {
      alignItems: 'center',
      backgroundColor: colors.card,
      borderColor: colors.win,
      borderRadius: 16,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 10,
      marginTop: 14,
      padding: 14,
    },
    emptyCard: {
      alignItems: 'center',
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      marginTop: 16,
      padding: 28,
    },
    section: {
      gap: 8,
      marginTop: 18,
    },
    card: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      paddingHorizontal: 14,
    },
    matchRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
      paddingVertical: 12,
    },
    matchRowDivider: {
      borderTopColor: colors.border,
      borderTopWidth: 1,
    },
    // The viewer's own fixture, so a player can find themselves in a full bracket.
    matchRowMine: {
      backgroundColor: colors.primary + '12',
      borderRadius: 10,
      marginHorizontal: -6,
      paddingHorizontal: 6,
    },
    minePill: {
      backgroundColor: colors.primary + '1F',
      borderRadius: 999,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    matchNumber: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 999,
      height: 26,
      justifyContent: 'center',
      width: 26,
    },
    actionButton: {
      marginTop: 20,
    },
    clearButton: {
      alignItems: 'center',
      marginTop: 16,
      padding: 10,
    },
    bottomBar: {
      backgroundColor: colors.background,
      borderTopColor: colors.border,
      borderTopWidth: 1,
      paddingHorizontal: 20,
      paddingTop: 12,
    },
  });
}
