/**
 * Grants an account the `admin` role so it can sign into this panel, and
 * optionally sets a password on it — needed for Google-only accounts, which have
 * no password to sign in with.
 *
 *   node --env-file=.env.local scripts/promote-admin.mjs you@example.com
 *   node --env-file=.env.local scripts/promote-admin.mjs you@example.com 'a-strong-password'
 *
 * Uses the service role key, so run it from your machine, never from the browser.
 */
import { createClient } from '@supabase/supabase-js';

const [email, password] = process.argv.slice(2);

if (!email) {
  console.error('Usage: node --env-file=.env.local scripts/promote-admin.mjs <email> [password]');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

const { data: profile, error: lookupError } = await db
  .from('profiles')
  .select('id,name,email,role')
  .eq('email', email)
  .maybeSingle();

if (lookupError) {
  console.error('Lookup failed:', lookupError.message);
  process.exit(1);
}

if (!profile) {
  console.error(`No profile with email ${email}. Sign up in the app first.`);
  process.exit(1);
}

const { error: roleError } = await db
  .from('profiles')
  .update({ role: 'admin' })
  .eq('id', profile.id);

if (roleError) {
  console.error('Could not set the role:', roleError.message);
  process.exit(1);
}

console.log(`${profile.name} <${email}> is now an admin (was ${profile.role}).`);

if (password) {
  const { error: passwordError } = await db.auth.admin.updateUserById(profile.id, { password });
  if (passwordError) {
    console.error('Role updated, but the password was not set:', passwordError.message);
    process.exit(1);
  }
  console.log('Password set. You can sign into the admin panel with it.');
} else {
  console.log('No password given — pass one as the second argument if this account uses Google.');
}
