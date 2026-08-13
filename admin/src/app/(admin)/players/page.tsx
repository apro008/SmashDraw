import { currentAdmin } from '~/lib/auth';
import { fetchProfiles } from '~/lib/data';
import PlayerTable from './PlayerTable';

export const dynamic = 'force-dynamic';

export default async function PlayersPage() {
  const [profiles, admin] = await Promise.all([fetchProfiles(), currentAdmin()]);

  return (
    <>
      <div className="page-header">
        <div className="stack">
          <h1>Players</h1>
          <p className="muted" style={{ margin: 0 }}>
            {profiles.length} accounts ·{' '}
            {profiles.filter((profile) => profile.role === 'admin').length} admins ·{' '}
            {profiles.filter((profile) => profile.role === 'organizer').length} organizers
          </p>
        </div>
      </div>
      <PlayerTable profiles={profiles} currentAdminId={admin?.id ?? null} />
    </>
  );
}
