'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';

import { isMatchDecided } from '~/lib/draw';
import type { Match } from '~/types';
import { EMPTY_FORM_STATE, type ActionResult, type FormState } from '../state';
import { setMatchWinner, updateMatch } from './actions';

const MATCH_STATUSES: Match['status'][] = ['scheduled', 'live', 'completed', 'walkover'];

/** `datetime-local` wants `YYYY-MM-DDTHH:mm` in local time, not an ISO string. */
function toLocalInputValue(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const pad = (n: number) => `${n}`.padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

export default function MatchCard({
  tournamentId,
  match,
  onResult,
}: {
  tournamentId: string;
  match: Match;
  onResult: (result: ActionResult) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  const decided = isMatchDecided(match);
  const side1Won = decided && match.winner_name === match.player1_name;
  const side2Won = decided && match.winner_name === match.player2_name;

  const pickWinner = (side: 1 | 2) => {
    startTransition(async () => onResult(await setMatchWinner(tournamentId, match.id, side)));
  };

  return (
    <div className="card card-pad stack" style={{ gap: 10, opacity: pending ? 0.5 : 1 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="faint">Match {match.match_number}</span>
        <span className={`badge badge-${match.status === 'completed' ? 'approved' : match.status}`}>
          {match.status}
        </span>
      </div>

      <div className="stack" style={{ gap: 6 }}>
        <Side
          name={match.player1_name}
          score={match.player1_score}
          won={side1Won}
          disabled={pending || !match.player1_name}
          onPick={() => pickWinner(1)}
        />
        <Side
          name={match.player2_name}
          score={match.player2_score}
          won={side2Won}
          disabled={pending || !match.player2_name}
          onPick={() => pickWinner(2)}
          isBye={match.status === 'walkover' && !match.player2_name}
        />
      </div>

      {match.court_number || match.scheduled_at ? (
        <span className="faint">
          {match.court_number ? `Court ${match.court_number}` : ''}
          {match.court_number && match.scheduled_at ? ' · ' : ''}
          {match.scheduled_at ? new Date(match.scheduled_at).toLocaleString() : ''}
        </span>
      ) : null}

      <button
        type="button"
        className="btn btn-sm"
        onClick={() => setEditing((open) => !open)}
        disabled={pending}
      >
        {editing ? 'Close' : 'Edit match'}
      </button>

      {editing ? (
        <MatchForm
          tournamentId={tournamentId}
          match={match}
          onResult={onResult}
          onDone={() => setEditing(false)}
        />
      ) : null}
    </div>
  );
}

function Side({
  name,
  score,
  won,
  disabled,
  onPick,
  isBye = false,
}: {
  name: string | null;
  score: number | null;
  won: boolean;
  disabled: boolean;
  onPick: () => void;
  isBye?: boolean;
}) {
  return (
    <div
      className="row"
      style={{
        justifyContent: 'space-between',
        padding: '6px 8px',
        borderRadius: 8,
        background: won ? 'var(--success-soft)' : 'var(--surface-alt)',
        color: won ? 'var(--success)' : 'inherit',
        fontWeight: won ? 600 : 400,
      }}
    >
      <span>{isBye ? 'Bye' : (name ?? 'TBD')}</span>
      <span className="row" style={{ gap: 8 }}>
        {score !== null ? <span>{score}</span> : null}
        {!isBye && name ? (
          <button type="button" className="btn-link" onClick={onPick} disabled={disabled}>
            {won ? 'Winner' : 'Wins'}
          </button>
        ) : null}
      </span>
    </div>
  );
}

function MatchForm({
  tournamentId,
  match,
  onResult,
  onDone,
}: {
  tournamentId: string;
  match: Match;
  onResult: (result: ActionResult) => void;
  onDone: () => void;
}) {
  const action = updateMatch.bind(null, tournamentId, match.id);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    EMPTY_FORM_STATE
  );

  useEffect(() => {
    if (!state.message) return;
    onResult(state);
    if (state.ok) onDone();
  }, [state, onResult, onDone]);

  const winnerDefault = match.winner_name
    ? match.winner_name === match.player1_name
      ? '1'
      : '2'
    : '';

  return (
    <form action={formAction} className="stack" style={{ gap: 10 }}>
      <div className="form-grid">
        <label className="field">
          Side 1
          <input name="player1_name" defaultValue={match.player1_name ?? ''} />
        </label>
        <label className="field">
          Side 1 score
          <input name="player1_score" type="number" defaultValue={match.player1_score ?? ''} />
        </label>
        <label className="field">
          Side 2
          <input name="player2_name" defaultValue={match.player2_name ?? ''} />
        </label>
        <label className="field">
          Side 2 score
          <input name="player2_score" type="number" defaultValue={match.player2_score ?? ''} />
        </label>
        <label className="field">
          Winner
          <select name="winner" defaultValue={winnerDefault}>
            <option value="">Undecided</option>
            <option value="1">Side 1</option>
            <option value="2">Side 2</option>
          </select>
        </label>
        <label className="field">
          Status
          <select name="status" defaultValue={match.status}>
            {MATCH_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Court
          <input name="court_number" type="number" min={1} defaultValue={match.court_number ?? ''} />
        </label>
        <label className="field">
          Scheduled for
          <input
            name="scheduled_at"
            type="datetime-local"
            defaultValue={toLocalInputValue(match.scheduled_at)}
          />
        </label>
        <label className="field">
          Prize money
          <input
            name="prize_money_received"
            type="number"
            defaultValue={match.prize_money_received ?? ''}
          />
        </label>
      </div>
      <label className="field">
        Result notes
        <textarea name="result_notes" defaultValue={match.result_notes ?? ''} />
      </label>
      <div className="row">
        <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
          {pending ? 'Saving…' : 'Save match'}
        </button>
        <button type="button" className="btn btn-sm" onClick={onDone} disabled={pending}>
          Cancel
        </button>
      </div>
      <span className="faint">
        Setting a schedule or a result sends both players a push, same as the app does.
      </span>
    </form>
  );
}
