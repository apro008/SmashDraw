import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from '~/components/AppText';
import { SkeletonLoader } from '~/components/common/SkeletonLoader';
import { ResultEntrySheet } from '~/components/tournament/ResultEntrySheet';
import { useTheme } from '~/hooks/useTheme';
import { parseGames } from '~/lib/matchScore';
import {
  fetchTournamentById,
  fetchTournamentRegistrations,
  fetchTournamentResults,
  getDaysUntilClose,
  getResultAccess,
  isTournamentClosed,
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

/** Did this match involve the signed-in account? Matches store the registering user's id. */
function isMyMatch(result: TournamentMatchResult, userId?: string | null) {
  if (!userId) return false;
  return result.player1_id === userId || result.player2_id === userId;
}

function didIWin(result: TournamentMatchResult, userId?: string | null) {
  if (!userId) return false;
  if (result.winner_id) return result.winner_id === userId;
  // Older rows may only carry the winner name — fall back to matching the side.
  if (result.player1_id === userId) return result.winner_name === result.player1_name;
  if (result.player2_id === userId) return result.winner_name === result.player2_name;
  return false;
}

function wonSide(result: TournamentMatchResult, side: 1 | 2) {
  const playerId = side === 1 ? result.player1_id : result.player2_id;
  const playerName = side === 1 ? result.player1_name : result.player2_name;
  if (result.winner_id && playerId) return result.winner_id === playerId;
  return !!result.winner_name && result.winner_name === playerName;
}

interface CategoryGroup {
  categoryId: string;
  categoryName: string;
  matches: TournamentMatchResult[];
  champion: string | null;
}

/** Groups completed matches per category; the latest match in a category decides its champion. */
function groupByCategory(results: TournamentMatchResult[]): CategoryGroup[] {
  const groups = new Map<string, CategoryGroup>();
  for (const result of results) {
    const categoryId = result.category_id;
    const existing = groups.get(categoryId);
    if (existing) {
      existing.matches.push(result);
      continue;
    }
    groups.set(categoryId, {
      categoryId,
      categoryName: result.category?.name ?? 'Match Results',
      matches: [result],
      champion: null,
    });
  }

  return [...groups.values()].map((group) => {
    const decider = [...group.matches].sort((a, b) => b.match_number - a.match_number)[0];
    return { ...group, champion: decider?.winner_name ?? null };
  });
}

export default function TournamentResultScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const tournamentId = Array.isArray(id) ? id[0] : id;
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { showAlert } = useAlert();
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
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
      const access = getResultAccess(nextTournament, user?.id, profile?.role);
      // Contestant pickers need the entry list, so load it for organizers and admins alike.
      setRegistrations(access.canManage ? await fetchTournamentRegistrations(tournamentId) : []);
    } catch (err: any) {
      showAlert({
        type: 'danger',
        title: 'Unable to load results',
        message: err?.message ?? 'Please try again.',
      });
    } finally {
      setLoading(false);
    }
  }, [profile?.role, showAlert, tournamentId, user?.id]);

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

  const groups = useMemo(() => groupByCategory(results), [results]);
  const myMatches = useMemo(
    () => results.filter((result) => isMyMatch(result, user?.id)),
    [results, user?.id]
  );
  const myWins = myMatches.filter((result) => didIWin(result, user?.id)).length;
  const totalPrize = results.reduce((sum, result) => sum + (result.prize_money_received ?? 0), 0);
  const slideUp = entrance.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });

  const access = getResultAccess(tournament, user?.id, profile?.role);
  const canManageResults = access.canManage;
  const closed = !!tournament && isTournamentClosed(tournament);
  const daysUntilClose = tournament ? getDaysUntilClose(tournament) : 0;

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
                <Ionicons
                  name={closed ? 'lock-closed-outline' : 'stats-chart-outline'}
                  size={15}
                  color="#fff"
                />
                <AppText variant="caption" weight="semiBold" color="#fff">
                  {closed ? 'Closed' : results.length > 0 ? 'Live Results' : 'Results'}
                </AppText>
              </View>
            </View>
            <AppText variant="heading" weight="bold" color="#fff" style={styles.heroTitle}>
              {results.length > 0
                ? `${results.length} match${results.length === 1 ? '' : 'es'} played`
                : 'Results pending'}
            </AppText>
            <AppText variant="body" color="rgba(255,255,255,0.72)" style={styles.heroSub}>
              {results.length > 0
                ? closed
                  ? 'Final standings for this tournament.'
                  : 'Scorecards are published as matches finish.'
                : 'The organizer has not uploaded a completed match yet.'}
            </AppText>
            <View style={styles.heroStats}>
              <HeroStat label="Matches" value={String(results.length)} />
              <HeroStat label="Categories" value={String(groups.length)} />
              <HeroStat label="Prize" value={totalPrize > 0 ? `Rs ${totalPrize}` : '--'} />
            </View>
          </View>
        </Animated.View>

        {/* Viewer's own record — only meaningful for a player who competed */}
        {myMatches.length > 0 ? (
          <View style={styles.myCard}>
            <View style={styles.myHeader}>
              <View style={styles.myIcon}>
                <Ionicons name="person" size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="bodyLg" weight="semiBold">
                  Your Matches
                </AppText>
                <AppText variant="xs" color={colors.textMuted}>
                  How you finished in this tournament
                </AppText>
              </View>
            </View>
            <View style={styles.myStatsRow}>
              <MyStat colors={colors} label="Played" value={String(myMatches.length)} />
              <MyStat colors={colors} color={colors.win} label="Won" value={String(myWins)} />
              <MyStat
                colors={colors}
                color={colors.loss}
                label="Lost"
                value={String(myMatches.length - myWins)}
              />
            </View>
            <View style={styles.myList}>
              {myMatches.map((result) => {
                const won = didIWin(result, user?.id);
                const opponent =
                  result.player1_id === user?.id ? result.player2_name : result.player1_name;
                return (
                  <View key={`mine-${result.id}`} style={styles.myRow}>
                    <View
                      style={[
                        styles.myOutcome,
                        { backgroundColor: won ? colors.win + '1A' : colors.loss + '1A' },
                      ]}
                    >
                      <AppText variant="xs" weight="bold" color={won ? colors.win : colors.loss}>
                        {won ? 'W' : 'L'}
                      </AppText>
                    </View>
                    <View style={{ flex: 1 }}>
                      <AppText variant="caption" weight="semiBold" numberOfLines={1}>
                        vs {opponent ?? 'Opponent'}
                      </AppText>
                      <AppText variant="xs" color={colors.textMuted} numberOfLines={1}>
                        {result.category?.name ?? 'Match'} · #{result.match_number}
                      </AppText>
                    </View>
                    <AppText variant="caption" weight="semiBold" color={colors.textSecondary}>
                      {result.score ?? '--'}
                    </AppText>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Category champions */}
        {groups.length > 0 ? (
          <View style={styles.championCard}>
            <AppText variant="label" weight="semiBold" color={colors.textMuted}>
              {closed ? 'CHAMPIONS' : 'LEADING SO FAR'}
            </AppText>
            <View style={styles.championList}>
              {groups.map((group) => (
                <View key={`champ-${group.categoryId}`} style={styles.championRow}>
                  <Ionicons name="trophy" size={15} color="#B45309" />
                  <AppText variant="caption" color={colors.textSecondary} style={{ flex: 1 }}>
                    {group.categoryName}
                  </AppText>
                  <AppText variant="caption" weight="semiBold" numberOfLines={1}>
                    {group.champion ?? 'TBD'}
                  </AppText>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {canManageResults ? (
          <View style={styles.managerBar}>
            <View style={{ flex: 1 }}>
              <AppText variant="caption" weight="semiBold">
                {access.isAdmin && closed ? 'Admin edit access' : 'Organizer tools'}
              </AppText>
              <AppText variant="xs" color={colors.textMuted}>
                {closed
                  ? 'This tournament is closed. Admins can still correct any result.'
                  : `Results stay editable for ${daysUntilClose} more day${daysUntilClose === 1 ? '' : 's'}.`}
              </AppText>
            </View>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => openUpdateSheet(null)}
              style={[styles.primaryAction, { backgroundColor: colors.primary, marginTop: 0 }]}
            >
              <Ionicons name="add" size={16} color="#fff" />
              <AppText variant="xs" weight="semiBold" color="#fff">
                Add Match
              </AppText>
            </TouchableOpacity>
          </View>
        ) : null}

        {results.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="document-text-outline" size={42} color={colors.textMuted} />
            <AppText variant="title" weight="semiBold" center style={{ marginTop: 10 }}>
              No result uploaded yet
            </AppText>
            <AppText variant="body" color={colors.textSecondary} center style={styles.emptyText}>
              {closed
                ? 'This tournament closed without any published scorecard.'
                : 'Scorecards appear here as soon as the organizer uploads a completed match.'}
            </AppText>
            {canManageResults ? (
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
          groups.map((group) => (
            <View key={group.categoryId} style={styles.groupBlock}>
              <View style={styles.groupHeader}>
                <AppText variant="title" weight="semiBold" style={{ flex: 1 }}>
                  {group.categoryName}
                </AppText>
                <AppText variant="xs" color={colors.textMuted}>
                  {group.matches.length} match{group.matches.length === 1 ? '' : 'es'}
                </AppText>
              </View>
              <View style={styles.matchList}>
                {group.matches.map((result, index) => (
                  <AnimatedMatchCard
                    canUpdate={canManageResults}
                    colors={colors}
                    index={index}
                    isMine={isMyMatch(result, user?.id)}
                    key={result.id}
                    onUpdate={() => openUpdateSheet(result)}
                    result={result}
                    styles={styles}
                    userId={user?.id}
                  />
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
      {canManageResults ? (
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

function MyStat({
  color,
  colors,
  label,
  value,
}: {
  color?: string;
  colors: ReturnType<typeof useTheme>['colors'];
  label: string;
  value: string;
}) {
  return (
    <View style={{ flex: 1 }}>
      <AppText variant="xs" color={colors.textMuted}>
        {label}
      </AppText>
      <AppText variant="title" weight="bold" color={color ?? colors.text}>
        {value}
      </AppText>
    </View>
  );
}

function AnimatedMatchCard({
  canUpdate,
  colors,
  index,
  isMine,
  onUpdate,
  result,
  styles,
  userId,
}: {
  canUpdate: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
  index: number;
  isMine: boolean;
  onUpdate: () => void;
  result: TournamentMatchResult;
  styles: ReturnType<typeof makeStyles>;
  userId?: string | null;
}) {
  const cardAnim = useRef(new Animated.Value(0)).current;
  const barAnim = useRef(new Animated.Value(0)).current;
  const games = parseGames(result.score);
  const player1Score = result.player1_score ?? 0;
  const player2Score = result.player2_score ?? 0;
  const maxScore = Math.max(player1Score, player2Score, 1);
  const player1Won = wonSide(result, 1);
  const player2Won = wonSide(result, 2);
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
    <Animated.View
      style={[
        styles.matchCard,
        isMine ? styles.matchCardMine : null,
        { opacity: cardAnim, transform: [{ translateY }] },
      ]}
    >
      <View style={styles.matchHeader}>
        <View style={{ flex: 1 }}>
          <AppText variant="bodyLg" weight="bold">
            Match #{result.match_number}
          </AppText>
          <AppText variant="caption" color={colors.textMuted}>
            {result.category?.name ?? 'Match Result'}
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
          {isMine ? (
            <View
              style={[
                styles.mineBadge,
                {
                  backgroundColor: didIWin(result, userId) ? colors.win + '1A' : colors.loss + '1A',
                  borderColor: didIWin(result, userId) ? colors.win : colors.loss,
                },
              ]}
            >
              <AppText
                variant="xs"
                weight="semiBold"
                color={didIWin(result, userId) ? colors.win : colors.loss}
              >
                {didIWin(result, userId) ? 'You won' : 'You lost'}
              </AppText>
            </View>
          ) : (
            <View style={styles.winnerBadge}>
              <Ionicons name="trophy-outline" size={14} color="#B45309" />
              <AppText variant="xs" weight="semiBold" color="#B45309">
                Winner
              </AppText>
            </View>
          )}
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
          isViewer={!!userId && result.player1_id === userId}
          maxScore={maxScore}
          name={result.player1_name ?? 'Side A'}
          score={player1Score}
          styles={styles}
          won={player1Won}
        />
        <ResultScoreLine
          anim={barAnim}
          colors={colors}
          isViewer={!!userId && result.player2_id === userId}
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
            Games won
          </AppText>
          <AppText variant="body" weight="semiBold">
            {player1Score}-{player2Score}
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
  isViewer,
  maxScore,
  name,
  score,
  styles,
  won,
}: {
  anim: Animated.Value;
  colors: ReturnType<typeof useTheme>['colors'];
  isViewer: boolean;
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
        <AppText variant="caption" weight={won ? 'semiBold' : 'regular'} numberOfLines={1}>
          {name}
        </AppText>
        {isViewer ? (
          <View style={styles.youChip}>
            <AppText variant="xs" weight="semiBold" color={colors.primary}>
              You
            </AppText>
          </View>
        ) : null}
        <View style={{ flex: 1 }} />
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
    myCard: {
      backgroundColor: colors.surface,
      borderColor: colors.primary + '40',
      borderRadius: 16,
      borderWidth: 1,
      marginTop: 16,
      padding: 15,
    },
    myHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
    },
    myIcon: {
      alignItems: 'center',
      backgroundColor: colors.primaryLight,
      borderRadius: 999,
      height: 34,
      justifyContent: 'center',
      width: 34,
    },
    myStatsRow: {
      backgroundColor: colors.background,
      borderRadius: 12,
      flexDirection: 'row',
      gap: 10,
      marginTop: 12,
      padding: 12,
    },
    myList: {
      gap: 8,
      marginTop: 12,
    },
    myRow: {
      alignItems: 'center',
      backgroundColor: colors.background,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 10,
      padding: 10,
    },
    myOutcome: {
      alignItems: 'center',
      borderRadius: 999,
      height: 28,
      justifyContent: 'center',
      width: 28,
    },
    championCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      marginTop: 14,
      padding: 15,
    },
    championList: {
      gap: 10,
      marginTop: 10,
    },
    championRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    managerBar: {
      alignItems: 'center',
      backgroundColor: colors.primaryLight,
      borderColor: colors.primary + '40',
      borderRadius: 14,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 10,
      marginTop: 14,
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
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    groupBlock: {
      marginTop: 20,
    },
    groupHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
      marginBottom: 10,
    },
    matchList: {
      gap: 14,
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
    matchCardMine: {
      borderColor: colors.primary,
      borderWidth: 1.5,
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
    mineBadge: {
      borderRadius: 999,
      borderWidth: 1,
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
      gap: 8,
    },
    youChip: {
      backgroundColor: colors.primaryLight,
      borderColor: colors.primary,
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 7,
      paddingVertical: 2,
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
