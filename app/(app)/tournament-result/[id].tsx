import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from '~/components/AppText';
import { SkeletonLoader } from '~/components/common/SkeletonLoader';
import { ResultEntrySheet } from '~/components/tournament/ResultEntrySheet';
import { useTheme } from '~/hooks/useTheme';
import {
  fetchTournamentById,
  fetchTournamentRegistrations,
  fetchTournamentResults,
  TournamentRegistrationDetails,
} from '~/lib/tournaments';
import { useAlert } from '~/providers/AlertProvider';
import { useAuthStore } from '~/store/useAuthStore';
import { Tournament, TournamentMatchResult } from '~/types';

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function parseGames(score: string | null) {
  if (!score) return [];
  return score
    .split(',')
    .map((game) => game.trim())
    .map((game) => {
      const [a, b] = game.split('-').map((part) => Number(part.trim()));
      if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
      return { a, b };
    })
    .filter((game): game is { a: number; b: number } => !!game);
}

export default function TournamentResultScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const tournamentId = Array.isArray(id) ? id[0] : id;
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { showAlert } = useAlert();
  const user = useAuthStore((s) => s.user);
  const entrance = useRef(new Animated.Value(0)).current;

  const [loading, setLoading] = useState(true);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [results, setResults] = useState<TournamentMatchResult[]>([]);
  const [registrations, setRegistrations] = useState<TournamentRegistrationDetails[]>([]);
  const [resultEntryVisible, setResultEntryVisible] = useState(false);
  const [editingResult, setEditingResult] = useState<TournamentMatchResult | null>(null);

  const load = useCallback(async () => {
    if (!tournamentId) return;
    setLoading(true);
    try {
      const [nextTournament, nextResults] = await Promise.all([
        fetchTournamentById(tournamentId),
        fetchTournamentResults(tournamentId),
      ]);
      setTournament(nextTournament);
      setResults(nextResults);
      if (nextTournament && user?.id === nextTournament.organizer_id) {
        setRegistrations(await fetchTournamentRegistrations(tournamentId));
      } else {
        setRegistrations([]);
      }
    } catch (err: any) {
      showAlert({
        type: 'danger',
        title: 'Unable to load results',
        message: err?.message ?? 'Please try again.',
      });
    } finally {
      setLoading(false);
    }
  }, [showAlert, tournamentId, user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (loading) return;
    entrance.setValue(0);
    Animated.timing(entrance, {
      duration: 420,
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [entrance, loading]);

  const champion = results[0]?.winner_name ?? null;
  const totalPrize = results.reduce((sum, result) => sum + (result.prize_money_received ?? 0), 0);
  const categoryCount = new Set(results.map((result) => result.category_id)).size;
  const slideUp = entrance.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });
  const canUpdateResults = !!tournament && !!user?.id && user.id === tournament.organizer_id;

  const openUpdateSheet = (result: TournamentMatchResult | null) => {
    setEditingResult(result);
    setResultEntryVisible(true);
  };

  const handleSaved = async () => {
    await load();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <AppText variant="title" weight="bold">
            Results
          </AppText>
          <View style={styles.iconButton} />
        </View>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <SkeletonLoader variant="detail" count={3} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!tournament) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <AppText variant="title" weight="bold">
            Results
          </AppText>
          <View style={styles.iconButton} />
        </View>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={46} color={colors.textMuted} />
          <AppText variant="title" weight="semiBold" center style={{ marginTop: 10 }}>
            Tournament not found
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
            Results
          </AppText>
          <AppText variant="caption" color={colors.textSecondary} numberOfLines={1}>
            {tournament.title}
          </AppText>
        </View>
        <View style={styles.iconButton} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: entrance, transform: [{ translateY: slideUp }] }}>
          <View style={styles.hero}>
            <View style={styles.courtLines}>
              <View style={styles.courtNet} />
              <View style={styles.courtCenter} />
            </View>
            <View style={styles.heroTop}>
              <View style={styles.trophyCircle}>
                <Ionicons name="trophy" size={30} color="#FDE68A" />
              </View>
              <View style={styles.heroBadge}>
                <Ionicons name="stats-chart-outline" size={15} color="#fff" />
                <AppText variant="caption" weight="semiBold" color="#fff">
                  Final Results
                </AppText>
              </View>
            </View>
            <AppText variant="heading" weight="bold" color="#fff" style={styles.heroTitle}>
              {champion ?? 'Results pending'}
            </AppText>
            <AppText variant="body" color="rgba(255,255,255,0.72)" style={styles.heroSub}>
              {champion
                ? 'Top result from the latest completed match.'
                : 'The organizer has not uploaded a completed match yet.'}
            </AppText>
            <View style={styles.heroStats}>
              <HeroStat label="Matches" value={String(results.length)} />
              <HeroStat label="Categories" value={String(categoryCount)} />
              <HeroStat label="Prize" value={totalPrize > 0 ? `Rs ${totalPrize}` : '--'} />
            </View>
          </View>
        </Animated.View>

        {results.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="document-text-outline" size={42} color={colors.textMuted} />
            <AppText variant="title" weight="semiBold" center style={{ marginTop: 10 }}>
              No result uploaded yet
            </AppText>
            <AppText variant="body" color={colors.textSecondary} center style={styles.emptyText}>
              Once the organizer finishes the tournament, the full scorecard will appear here.
            </AppText>
            {canUpdateResults ? (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => openUpdateSheet(null)}
                style={[styles.primaryAction, { backgroundColor: colors.primary }]}
              >
                <Ionicons name="add" size={17} color="#fff" />
                <AppText variant="label" weight="semiBold" color="#fff">
                  Upload Result
                </AppText>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <View style={styles.matchList}>
            {results.map((result, index) => (
              <AnimatedMatchCard
                canUpdate={canUpdateResults}
                colors={colors}
                index={index}
                key={result.id}
                onUpdate={() => openUpdateSheet(result)}
                result={result}
                styles={styles}
              />
            ))}
          </View>
        )}
      </ScrollView>
      {tournament ? (
        <ResultEntrySheet
          initialResult={editingResult}
          onClose={() => {
            setResultEntryVisible(false);
            setEditingResult(null);
          }}
          onSaved={handleSaved}
          registrations={registrations}
          tournament={tournament}
          visible={resultEntryVisible}
        />
      ) : null}
    </SafeAreaView>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <AppText variant="xs" weight="semiBold" color="rgba(255,255,255,0.58)">
        {label}
      </AppText>
      <AppText variant="title" weight="bold" color="#fff" numberOfLines={1}>
        {value}
      </AppText>
    </View>
  );
}

function AnimatedMatchCard({
  canUpdate,
  colors,
  index,
  onUpdate,
  result,
  styles,
}: {
  canUpdate: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
  index: number;
  onUpdate: () => void;
  result: TournamentMatchResult;
  styles: ReturnType<typeof makeStyles>;
}) {
  const cardAnim = useRef(new Animated.Value(0)).current;
  const barAnim = useRef(new Animated.Value(0)).current;
  const games = parseGames(result.score);
  const player1Score = result.player1_score ?? 0;
  const player2Score = result.player2_score ?? 0;
  const maxScore = Math.max(player1Score, player2Score, 1);
  const player1Won = result.winner_name === result.player1_name;
  const player2Won = result.winner_name === result.player2_name;
  const translateY = cardAnim.interpolate({ inputRange: [0, 1], outputRange: [22, 0] });

  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardAnim, {
        delay: 90 + index * 70,
        duration: 360,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(barAnim, {
        delay: 220 + index * 70,
        duration: 620,
        toValue: 1,
        useNativeDriver: false,
      }),
    ]).start();
  }, [barAnim, cardAnim, index]);

  return (
    <Animated.View style={[styles.matchCard, { opacity: cardAnim, transform: [{ translateY }] }]}>
      <View style={styles.matchHeader}>
        <View style={{ flex: 1 }}>
          <AppText variant="bodyLg" weight="bold">
            {result.category?.name ?? 'Match Result'}
          </AppText>
          <AppText variant="caption" color={colors.textMuted}>
            Match #{result.match_number}
            {result.completed_at ? ` • ${formatDate(result.completed_at)}` : ''}
          </AppText>
        </View>
        <View style={styles.matchActions}>
          {canUpdate ? (
            <TouchableOpacity activeOpacity={0.82} onPress={onUpdate} style={styles.updateButton}>
              <Ionicons name="create-outline" size={14} color={colors.primary} />
              <AppText variant="xs" weight="semiBold" color={colors.primary}>
                Update
              </AppText>
            </TouchableOpacity>
          ) : null}
          <View style={styles.winnerBadge}>
            <Ionicons name="trophy-outline" size={14} color="#B45309" />
            <AppText variant="xs" weight="semiBold" color="#B45309">
              Winner
            </AppText>
          </View>
        </View>
      </View>

      <View style={styles.winnerPanel}>
        <AppText variant="xs" weight="semiBold" color={colors.textMuted}>
          WINNER
        </AppText>
        <AppText variant="title" weight="bold">
          {result.winner_name ?? 'Not declared'}
        </AppText>
      </View>

      <View style={styles.scoreRows}>
        <ResultScoreLine
          anim={barAnim}
          colors={colors}
          maxScore={maxScore}
          name={result.player1_name ?? 'Side A'}
          score={player1Score}
          styles={styles}
          won={player1Won}
        />
        <ResultScoreLine
          anim={barAnim}
          colors={colors}
          maxScore={maxScore}
          name={result.player2_name ?? 'Side B'}
          score={player2Score}
          styles={styles}
          won={player2Won}
        />
      </View>

      {games.length > 0 ? (
        <View style={styles.gameGrid}>
          {games.map((game, gameIndex) => (
            <View key={`${game.a}-${game.b}-${gameIndex}`} style={styles.gameTile}>
              <AppText variant="xs" weight="semiBold" color={colors.textMuted}>
                GAME {gameIndex + 1}
              </AppText>
              <AppText variant="title" weight="bold">
                {game.a}-{game.b}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.metaGrid}>
        <View style={styles.metaTile}>
          <AppText variant="xs" color={colors.textMuted}>
            Final score
          </AppText>
          <AppText variant="body" weight="semiBold">
            {result.score ?? `${player1Score}-${player2Score}`}
          </AppText>
        </View>
        <View style={styles.metaTile}>
          <AppText variant="xs" color={colors.textMuted}>
            Prize received
          </AppText>
          <AppText variant="body" weight="semiBold" color={colors.primary}>
            {result.prize_money_received ? `Rs ${result.prize_money_received}` : '--'}
          </AppText>
        </View>
      </View>

      {result.result_notes ? (
        <View style={styles.noteBox}>
          <Ionicons name="document-text-outline" size={15} color={colors.primary} />
          <AppText variant="caption" color={colors.textSecondary} style={{ flex: 1 }}>
            {result.result_notes}
          </AppText>
        </View>
      ) : null}
    </Animated.View>
  );
}

function ResultScoreLine({
  anim,
  colors,
  maxScore,
  name,
  score,
  styles,
  won,
}: {
  anim: Animated.Value;
  colors: ReturnType<typeof useTheme>['colors'];
  maxScore: number;
  name: string;
  score: number;
  styles: ReturnType<typeof makeStyles>;
  won: boolean;
}) {
  const targetWidth = `${Math.max((score / maxScore) * 100, 5)}%`;
  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ['5%', targetWidth] });
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
        <Animated.View
          style={[
            styles.scoreFill,
            {
              backgroundColor: won ? colors.primary : colors.textMuted,
              width,
            },
          ]}
        />
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
    center: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 28,
    },
    scroll: {
      paddingBottom: 32,
      paddingHorizontal: 16,
    },
    hero: {
      backgroundColor: '#123C69',
      borderRadius: 18,
      overflow: 'hidden',
      padding: 18,
      position: 'relative',
    },
    courtLines: {
      borderColor: 'rgba(255,255,255,0.12)',
      borderRadius: 16,
      borderWidth: 1,
      bottom: 16,
      left: 18,
      position: 'absolute',
      right: 18,
      top: 18,
    },
    courtNet: {
      backgroundColor: 'rgba(255,255,255,0.18)',
      height: 1,
      left: 0,
      position: 'absolute',
      right: 0,
      top: '52%',
    },
    courtCenter: {
      backgroundColor: 'rgba(255,255,255,0.12)',
      bottom: 0,
      left: '50%',
      position: 'absolute',
      top: 0,
      width: 1,
    },
    heroTop: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    trophyCircle: {
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.14)',
      borderRadius: 999,
      height: 54,
      justifyContent: 'center',
      width: 54,
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
    heroTitle: {
      marginTop: 18,
    },
    heroSub: {
      marginTop: 6,
    },
    heroStats: {
      backgroundColor: 'rgba(255,255,255,0.11)',
      borderRadius: 14,
      flexDirection: 'row',
      gap: 12,
      marginTop: 18,
      padding: 12,
    },
    emptyCard: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      marginTop: 16,
      padding: 22,
    },
    emptyText: {
      marginTop: 6,
    },
    primaryAction: {
      alignItems: 'center',
      borderRadius: 12,
      flexDirection: 'row',
      gap: 6,
      marginTop: 16,
      paddingHorizontal: 16,
      paddingVertical: 11,
    },
    matchList: {
      gap: 14,
      marginTop: 16,
    },
    matchCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      padding: 15,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 8,
      elevation: 2,
    },
    matchHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
    },
    matchActions: {
      alignItems: 'flex-end',
      gap: 8,
    },
    updateButton: {
      alignItems: 'center',
      backgroundColor: colors.primaryLight,
      borderColor: colors.primary,
      borderRadius: 999,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
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
    winnerPanel: {
      backgroundColor: colors.primaryLight,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      marginTop: 14,
      padding: 12,
    },
    scoreRows: {
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
      height: 11,
      overflow: 'hidden',
    },
    scoreFill: {
      borderRadius: 999,
      height: 11,
    },
    gameGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 14,
    },
    gameTile: {
      backgroundColor: colors.background,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      minWidth: 90,
      padding: 10,
    },
    metaGrid: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 14,
    },
    metaTile: {
      backgroundColor: colors.background,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      flex: 1,
      padding: 10,
    },
    noteBox: {
      alignItems: 'flex-start',
      backgroundColor: colors.primaryLight,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 8,
      marginTop: 14,
      padding: 11,
    },
  });
}
