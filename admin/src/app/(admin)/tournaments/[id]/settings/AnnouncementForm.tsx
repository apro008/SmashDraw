'use client';

import { useActionState } from 'react';

import { sendAnnouncement } from '../../actions';
import { EMPTY_FORM_STATE, type FormState } from '../state';

/** Free-text notification to everyone approved or waitlisted. */
export default function AnnouncementForm({ tournamentId }: { tournamentId: string }) {
  const action = sendAnnouncement.bind(null, tournamentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    EMPTY_FORM_STATE
  );

  return (
    <section className="card">
      <div className="card-header">
        <h2>Send an announcement</h2>
      </div>
      <form action={formAction} className="card-pad stack" style={{ gap: 12 }}>
        {state.message ? (
          <p className={`alert ${state.ok ? 'alert-success' : 'alert-error'}`} role="status">
            {state.message}
          </p>
        ) : null}
        <div className="form-grid">
          <label className="field">
            Title
            <input name="title" placeholder="Schedule change" required />
          </label>
        </div>
        <label className="field">
          Message
          <textarea
            name="body"
            placeholder="Matches on court 2 are running 40 minutes late."
            required
          />
        </label>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="faint">
            Goes to every approved and waitlisted entry with an account. Walk-ins are skipped.
          </span>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </form>
    </section>
  );
}
