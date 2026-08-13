import Link from 'next/link';

import { signOut } from '~/app/login/actions';
import { requireAdmin } from '~/lib/auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  return (
    <>
      <header className="topbar">
        <div className="row" style={{ gap: 20 }}>
          <Link href="/tournaments" className="brand">
            <span className="brand-mark">🏸</span>
            <span>SmashDraw Admin</span>
          </Link>
          <nav className="row" style={{ gap: 14 }}>
            <Link href="/tournaments">Tournaments</Link>
            <Link href="/players">Players</Link>
          </nav>
        </div>
        <div className="topbar-user">
          <span>{admin.name || admin.email}</span>
          <form action={signOut}>
            <button type="submit" className="btn btn-sm">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="page">{children}</main>
    </>
  );
}
