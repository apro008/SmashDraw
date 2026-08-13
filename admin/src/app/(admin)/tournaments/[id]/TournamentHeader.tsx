'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useTransition } from 'react';

import { TOURNAMENT_STATUSES, type TournamentStatus } from '~/types';
import { setTournamentStatus } from '../actions';

/** Status switch plus the section tabs, both needing the current URL or state. */
export default function TournamentHeader({
  tournamentId,
  status,
}: {
  tournamentId: string;
  status: TournamentStatus;
}) {
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const base = `/tournaments/${tournamentId}`;
  const tabs = [
    { href: base, label: 'Entries' },
    { href: `${base}/draw`, label: 'Draws' },
    { href: `${base}/settings`, label: 'Settings' },
  ];

  return (
    <div className="stack" style={{ gap: 10, alignItems: 'flex-end' }}>
      <div className="row">
        <span className="faint">Status</span>
        <select
          value={status}
          disabled={pending}
          onChange={(event) => {
            const next = event.target.value;
            startTransition(async () => {
              const result = await setTournamentStatus(tournamentId, next);
              setError(result.ok ? null : result.message);
            });
          }}
          style={{ width: 'auto' }}
        >
          {TOURNAMENT_STATUSES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
      {error ? <span className="faint">{error}</span> : null}
      <div className="chip-row">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="chip"
            data-active={pathname === tab.href}
            style={{ textDecoration: 'none' }}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
