'use client';

import { useActionState, useEffect, useState } from 'react';

import PlayerPicker from '~/components/PlayerPicker';
import { TOURNAMENT_STATUSES, type PlayerSummary, type Tournament } from '~/types';
import { createTournament, lookupOrganizers, updateTournament } from './actions';
import { EMPTY_FORM_STATE, type FormState } from './[id]/state';

/**
 * One form for both create and edit. Every column the live `tournaments` table
 * has is editable here — the app lets an organizer edit only their own, and
 * gives admins no way to create one at all.
 */
export default function TournamentForm({ tournament }: { tournament?: Tournament }) {
  const action = tournament
    ? updateTournament.bind(null, tournament.id)
    : (createTournament as (state: FormState, formData: FormData) => Promise<FormState>);

  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    EMPTY_FORM_STATE
  );

  const [organizer, setOrganizer] = useState<PlayerSummary | null>(
    tournament
      ? {
          id: tournament.organizer_id,
          name: tournament.organizer_name,
          email: null,
          phone: null,
          city: null,
          state: null,
        }
      : null
  );

  // Keep the denormalised `organizer_name` column in step with the picked account.
  const [organizerName, setOrganizerName] = useState(tournament?.organizer_name ?? '');

  useEffect(() => {
    if (organizer) setOrganizerName(organizer.name);
  }, [organizer]);

  return (
    <form action={formAction} className="stack" style={{ gap: 16 }}>
      <input type="hidden" name="organizer_id" value={organizer?.id ?? ''} />
      <input type="hidden" name="organizer_name" value={organizerName} />

      {state.message ? (
        <p className={`alert ${state.ok ? 'alert-success' : 'alert-error'}`} role="status">
          {state.message}
        </p>
      ) : null}

      <section className="card">
        <div className="card-header">
          <h2>Basics</h2>
        </div>
        <div className="card-pad stack" style={{ gap: 12 }}>
          <label className="field">
            Title
            <input name="title" defaultValue={tournament?.title ?? ''} required />
          </label>
          <label className="field">
            Description
            <textarea name="description" defaultValue={tournament?.description ?? ''} />
          </label>
          <div className="form-grid">
            <label className="field">
              Status
              <select name="status" defaultValue={tournament?.status ?? 'draft'}>
                {TOURNAMENT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Prize pool
              <input
                name="prize_pool"
                defaultValue={tournament?.prize_pool ?? ''}
                placeholder="₹25,000"
              />
            </label>
            <label className="field">
              Max courts
              <input
                name="max_courts"
                type="number"
                min={1}
                defaultValue={tournament?.max_courts ?? ''}
              />
            </label>
          </div>
          <label className="field">
            Organizer
            <PlayerPicker
              value={organizer}
              onChange={setOrganizer}
              search={lookupOrganizers}
              placeholder="Search the account that owns this tournament…"
              linkedLabel="Organiser:"
            />
          </label>
          <label className="field">
            Organizer display name
            <input
              value={organizerName}
              onChange={(event) => setOrganizerName(event.target.value)}
              placeholder="Shown on the tournament card"
            />
          </label>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h2>Dates</h2>
        </div>
        <div className="card-pad form-grid">
          <label className="field">
            Start date
            <input
              name="start_date"
              type="date"
              defaultValue={tournament?.start_date ?? ''}
              required
            />
          </label>
          <label className="field">
            End date
            <input name="end_date" type="date" defaultValue={tournament?.end_date ?? ''} required />
          </label>
          <label className="field">
            Registration deadline
            <input
              name="registration_deadline"
              type="date"
              defaultValue={tournament?.registration_deadline ?? ''}
              required
            />
          </label>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h2>Venue</h2>
        </div>
        <div className="card-pad stack" style={{ gap: 12 }}>
          <div className="form-grid">
            <label className="field">
              Venue
              <input name="venue" defaultValue={tournament?.venue ?? ''} required />
            </label>
            <label className="field">
              City
              <input name="city" defaultValue={tournament?.city ?? ''} required />
            </label>
            <label className="field">
              State
              <input name="state" defaultValue={tournament?.state ?? ''} required />
            </label>
          </div>
          <label className="field">
            Address
            <input name="venue_address" defaultValue={tournament?.venue_address ?? ''} />
          </label>
          <div className="form-grid">
            <label className="field">
              Map URL
              <input name="venue_map_url" defaultValue={tournament?.venue_map_url ?? ''} />
            </label>
            <label className="field">
              Latitude
              <input
                name="venue_latitude"
                type="number"
                step="any"
                defaultValue={tournament?.venue_latitude ?? ''}
              />
            </label>
            <label className="field">
              Longitude
              <input
                name="venue_longitude"
                type="number"
                step="any"
                defaultValue={tournament?.venue_longitude ?? ''}
              />
            </label>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h2>Contact and payment</h2>
        </div>
        <div className="card-pad stack" style={{ gap: 12 }}>
          <div className="form-grid">
            <label className="field">
              Phone
              <input name="contact_phone" defaultValue={tournament?.contact_phone ?? ''} />
            </label>
            <label className="field">
              Phone 2
              <input name="contact_phone_2" defaultValue={tournament?.contact_phone_2 ?? ''} />
            </label>
            <label className="field">
              Phone 3
              <input name="contact_phone_3" defaultValue={tournament?.contact_phone_3 ?? ''} />
            </label>
            <label className="field">
              Email
              <input
                name="contact_email"
                type="email"
                defaultValue={tournament?.contact_email ?? ''}
              />
            </label>
          </div>
          <label className="field">
            Payment address / UPI
            <input name="payment_address" defaultValue={tournament?.payment_address ?? ''} />
          </label>
          <label className="field">
            Banner image URL
            <input name="banner_url" defaultValue={tournament?.banner_url ?? ''} />
          </label>
          <label className="field">
            Rules
            <textarea name="rules" defaultValue={tournament?.rules ?? ''} style={{ minHeight: 120 }} />
          </label>
        </div>
      </section>

      <div className="row">
        <button type="submit" className="btn btn-primary" disabled={pending || !organizer}>
          {pending ? 'Saving…' : tournament ? 'Save changes' : 'Create tournament'}
        </button>
        {!organizer ? <span className="faint">Pick an organizer account first.</span> : null}
      </div>
    </form>
  );
}
