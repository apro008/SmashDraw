'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';

import type { EntryView } from '~/lib/notes';
import { REGISTRATION_STATUSES, type RegistrationStatus, type TournamentCategory } from '~/types';
import AddEntryForm from './AddEntryForm';
import EntryRow from './EntryRow';
import { setManyEntryStatuses } from './actions';
import type { ActionResult } from './state';

interface Props {
  tournamentId: string;
  categories: TournamentCategory[];
  entries: EntryView[];
}

export default function RegistrationsManager({ tournamentId, categories, entries }: Props) {
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState<string | 'all'>('all');
  const [status, setStatus] = useState<RegistrationStatus | 'all'>('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<ActionResult | null>(null);
  const [adding, setAdding] = useState(false);
  const [bulkPending, startBulk] = useTransition();

  const onResult = useCallback((result: ActionResult) => {
    setFeedback(result);
    if (result.ok) setSelected([]);
  }, []);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (categoryId !== 'all' && entry.registration.category_id !== categoryId) return false;
      if (status !== 'all' && entry.registration.status !== status) return false;
      if (!term) return true;
      return [entry.displayName, entry.partnerName, entry.phone, entry.email, entry.freeNotes]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term);
    });
  }, [entries, query, categoryId, status]);

  const counts = useMemo(() => {
    const tally: Record<string, number> = {};
    for (const entry of entries) {
      tally[entry.registration.status] = (tally[entry.registration.status] ?? 0) + 1;
    }
    return tally;
  }, [entries]);

  const toggleSelect = useCallback((id: string, isSelected: boolean) => {
    setSelected((current) =>
      isSelected ? [...current, id] : current.filter((item) => item !== id)
    );
  }, []);

  const allVisibleSelected =
    visible.length > 0 && visible.every((entry) => selected.includes(entry.registration.id));

  const applyBulk = (next: RegistrationStatus) => {
    startBulk(async () => {
      onResult(await setManyEntryStatuses(tournamentId, selected, next));
    });
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      {/* Capacity, straight off tournament_categories.current_players, which a DB
          trigger keeps in step with approved entries. */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
        {categories.map((category) => {
          const full = category.current_players >= category.max_players;
          const fill = Math.min(100, (category.current_players / (category.max_players || 1)) * 100);
          return (
            <div key={category.id} className="card card-pad stack" style={{ gap: 2 }}>
              <span style={{ fontWeight: 600 }}>{category.name}</span>
              <span className="muted">
                {category.current_players} / {category.max_players} approved
              </span>
              <div className="meter" data-full={full}>
                <span style={{ width: `${fill}%` }} />
              </div>
              <span className="faint">₹{category.entry_fee} entry</span>
            </div>
          );
        })}
      </div>

      {feedback ? (
        <p className={`alert ${feedback.ok ? 'alert-success' : 'alert-error'}`} role="status">
          {feedback.message}
        </p>
      ) : null}

      <div className="card">
        <div className="card-header">
          <h2>Add an entry</h2>
          <button type="button" className="btn btn-sm" onClick={() => setAdding((open) => !open)}>
            {adding ? 'Cancel' : 'New entry'}
          </button>
        </div>
        {adding ? (
          <AddEntryForm
            tournamentId={tournamentId}
            categories={categories}
            defaultCategoryId={categoryId === 'all' ? null : categoryId}
            onResult={onResult}
          />
        ) : (
          <p className="card-pad muted" style={{ margin: 0 }}>
            Put a player or a walk-in team straight onto the roster. Capacity is not enforced, and
            linking an account is optional.
          </p>
        )}
      </div>

      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap' }}>
          <div className="row" style={{ gap: 8 }}>
            <input
              type="search"
              placeholder="Search name, phone or email…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              style={{ width: 240 }}
            />
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              style={{ width: 'auto' }}
            >
              <option value="all">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="chip-row">
            {(['all', ...REGISTRATION_STATUSES] as const).map((option) => (
              <button
                key={option}
                type="button"
                className="chip"
                data-active={status === option}
                onClick={() => setStatus(option)}
              >
                {option === 'all' ? `All (${entries.length})` : `${option} (${counts[option] ?? 0})`}
              </button>
            ))}
          </div>
        </div>

        {selected.length > 0 ? (
          <div className="card-header" style={{ background: 'var(--accent-soft)' }}>
            <span>{selected.length} selected</span>
            <div className="row">
              {REGISTRATION_STATUSES.map((option) => (
                <button
                  key={option}
                  type="button"
                  className="btn btn-sm"
                  disabled={bulkPending}
                  onClick={() => applyBulk(option)}
                >
                  Mark {option}
                </button>
              ))}
              <button type="button" className="btn btn-sm" onClick={() => setSelected([])}>
                Clear
              </button>
            </div>
          </div>
        ) : null}

        {visible.length === 0 ? (
          <div className="empty">No entries match these filters.</div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 34 }}>
                    <input
                      type="checkbox"
                      aria-label="Select all visible entries"
                      checked={allVisibleSelected}
                      onChange={(event) =>
                        setSelected(
                          event.target.checked
                            ? visible.map((entry) => entry.registration.id)
                            : []
                        )
                      }
                      style={{ width: 16, height: 16, minHeight: 0 }}
                    />
                  </th>
                  <th>Entry</th>
                  <th>Contact</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Source</th>
                  <th>Added</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visible.map((entry) => (
                  <EntryRow
                    key={entry.registration.id}
                    tournamentId={tournamentId}
                    entry={entry}
                    categories={categories}
                    selected={selected.includes(entry.registration.id)}
                    onSelect={toggleSelect}
                    onResult={onResult}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
