'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { signIn, type LoginState } from './actions';

const INITIAL: LoginState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending} style={{ width: '100%' }}>
      {pending ? 'Signing in…' : 'Sign in'}
    </button>
  );
}

export default function LoginForm() {
  const [state, formAction] = useActionState(signIn, INITIAL);

  return (
    <form action={formAction} style={{ display: 'grid', gap: 14 }}>
      <label className="field">
        Email
        <input type="email" name="email" autoComplete="email" required autoFocus />
      </label>
      <label className="field">
        Password
        <input type="password" name="password" autoComplete="current-password" required />
      </label>
      {state.error ? (
        <p className="alert alert-error" role="alert">
          {state.error}
        </p>
      ) : null}
      <SubmitButton />
    </form>
  );
}
