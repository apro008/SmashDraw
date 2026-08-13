'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import StatusBadge from '~/components/StatusBadge';
import { formatDateRange } from '~/lib/format';
import type { TournamentListRow } from '~/lib/data';
import type { TournamentStatus } from '~/types';

const STATUS_FILTERS: (TournamentStatus | 'all')[] = [
  'all',
  'open',
  'ongoing',
  'paused',
  'draft',
  'completed',
  'cancelled',
];

export default function TournamentList({ tournaments }: { tournaments: TournamentListRow[] }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<TournamentStatus | 'all'>('all');

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return tournaments.filter((tournament) => {
      if (status !== 'all' && tournament.status !== status) return false;
      if (!term) return true;
      return [tournament.title, tournament.city, tournament.venue, tournament.organizer_name]
        .join(' ')
        .toLowerCase()
        .includes(term);
    });
  }, [tournaments, query, status]);

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <input
          type="search"
          placeholder="Search title, city, venue or organizer…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          style={{ maxWidth: 340 }}
        />
        <div className="chip-row">
          {STATUS_FILTERS.map((option) => (
            <button
              key={option}
              type="button"
              className="chip"
              data-active={status === option}
              onClick={() => setStatus(option)}
            >
              {option === 'all' ? 'All' : option}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="card empty">No tournaments match that.</div>
      ) : (
        <div className="grid">
          {visible.map((tournament) => (
            <Link
              key={tournament.id}
              href={`/tournaments/${tournament.id}`}
              className="card card-pad stack"
              style={{ gap: 10, color: 'inherit', textDecoration: 'none' }}
            >
              <div className="row" style={{ justifyContent: 'space-between', gap: 10 }}>
                <h2 style={{ flex: 1 }}>{tournament.title}</h2>
                <StatusBadge status={tournament.status} />
              </div>
              <div className="stack">
                <span className="muted">
                  {tournament.venue}, {tournament.city}
                </span>
                <span className="faint">
                  {formatDateRange(tournament.start_date, tournament.end_date)} ·{' '}
                  {tournament.organizer_name}
                </span>
              </div>
              <div className="row" style={{ gap: 6 }}>
                <span className="badge badge-approved">{tournament.counts.approved} approved</span>
                {tournament.counts.pending > 0 ? (
                  <span className="badge badge-pending">{tournament.counts.pending} pending</span>
                ) : null}
                {tournament.counts.waitlisted > 0 ? (
                  <span className="badge badge-waitlisted">
                    {tournament.counts.waitlisted} waitlisted
                  </span>
                ) : null}
                <span className="badge">{tournament.categories?.length ?? 0} categories</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
