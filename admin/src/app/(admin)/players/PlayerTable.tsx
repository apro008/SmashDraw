'use client';

import { Fragment, useActionState, useEffect, useMemo, useState, useTransition } from 'react';

import { formatTimestamp } from '~/lib/format';
import { SKILL_LEVELS, USER_ROLES, type UserProfile, type UserRole } from '~/types';
import { EMPTY_FORM_STATE, type ActionResult, type FormState } from '../tournaments/[id]/state';
import { deleteUser, setUserPassword, setUserRole, updateProfile } from './actions';

export default function PlayerTable({
  profiles,
  currentAdminId,
}: {
  profiles: UserProfile[];
  currentAdminId: string | null;
}) {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<UserRole | 'all'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return profiles.filter((profile) => {
      if (role !== 'all' && profile.role !== role) return false;
      if (!term) return true;
      return [profile.name, profile.email, profile.phone, profile.city, profile.club_name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term);
    });
  }, [profiles, query, role]);

  const changePassword = (profile: UserProfile) => {
    const password = window.prompt(
      `New password for ${profile.name}. They can sign into the admin panel with it ` +
        `(minimum 8 characters).`
    );
    if (!password) return;
    startTransition(async () => setFeedback(await setUserPassword(profile.id, password)));
  };

  const remove = (profile: UserProfile) => {
    const confirmed = window.confirm(
      `Delete ${profile.name}'s account entirely? Their profile, registrations and ` +
        `notifications all go with it. This cannot be undone.`
    );
    if (confirmed) startTransition(async () => setFeedback(await deleteUser(profile.id)));
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      {feedback ? (
        <p className={`alert ${feedback.ok ? 'alert-success' : 'alert-error'}`} role="status">
          {feedback.message}
        </p>
      ) : null}

      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap' }}>
          <input
            type="search"
            placeholder="Search name, email, phone, city or club…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            style={{ width: 280 }}
          />
          <div className="chip-row">
            {(['all', ...USER_ROLES] as const).map((option) => (
              <button
                key={option}
                type="button"
                className="chip"
                data-active={role === option}
                onClick={() => setRole(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="empty">No accounts match that.</div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Location</th>
                  <th>Skill</th>
                  <th>Role</th>
                  <th>Joined</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visible.map((profile) => (
                  <Fragment key={profile.id}>
                    <tr style={{ opacity: pending ? 0.5 : 1 }}>
                      <td>
                        <div className="stack" style={{ gap: 2 }}>
                          <strong>{profile.name}</strong>
                          {profile.club_name ? (
                            <span className="faint">{profile.club_name}</span>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <div className="stack" style={{ gap: 2 }}>
                          <span>{profile.email ?? '—'}</span>
                          <span className="faint">{profile.phone ?? ''}</span>
                        </div>
                      </td>
                      <td className="muted">
                        {[profile.city, profile.state].filter(Boolean).join(', ') || '—'}
                      </td>
                      <td className="muted">{profile.skill_level}</td>
                      <td>
                        <select
                          value={profile.role}
                          disabled={pending || profile.id === currentAdminId}
                          title={
                            profile.id === currentAdminId
                              ? 'You cannot change your own role here'
                              : undefined
                          }
                          onChange={(event) => {
                            const next = event.target.value;
                            startTransition(async () =>
                              setFeedback(await setUserRole(profile.id, next))
                            );
                          }}
                          style={{ minWidth: 120 }}
                        >
                          {USER_ROLES.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="faint">{formatTimestamp(profile.created_at)}</td>
                      <td>
                        <div className="cell-actions">
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() =>
                              setEditingId((current) => (current === profile.id ? null : profile.id))
                            }
                          >
                            {editingId === profile.id ? 'Close' : 'Edit'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => changePassword(profile)}
                            disabled={pending}
                          >
                            Password
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            onClick={() => remove(profile)}
                            disabled={pending || profile.id === currentAdminId}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                    {editingId === profile.id ? (
                      <tr>
                        <td colSpan={7} style={{ background: 'var(--surface-alt)' }}>
                          <ProfileForm
                            profile={profile}
                            onResult={setFeedback}
                            onDone={() => setEditingId(null)}
                          />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileForm({
  profile,
  onResult,
  onDone,
}: {
  profile: UserProfile;
  onResult: (result: ActionResult) => void;
  onDone: () => void;
}) {
  const action = updateProfile.bind(null, profile.id);
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
          Name
          <input name="name" defaultValue={profile.name} required />
        </label>
        <label className="field">
          Email
          <input name="email" type="email" defaultValue={profile.email ?? ''} />
        </label>
        <label className="field">
          Phone
          <input name="phone" defaultValue={profile.phone ?? ''} />
        </label>
        <label className="field">
          City
          <input name="city" defaultValue={profile.city ?? ''} />
        </label>
        <label className="field">
          State
          <input name="state" defaultValue={profile.state ?? ''} />
        </label>
        <label className="field">
          Club
          <input name="club_name" defaultValue={profile.club_name ?? ''} />
        </label>
        <label className="field">
          Age
          <input name="age" type="number" min={0} defaultValue={profile.age ?? ''} />
        </label>
        <label className="field">
          Gender
          <select name="gender" defaultValue={profile.gender ?? ''}>
            <option value="">Not set</option>
            <option value="male">male</option>
            <option value="female">female</option>
            <option value="other">other</option>
          </select>
        </label>
        <label className="field">
          Skill level
          <select name="skill_level" defaultValue={profile.skill_level}>
            {SKILL_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Ranking points
          <input name="ranking_points" type="number" defaultValue={profile.ranking_points} />
        </label>
        <label className="field">
          Tournaments played
          <input name="tournaments_played" type="number" defaultValue={profile.tournaments_played} />
        </label>
        <label className="field">
          Tournaments won
          <input name="tournaments_won" type="number" defaultValue={profile.tournaments_won} />
        </label>
      </div>
      <label className="field">
        Avatar URL
        <input name="avatar_url" defaultValue={profile.avatar_url ?? ''} />
      </label>
      <div className="row">
        <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
          {pending ? 'Saving…' : 'Save profile'}
        </button>
        <button type="button" className="btn btn-sm" onClick={onDone} disabled={pending}>
          Cancel
        </button>
        <span className="faint">
          Changing the email here updates the profile row, not the login address.
        </span>
      </div>
    </form>
  );
}
