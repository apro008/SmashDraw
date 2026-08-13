import Link from 'next/link';

import { fetchAllTournaments } from '~/lib/data';
import TournamentList from './TournamentList';

export const dynamic = 'force-dynamic';

export default async function TournamentsPage() {
  const tournaments = await fetchAllTournaments();
  const pending = tournaments.reduce((sum, t) => sum + t.counts.pending, 0);

  return (
    <>
      <div className="page-header">
        <div className="stack">
          <h1>Tournaments</h1>
          <p className="muted" style={{ margin: 0 }}>
            {tournaments.length} tournaments · {pending} registrations awaiting a decision
          </p>
        </div>
        <Link href="/tournaments/new" className="btn btn-primary">
          New tournament
        </Link>
      </div>
      <TournamentList tournaments={tournaments} />
    </>
  );
}
