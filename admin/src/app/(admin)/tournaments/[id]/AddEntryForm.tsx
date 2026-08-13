'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';

import PlayerPicker from '~/components/PlayerPicker';
import { isDoublesCategory } from '~/lib/notes';
import { REGISTRATION_STATUSES, type PlayerSummary, type TournamentCategory } from '~/types';
import { addEntry, lookupPlayers } from './actions';
import { EMPTY_FORM_STATE, type FormState } from './state';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? 'Adding…' : 'Add entry'}
    </button>
  );
}

export default function AddEntryForm({
  tournamentId,
  categories,
  defaultCategoryId,
  onResult,
}: {
  tournamentId: string;
  categories: TournamentCategory[];
  defaultCategoryId: string | null;
  onResult: (result: { ok: boolean; message: string }) => void;
}) {
  const action = addEntry.bind(null, tournamentId);
  const [state, formAction] = useActionState<FormState, FormData>(action, EMPTY_FORM_STATE);

  const formRef = useRef<HTMLFormElement>(null);
  const [categoryId, setCategoryId] = useState(defaultCategoryId ?? categories[0]?.id ?? '');
  const [linkedPlayer, setLinkedPlayer] = useState<PlayerSummary | null>(null);

  const category = categories.find((item) => item.id === categoryId);
  const isDoubles = isDoublesCategory(category?.name);

  useEffect(() => {
    if (!state.message) return;
    onResult(state);
    if (state.ok) {
      formRef.current?.reset();
      setLinkedPlayer(null);
    }
    // `version` only changes on a successful write, which is what makes a second
    // identical add re-run this instead of looking like the same state.
  }, [state, onResult]);

  return (
    <form ref={formRef} action={formAction} className="card-pad stack" style={{ gap: 14 }}>
      <input type="hidden" name="userId" value={linkedPlayer?.id ?? ''} />

      <div className="form-grid">
        <label className="field">
          Category
          <select
            name="categoryId"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            required
          >
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.current_players}/{item.max_players})
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          {isDoubles ? 'Player 1 name' : 'Player name'}
          <input name="playerName" required placeholder="Full name" />
        </label>

        {isDoubles ? (
          <label className="field">
            Partner name
            <input name="partnerName" placeholder="Full name" />
          </label>
        ) : null}

        <label className="field">
          Phone
          <input name="phone" inputMode="tel" placeholder="Optional" />
        </label>

        {isDoubles ? (
          <label className="field">
            Partner phone
            <input name="partnerPhone" inputMode="tel" placeholder="Optional" />
          </label>
        ) : null}

        <label className="field">
          Email
          <input name="email" type="email" placeholder="Optional" />
        </label>

        <label className="field">
          Status
          <select name="status" defaultValue="approved">
            {REGISTRATION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="field">
        Link to a SmashDraw account
        <PlayerPicker
          value={linkedPlayer}
          onChange={setLinkedPlayer}
          search={lookupPlayers}
          placeholder="Search name or email to link an account (optional)"
        />
      </label>

      <label className="field">
        Notes
        <textarea name="notes" placeholder="Seeding request, payment reference, timing…" />
      </label>

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="faint">
          {linkedPlayer
            ? 'Linked — this player will get push notifications for decisions and matches.'
            : 'Unlinked walk-in — no account, so no push notifications.'}
        </span>
        <SubmitButton />
      </div>
    </form>
  );
}
