'use client';

import { useMemo, useState, useTransition } from 'react';

import { isMatchDecided, matchesInRound, roundLabel } from '~/lib/draw';
import type { Match, TournamentCategory } from '~/types';
import type { ActionResult } from '../state';
import MatchCard from './MatchCard';
import { advanceRound, clearDraw, generateDraw, publishDraw } from './actions';

export default function DrawManager({
  tournamentId,
  categories,
  matches,
  approvedByCategory,
}: {
  tournamentId: string;
  categories: TournamentCategory[];
  matches: Match[];
  approvedByCategory: Record<string, number>;
}) {
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [feedback, setFeedback] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const categoryMatches = useMemo(
    () => matches.filter((match) => match.category_id === categoryId),
    [matches, categoryId]
  );

  const rounds = useMemo(() => {
    const highest = categoryMatches.reduce((max, match) => Math.max(max, match.round), 0);
    return Array.from({ length: highest }, (_, index) => index + 1);
  }, [categoryMatches]);

  // Round 1's size fixes the bracket, so the labels (Final, Semi-final…) can be
  // worked out without knowing the entry list.
  const totalRounds = useMemo(() => {
    const firstRound = matchesInRound(categoryMatches, 1).length;
    return firstRound > 0 ? Math.log2(firstRound * 2) : 0;
  }, [categoryMatches]);

  const approved = approvedByCategory[categoryId] ?? 0;
  const hasDraw = categoryMatches.length > 0;
  const category = categories.find((item) => item.id === categoryId);

  const run = (work: () => Promise<ActionResult>) => {
    startTransition(async () => setFeedback(await work()));
  };

  const generate = () => {
    if (hasDraw) {
      const confirmed = window.confirm(
        'Regenerating deletes every match in this category, results included, and draws a ' +
          'fresh random round 1. Continue?'
      );
      if (!confirmed) return;
    }
    run(() => generateDraw(tournamentId, categoryId));
  };

  const clear = () => {
    const confirmed = window.confirm('Delete every match in this category? Results go too.');
    if (confirmed) run(() => clearDraw(tournamentId, categoryId));
  };

  if (categories.length === 0) {
    return <div className="card empty">Add a category before drawing anything.</div>;
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="chip-row">
        {categories.map((item) => (
          <button
            key={item.id}
            type="button"
            className="chip"
            data-active={categoryId === item.id}
            onClick={() => setCategoryId(item.id)}
          >
            {item.name} ({approvedByCategory[item.id] ?? 0})
          </button>
        ))}
      </div>

      {feedback ? (
        <p className={`alert ${feedback.ok ? 'alert-success' : 'alert-error'}`} role="status">
          {feedback.message}
        </p>
      ) : null}

      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap' }}>
          <div className="stack" style={{ gap: 2 }}>
            <h2>{category?.name}</h2>
            <span className="faint">
              {approved} approved {approved === 1 ? 'entry' : 'entries'}
              {hasDraw ? ` · ${categoryMatches.length} matches over ${rounds.length} rounds` : ''}
            </span>
          </div>
          <div className="row">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={generate}
              disabled={pending || approved < 2}
            >
              {hasDraw ? 'Regenerate draw' : 'Generate draw'}
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => run(() => publishDraw(tournamentId, categoryId))}
              disabled={pending || !hasDraw}
            >
              Publish to players
            </button>
            <button
              type="button"
              className="btn btn-sm btn-danger"
              onClick={clear}
              disabled={pending || !hasDraw}
            >
              Clear
            </button>
          </div>
        </div>

        {approved < 2 ? (
          <div className="empty">
            A draw needs at least two approved entries. This category has {approved}.
          </div>
        ) : !hasDraw ? (
          <div className="empty">
            No draw yet. Generating shuffles the {approved} approved entries into a knockout
            bracket, padding to a power of two with byes.
          </div>
        ) : null}
      </div>

      {rounds.map((round) => {
        const roundMatches = matchesInRound(categoryMatches, round);
        const complete = roundMatches.every(isMatchDecided);
        const hasNextRound = rounds.includes(round + 1);
        const isFinal = roundMatches.length === 1;

        return (
          <section key={round} className="card">
            <div className="card-header">
              <div className="stack" style={{ gap: 2 }}>
                <h2>{roundLabel(round, totalRounds)}</h2>
                <span className="faint">
                  {roundMatches.filter(isMatchDecided).length} of {roundMatches.length} decided
                </span>
              </div>
              {complete && !hasNextRound && !isFinal ? (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => run(() => advanceRound(tournamentId, categoryId, round))}
                  disabled={pending}
                >
                  Create {roundLabel(round + 1, totalRounds).toLowerCase()}
                </button>
              ) : null}
              {isFinal && complete ? (
                <span className="badge badge-approved">
                  Champion: {roundMatches[0]?.winner_name ?? '—'}
                </span>
              ) : null}
            </div>
            <div className="grid" style={{ padding: 12 }}>
              {roundMatches.map((match) => (
                <MatchCard
                  key={match.id}
                  tournamentId={tournamentId}
                  match={match}
                  onResult={setFeedback}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
