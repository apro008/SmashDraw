import { notFound } from 'next/navigation';

import { fetchTournamentDetail } from '~/lib/data';
import { toEntryView } from '~/lib/notes';
import RegistrationsManager from './RegistrationsManager';

export const dynamic = 'force-dynamic';

export default async function TournamentEntriesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await fetchTournamentDetail(id);
  if (!detail) notFound();

  return (
    <RegistrationsManager
      tournamentId={detail.tournament.id}
      categories={detail.categories}
      entries={detail.registrations.map(toEntryView)}
    />
  );
}
