'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';

import { formatTimestamp } from '~/lib/format';
import { isDoublesCategory, type EntryView } from '~/lib/notes';
import { REGISTRATION_STATUSES, type TournamentCategory } from '~/types';
import { deleteEntry, moveEntryCategory, setEntryStatus, updateEntry } from './actions';
import { EMPTY_FORM_STATE, type ActionResult, type FormState } from './state';

interface Props {
  tournamentId: string;
  entry: EntryView;
  categories: TournamentCategory[];
  selected: boolean;
  onSelect: (registrationId: string, selected: boolean) => void;
  onResult: (result: ActionResult) => void;
}

export default function EntryRow({
  tournamentId,
  entry,
  categories,
  selected,
  onSelect,
  onResult,
}: Props) {
  const { registration } = entry;
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);

  const run = (work: () => Promise<ActionResult>) => {
    startTransition(async () => onResult(await work()));
  };

  const remove = () => {
    const confirmed = window.confirm(
      `Delete ${entry.displayName}'s entry? This removes the row entirely — ` +
        `use "rejected" instead if the player should just be declined.`
    );
    if (confirmed) run(() => deleteEntry(tournamentId, registration.id));
  };

  return (
    <>
      <tr style={{ opacity: pending ? 0.5 : 1 }}>
        <td>
          <input
            type="checkbox"
            aria-label={`Select ${entry.displayName}`}
            checked={selected}
            onChange={(event) => onSelect(registration.id, event.target.checked)}
            style={{ width: 16, height: 16, minHeight: 0 }}
          />
        </td>

        <td>
          <div className="stack" style={{ gap: 2 }}>
            <strong>{entry.displayName}</strong>
            {entry.partnerName ? (
              <span className="muted">with {entry.partnerName}</span>
            ) : null}
            {entry.freeNotes ? <span className="faint">{entry.freeNotes}</span> : null}
          </div>
        </td>

        <td>
          <div className="stack" style={{ gap: 2 }}>
            <span>{entry.phone ?? '—'}</span>
            <span className="faint">{entry.email ?? ''}</span>
          </div>
        </td>

        <td>
          <select
            value={registration.category_id}
            disabled={pending}
            onChange={(event) =>
              run(() => moveEntryCategory(tournamentId, registration.id, event.target.value))
            }
            style={{ minWidth: 150 }}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </td>

        <td>
          <select
            value={registration.status}
            disabled={pending}
            onChange={(event) =>
              run(() => setEntryStatus(tournamentId, registration.id, event.target.value))
            }
            style={{ minWidth: 120 }}
          >
            {REGISTRATION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </td>

        <td>
          <div className="stack" style={{ gap: 3 }}>
            <span className="badge">{entry.isManualEntry ? 'Added manually' : 'Self-registered'}</span>
            {entry.isWalkIn ? <span className="faint">No account · no push</span> : null}
          </div>
        </td>

        <td className="faint">{formatTimestamp(registration.created_at)}</td>

        <td>
          <div className="cell-actions">
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setEditing((open) => !open)}
              disabled={pending}
            >
              {editing ? 'Close' : 'Edit'}
            </button>
            <button type="button" className="btn btn-sm btn-danger" onClick={remove} disabled={pending}>
              Delete
            </button>
          </div>
        </td>
      </tr>

      {editing ? (
        <tr>
          <td colSpan={8} style={{ background: 'var(--surface-alt)' }}>
            <EditEntryForm
              tournamentId={tournamentId}
              entry={entry}
              isDoubles={isDoublesCategory(registration.category?.name)}
              onResult={onResult}
              onDone={() => setEditing(false)}
            />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function EditEntryForm({
  tournamentId,
  entry,
  isDoubles,
  onResult,
  onDone,
}: {
  tournamentId: string;
  entry: EntryView;
  isDoubles: boolean;
  onResult: (result: ActionResult) => void;
  onDone: () => void;
}) {
  const action = updateEntry.bind(null, tournamentId, entry.registration.id);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    EMPTY_FORM_STATE
  );

  useEffect(() => {
    if (!state.message) return;
    onResult(state);
    if (state.ok) onDone();
  }, [state, onResult, onDone]);

  return (
    <form action={formAction} className="stack" style={{ gap: 12 }}>
      <div className="form-grid">
        <label className="field">
          {isDoubles ? 'Player 1 name' : 'Player name'}
          <input name="playerName" defaultValue={entry.displayName} required />
        </label>
        <label className="field">
          Partner name
          <input name="partnerName" defaultValue={entry.partnerName ?? ''} />
        </label>
        <label className="field">
          Phone
          <input name="phone" defaultValue={entry.details.phone ?? ''} />
        </label>
        <label className="field">
          Partner phone
          <input name="partnerPhone" defaultValue={entry.details.partnerPhone ?? ''} />
        </label>
        <label className="field">
          Email
          <input name="email" type="email" defaultValue={entry.details.email ?? ''} />
        </label>
      </div>
      <label className="field">
        Notes
        <textarea name="notes" defaultValue={entry.freeNotes ?? ''} />
      </label>
      <div className="row">
        <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
          {pending ? 'Saving…' : 'Save changes'}
        </button>
        <button type="button" className="btn btn-sm" onClick={onDone} disabled={pending}>
          Cancel
        </button>
        <span className="faint">
          Edits the name and contact details stored on the entry. The player&apos;s own profile is
          untouched.
        </span>
      </div>
    </form>
  );
}
