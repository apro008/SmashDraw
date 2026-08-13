import Link from 'next/link';
import { notFound } from 'next/navigation';

import { fetchTournament } from '~/lib/data';
import { formatDateRange } from '~/lib/format';
import TournamentHeader from './TournamentHeader';

export default async function TournamentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tournament = await fetchTournament(id);
  if (!tournament) notFound();

  return (
    <>
      <div className="page-header">
        <div className="stack" style={{ gap: 6 }}>
          <Link href="/tournaments" className="faint">
            ← All tournaments
          </Link>
          <h1>{tournament.title}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {tournament.venue}, {tournament.city} ·{' '}
            {formatDateRange(tournament.start_date, tournament.end_date)} · Organised by{' '}
            {tournament.organizer_name}
          </p>
        </div>
        <TournamentHeader tournamentId={tournament.id} status={tournament.status} />
      </div>
      {children}
    </>
  );
}
