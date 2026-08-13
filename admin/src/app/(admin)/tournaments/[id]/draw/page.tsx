import { notFound } from 'next/navigation';

import { fetchMatches, fetchTournamentDetail } from '~/lib/data';
import DrawManager from './DrawManager';

export const dynamic = 'force-dynamic';

export default async function TournamentDrawPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [detail, matches] = await Promise.all([fetchTournamentDetail(id), fetchMatches(id)]);
  if (!detail) notFound();

  const approvedByCategory: Record<string, number> = {};
  for (const registration of detail.registrations) {
    if (registration.status !== 'approved') continue;
    approvedByCategory[registration.category_id] =
      (approvedByCategory[registration.category_id] ?? 0) + 1;
  }

  return (
    <DrawManager
      tournamentId={id}
      categories={detail.categories}
      matches={matches}
      approvedByCategory={approvedByCategory}
    />
  );
}
