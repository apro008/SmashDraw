/**
 * Config readers. Deliberately functions rather than module-level constants:
 * evaluating them at import time would make `next build` fail on a machine that
 * has no credentials, even though nothing is actually being fetched yet.
 */

function required(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy admin/.env.example to admin/.env.local and fill it in ` +
        `(or set it in the Vercel project settings).`
    );
  }
  return value;
}

export function supabaseUrl() {
  return required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function supabaseAnonKey() {
  return required('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** Server-only. Bypasses RLS — see `supabaseAdmin.ts`. */
export function serviceRoleKey() {
  return required('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY);
}
