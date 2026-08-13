'use client';

import { useEffect, useState, useTransition } from 'react';

import type { PlayerSummary } from '~/types';

/**
 * Debounced profile search. The `search` action is passed in by the parent so
 * this stays usable from any route — each one gates the lookup behind its own
 * `requireAdmin()`.
 */
export default function PlayerPicker({
  value,
  onChange,
  search,
  placeholder = 'Search name or email…',
  linkedLabel = 'Linked to',
}: {
  value: PlayerSummary | null;
  onChange: (player: PlayerSummary | null) => void;
  search: (query: string) => Promise<PlayerSummary[]>;
  placeholder?: string;
  linkedLabel?: string;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlayerSummary[]>([]);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }

    // Debounced so typing a name is not one round trip per keystroke.
    const timer = setTimeout(() => {
      startTransition(async () => {
        try {
          setResults(await search(term));
        } catch {
          setResults([]);
        }
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [query, search]);

  if (value) {
    return (
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span>
          {linkedLabel} <strong>{value.name}</strong>{' '}
          <span className="faint">{value.email ?? value.id.slice(0, 8)}</span>
        </span>
        <button type="button" className="btn-link" onClick={() => onChange(null)}>
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: 6 }}>
      <input
        type="search"
        placeholder={placeholder}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {results.length > 0 ? (
        <div className="card" style={{ maxHeight: 180, overflowY: 'auto' }}>
          {results.map((player) => (
            <button
              key={player.id}
              type="button"
              className="btn"
              style={{
                width: '100%',
                justifyContent: 'space-between',
                border: 'none',
                borderRadius: 0,
                minHeight: 40,
              }}
              onClick={() => {
                onChange(player);
                setQuery('');
                setResults([]);
              }}
            >
              <span>{player.name}</span>
              <span className="faint">{player.email ?? player.city ?? ''}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
