import Link from 'next/link';

import TournamentForm from '../TournamentForm';

export const dynamic = 'force-dynamic';

export default function NewTournamentPage() {
  return (
    <>
      <div className="page-header">
        <div className="stack" style={{ gap: 6 }}>
          <Link href="/tournaments" className="faint">
            ← All tournaments
          </Link>
          <h1>New tournament</h1>
          <p className="muted" style={{ margin: 0 }}>
            Created on behalf of whichever organizer you pick. Add categories once it exists.
          </p>
        </div>
      </div>
      <TournamentForm />
    </>
  );
}
