'use client';

import { useActionState, useEffect, useState } from 'react';

import { REGISTRATION_STATUSES, USER_ROLES, type RegistrationStatus, type UserRole } from '~/types';
import { previewAudience, sendNotification } from './actions';
import { EMPTY_COMPOSER_STATE, type ComposerState } from './state';

type Mode = 'tournament' | 'users';

interface Props {
  tournaments: { id: string; title: string; start_date: string }[];
  cities: string[];
  states: string[];
}

/**
 * Two-step composer: resolve the audience first, then confirm the count.
 *
 * The fields are controlled so the confirm step can post exactly what was
 * previewed — the server resolves the audience a second time and refuses to send
 * if the number moved in between.
 */
export default function NotificationComposer({ tournaments, cities, states }: Props) {
  const [mode, setMode] = useState<Mode>('tournament');
  const [tournamentId, setTournamentId] = useState(tournaments[0]?.id ?? '');
  const [statuses, setStatuses] = useState<RegistrationStatus[]>(['approved', 'waitlisted']);
  const [role, setRole] = useState<UserRole | 'all'>('all');
  const [city, setCity] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const [preview, previewAction, previewing] = useActionState<ComposerState, FormData>(
    previewAudience,
    EMPTY_COMPOSER_STATE
  );
  const [sent, sendAction, sending] = useActionState<ComposerState, FormData>(
    sendNotification,
    EMPTY_COMPOSER_STATE
  );

  // Clear the draft once it has gone out, so a stray second click cannot repeat it.
  useEffect(() => {
    if (sent.ok && sent.message) {
      setTitle('');
      setBody('');
    }
  }, [sent.ok, sent.message]);

  const pending = previewing || sending;
  // A send result supersedes the preview; a fresh preview supersedes an old send.
  const active = sent.message && !preview.preview ? sent : preview;
  const confirmable = preview.preview && !(sent.ok && sent.message);

  const toggleStatus = (status: RegistrationStatus) =>
    setStatuses((current) =>
      current.includes(status) ? current.filter((item) => item !== status) : [...current, status]
    );

  const audienceFields = (
    <>
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="tournament_id" value={mode === 'tournament' ? tournamentId : ''} />
      {mode === 'tournament' ? (
        statuses.map((status) => (
          <input key={status} type="hidden" name="statuses" value={status} />
        ))
      ) : (
        <>
          <input type="hidden" name="role" value={role} />
          <input type="hidden" name="city" value={city} />
          <input type="hidden" name="state" value={stateFilter} />
        </>
      )}
    </>
  );

  return (
    <div className="stack" style={{ gap: 16 }}>
      {active.message ? (
        <p className={`alert ${active.ok ? 'alert-success' : 'alert-error'}`} role="status">
          {active.message}
        </p>
      ) : null}

      <form action={previewAction} className="card">
        <div className="card-header">
          <h2>Compose</h2>
          <div className="chip-row">
            <button
              type="button"
              className="chip"
              data-active={mode === 'tournament'}
              onClick={() => setMode('tournament')}
            >
              A tournament&rsquo;s players
            </button>
            <button
              type="button"
              className="chip"
              data-active={mode === 'users'}
              onClick={() => setMode('users')}
            >
              By city, state or role
            </button>
          </div>
        </div>

        <div className="card-pad stack" style={{ gap: 14 }}>
          {mode === 'tournament' ? (
            <div className="stack" style={{ gap: 10 }}>
              <label className="field">
                Tournament
                <select
                  value={tournamentId}
                  onChange={(event) => setTournamentId(event.target.value)}
                  required
                >
                  {tournaments.length === 0 ? <option value="">No tournaments yet</option> : null}
                  {tournaments.map((tournament) => (
                    <option key={tournament.id} value={tournament.id}>
                      {tournament.title}
                    </option>
                  ))}
                </select>
              </label>
              <div className="stack" style={{ gap: 6 }}>
                <span className="faint">Entry status</span>
                <div className="chip-row">
                  {REGISTRATION_STATUSES.map((status) => (
                    <button
                      key={status}
                      type="button"
                      className="chip"
                      data-active={statuses.includes(status)}
                      onClick={() => toggleStatus(status)}
                    >
                      {status}
                    </button>
                  ))}
                </div>
                <span className="faint">
                  Walk-in entries with no account are skipped — they have nowhere to receive it.
                </span>
              </div>
            </div>
          ) : (
            <div className="stack" style={{ gap: 6 }}>
              <div className="form-grid">
                <label className="field">
                  Role
                  <select
                    value={role}
                    onChange={(event) => setRole(event.target.value as UserRole | 'all')}
                  >
                    <option value="all">any role</option>
                    {USER_ROLES.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  City
                  <input
                    list="notify-cities"
                    value={city}
                    placeholder="any city"
                    onChange={(event) => setCity(event.target.value)}
                  />
                  <datalist id="notify-cities">
                    {cities.map((option) => (
                      <option key={option} value={option} />
                    ))}
                  </datalist>
                </label>
                <label className="field">
                  State
                  <input
                    list="notify-states"
                    value={stateFilter}
                    placeholder="any state"
                    onChange={(event) => setStateFilter(event.target.value)}
                  />
                  <datalist id="notify-states">
                    {states.map((option) => (
                      <option key={option} value={option} />
                    ))}
                  </datalist>
                </label>
              </div>
              <span className="faint">
                Leaving all three unset reaches every account on the platform. The count on the next
                step tells you how many that is before anything goes out.
              </span>
            </div>
          )}

          <label className="field">
            Title
            <input
              name="title"
              value={title}
              placeholder="Schedule change"
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </label>
          <label className="field">
            Message
            <textarea
              name="body"
              value={body}
              placeholder="Matches on court 2 are running 40 minutes late."
              onChange={(event) => setBody(event.target.value)}
              required
            />
          </label>

          {audienceFields}

          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={pending}>
              {previewing ? 'Checking…' : 'Preview audience'}
            </button>
          </div>
        </div>
      </form>

      {confirmable && preview.preview ? (
        <form action={sendAction} className="card">
          <div className="card-header">
            <h2>Confirm</h2>
            <span className="badge badge-pending">
              {preview.preview.count} {preview.preview.count === 1 ? 'recipient' : 'recipients'}
            </span>
          </div>
          <div className="card-pad stack" style={{ gap: 14 }}>
            <p className="alert alert-info" style={{ margin: 0 }}>
              This reaches <strong>{preview.preview.count}</strong>{' '}
              {preview.preview.count === 1 ? 'person' : 'people'} — {preview.preview.label}. A push
              cannot be recalled once sent.
            </p>

            {/* What the notification will look like in the feed. */}
            <div
              className="stack"
              style={{
                gap: 4,
                padding: 14,
                borderRadius: 12,
                background: 'var(--surface-alt)',
                border: '1px solid var(--border)',
              }}
            >
              <strong>{preview.preview.title}</strong>
              <span className="muted" style={{ whiteSpace: 'pre-wrap' }}>
                {preview.preview.body}
              </span>
            </div>

            <input type="hidden" name="title" value={preview.preview.title} />
            <input type="hidden" name="body" value={preview.preview.body} />
            <input type="hidden" name="confirmed_count" value={preview.preview.count} />
            {audienceFields}

            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" disabled={pending}>
                {sending ? 'Sending…' : `Send to ${preview.preview.count}`}
              </button>
            </div>
          </div>
        </form>
      ) : null}
    </div>
  );
}
