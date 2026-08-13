import { redirect } from 'next/navigation';

import { currentAdmin } from '~/lib/auth';
import LoginForm from './LoginForm';

export default async function LoginPage() {
  if (await currentAdmin()) redirect('/tournaments');

  return (
    <main className="login-shell">
      <div className="card login-card">
        <div className="brand" style={{ marginBottom: 6 }}>
          <span className="brand-mark">🏸</span>
          <span>SmashDraw Admin</span>
        </div>
        <p className="muted" style={{ marginTop: 0, marginBottom: 20, fontSize: 13 }}>
          Sign in with an account whose profile role is <code>admin</code>.
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
