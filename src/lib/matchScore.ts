export interface GameScore {
  a: string;
  b: string;
}

export interface ScoreSummary {
  player1Games: number;
  player2Games: number;
  player1Points: number;
  player2Points: number;
  scoreText: string;
  winnerSide: 1 | 2;
  completedGames: number;
}

export const MAX_GAMES = 3;

export function createEmptyGames(): GameScore[] {
  return Array.from({ length: MAX_GAMES }, () => ({ a: '', b: '' }));
}

/** Splits a stored score string ("21-18, 19-21, 21-15") into numeric games. */
export function parseGames(score: string | null) {
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

/** Rebuilds editable scorecard rows from a stored score string. */
export function gamesFromScoreText(score: string | null): GameScore[] {
  const parsed = parseGames(score).slice(0, MAX_GAMES);
  return createEmptyGames().map((game, index) =>
    parsed[index] ? { a: String(parsed[index].a), b: String(parsed[index].b) } : game
  );
}

export function hasPartialGame(games: GameScore[]) {
  return games.some(
    (game) => (game.a.trim() && !game.b.trim()) || (!game.a.trim() && game.b.trim())
  );
}

export function summarizeScore(games: GameScore[]): ScoreSummary | null {
  const completed = games
    .map((game) => ({ a: Number(game.a), b: Number(game.b), raw: game }))
    .filter(({ raw }) => raw.a.trim() && raw.b.trim())
    .filter(({ a, b }) => Number.isFinite(a) && Number.isFinite(b) && a >= 0 && b >= 0);

  if (completed.length === 0) return null;

  let player1Games = 0;
  let player2Games = 0;
  let player1Points = 0;
  let player2Points = 0;

  for (const game of completed) {
    if (game.a === game.b) return null;
    if (game.a > game.b) player1Games += 1;
    else player2Games += 1;
    player1Points += game.a;
    player2Points += game.b;
  }

  if (player1Games === player2Games) return null;

  return {
    player1Games,
    player2Games,
    player1Points,
    player2Points,
    scoreText: completed.map((game) => `${game.a}-${game.b}`).join(', '),
    winnerSide: player1Games > player2Games ? 1 : 2,
    completedGames: completed.length,
  };
}
