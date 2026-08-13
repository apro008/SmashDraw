import { fetchProfileLocations, fetchTournamentOptions } from '~/lib/data';
import NotificationComposer from './NotificationComposer';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const [tournaments, locations] = await Promise.all([
    fetchTournamentOptions(),
    fetchProfileLocations(),
  ]);

  return (
    <>
      <div className="page-header">
        <div className="stack">
          <h1>Notifications</h1>
          <p className="muted" style={{ margin: 0 }}>
            Send a custom title and message. It lands in the in-app feed and as a push on every
            device the recipient has registered.
          </p>
        </div>
      </div>
      <NotificationComposer
        tournaments={tournaments}
        cities={locations.cities}
        states={locations.states}
      />
    </>
  );
}
