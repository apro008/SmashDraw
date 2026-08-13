import { notFound } from 'next/navigation';

import { fetchTournamentDetail } from '~/lib/data';
import TournamentForm from '../../TournamentForm';
import AnnouncementForm from './AnnouncementForm';
import CategoriesEditor from './CategoriesEditor';
import DangerZone from './DangerZone';

export const dynamic = 'force-dynamic';

export default async function TournamentSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await fetchTournamentDetail(id);
  if (!detail) notFound();

  return (
    <div className="stack" style={{ gap: 20 }}>
      <CategoriesEditor tournamentId={id} categories={detail.categories} />
      <AnnouncementForm tournamentId={id} />
      <TournamentForm tournament={detail.tournament} />
      <DangerZone tournamentId={id} title={detail.tournament.title} />
    </div>
  );
}
