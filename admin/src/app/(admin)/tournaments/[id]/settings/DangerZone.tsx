'use client';

import { useState, useTransition } from 'react';

import { deleteTournament } from '../../actions';

/**
 * Deleting cascades to categories, registrations, matches and notifications, so
 * it asks for the title to be typed rather than settling for a confirm box.
 */
export default function DangerZone({
  tournamentId,
  title,
}: {
  tournamentId: string;
  title: string;
}) {
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const matches = confirmation.trim() === title.trim();

  return (
    <section className="card" style={{ borderColor: 'var(--danger)' }}>
      <div className="card-header" style={{ borderColor: 'var(--danger)' }}>
        <h2 style={{ color: 'var(--danger)' }}>Delete this tournament</h2>
      </div>
      <div className="card-pad stack" style={{ gap: 12 }}>
        <p className="muted" style={{ margin: 0 }}>
          Removes the tournament and everything hanging off it — categories, every registration and
          walk-in, all matches and results, and the notifications that referenced it. There is no
          undo.
        </p>
        {error ? <p className="alert alert-error">{error}</p> : null}
        <label className="field">
          Type <strong>{title}</strong> to confirm
          <input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder={title}
          />
        </label>
        <div>
          <button
            type="button"
            className="btn btn-danger"
            disabled={!matches || pending}
            onClick={() =>
              startTransition(async () => {
                const result = await deleteTournament(tournamentId);
                // A successful delete redirects, so anything returned is a failure.
                if (result && !result.ok) setError(result.message);
              })
            }
          >
            {pending ? 'Deleting…' : 'Delete permanently'}
          </button>
        </div>
      </div>
    </section>
  );
}
