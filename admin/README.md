# SmashDraw Admin

A private web panel for running SmashDraw, separate from the Expo app and
deployed on its own to Vercel's free tier. It talks to the **same Supabase
project** the mobile app uses.

## How the "no restrictions" part works

Every read and write goes through a server action holding
`SUPABASE_SERVICE_ROLE_KEY`, which **bypasses row level security entirely**.
Because RLS is off, the *only* thing between a visitor and the whole database is
`requireAdmin()`, which runs first in every page and every action. The key has no
`NEXT_PUBLIC_` prefix so Next.js keeps it out of the browser bundle, and the
modules that use it import `server-only`, which makes bundling them into client
code fail the build.

## What it does

### Tournaments

- Create a tournament on behalf of any organizer, edit every column the table
  has, and change status from a switch in the header
- Add, edit and delete categories — name, entry fee, max players, skill level,
  prize
- Delete a tournament outright (types-to-confirm; cascades to categories,
  registrations, matches and notifications)
- Send a free-text announcement to everyone approved or waitlisted

### Registrations and roster entries

- Every registration across every tournament, drafts included
- Approve, decline or waitlist any entry, one at a time or by ticking boxes
- Add a player or a walk-in team straight onto the roster, over capacity if you
  want, optionally linked to a real account so they get push
- Move an entry between categories
- Edit an entry's player name, partner, phones, email and notes
- Delete any entry, including a real player's registration
- Search by name, phone, email or notes; filter by category and status; capacity
  meters per category

### Draws and matches

- Generate a random knockout draw per category from the approved entries —
  shuffled, padded to a power of two, byes spread from the outside in so bye
  recipients avoid each other in round 2
- Byes are stored as real `walkover` matches with a winner, so they advance on
  their own
- Pick a winner with one tap, or open a match to set both names, both scores, the
  winner, court, schedule, prize money and notes
- Advance a finished round into the next one, pairing winners in bracket order
- Regenerate or clear a draw, and publish a "draw is out" notification

### Players

- Every profile, searchable, filterable by role
- Change anyone's role between player, organizer and admin
- Edit any profile — name, contact, location, club, skill, ranking points, counts
- Set a login password on an account (needed for Google-only accounts)
- Delete an account entirely

### What the mobile app cannot do

| Action | Mobile app | This panel |
| --- | --- | --- |
| Create or delete a tournament as an admin | no policy for it | yes |
| Manage another organizer's categories | organizer only | yes |
| Delete an entry | only organizer-added ones | any entry |
| Move a player between categories | not possible | yes |
| Edit a player's name or contact details | not possible | yes |
| Add an entry over a category's capacity | blocked | allowed |
| Change someone's role | not possible | yes |
| Set another account's password | not possible | yes |

## Setup

### 1. Run the two SQL files that are out of sync

I checked the live database against the repo. `supabase/schema.sql` is applied.
The other two are not, fully:

**`supabase/features.sql` — not applied at all.** No `registrations.added_by`
column, `user_id` still `not null`, and `add_tournament_entry`,
`remove_tournament_entry` and `notify_draw_published` do not exist. Until you run
it, **adding entries fails** — walk-ins especially. Everything else works.

**`supabase/notifications.sql` — an older version is applied.** The
`notifications` and `push_tokens` tables, `create_notification`,
`send_tournament_announcement` and `mark_all_notifications_read` all exist, but
`notifications.broadcast_id`, `tournaments.announced_at` and
`dispatch_broadcast_push` do not. So the fan-out batching described in
`CLAUDE.md` is not live yet, and `send_tournament_announcement` in the repo would
fail against the current schema because it inserts `broadcast_id`.

Both files are idempotent. Paste them into the Supabase SQL editor, features.sql
after notifications.sql.

The panel does not depend on either — it writes to tables directly and inserts
notification rows one per recipient, precisely because the RPCs check
`auth.uid()`, which is null for the service role. Running them keeps the mobile
app and the panel consistent.

### 2. Make yourself an admin

No profile has `role = 'admin'`, so nobody can sign in yet:

```bash
node --env-file=.env.local scripts/promote-admin.mjs you@example.com 'a-strong-password'
```

Pass the password — your account signed up through Google and has none, and
login here is email and password. After the first admin exists, you can promote
anyone else from the Players screen.

### 3. Environment

`.env.local` is already filled in locally. To recreate it, copy `.env.example`
and take the values from Supabase → Project Settings → API.

### 4. Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build
npm run typecheck
```

## Deploying to Vercel (free Hobby tier)

1. Push this repo to GitHub.
2. Vercel → **Add New → Project** → import `apro008/SmashDraw`.
3. Set **Root Directory** to `admin`. Framework preset: Next.js (auto-detected
   once the root directory is set). Vercel then installs from
   `admin/package.json` and builds only this folder — the Expo app is ignored.
   While you are on that setting, turn on the **Skip deployment** switch just
   below it, so commits that touch nothing in `admin/` don't trigger a rebuild.
4. Add all three environment variables under Settings → Environment Variables,
   for Production, Preview and Development. `SUPABASE_SERVICE_ROLE_KEY` must
   **not** carry a `NEXT_PUBLIC_` prefix.
5. Deploy. Every push redeploys.

Node version is pinned to `24.x` via `engines.node` in this folder's
`package.json`, which overrides whatever Settings → Build and Deployment →
Node.js Version says. Vercel offers 24.x (its default), 22.x and 20.x; Next 16
needs at least 20.9. To confirm what a deployment actually used, add `node -v` to
the build command or log `process.version`.

Anyone with the URL still hits the login page and a non-admin is signed straight
back out, but Vercel's password protection is worth adding as a second lock.

## Notes and sharp edges

- **Push notifications fire from here too.** Approving an entry, scheduling a
  match or posting a result all trip the same database triggers the app uses.
  Walk-ins with no account get nothing — `create_notification()` no-ops on a null
  user id. Note `push_tokens` is currently empty, so nothing is actually
  delivered to a device until someone installs a dev or EAS build.
- **Adding an entry notifies the organizer.** The insert trigger skips its "the
  organizer did this themselves" check when `auth.uid()` is null, which it is for
  the service role. Harmless, but expected.
- **Announcements are inserted per row**, not as a `broadcast_id` batch, because
  that column does not exist on this database yet. Fine at current numbers;
  revisit if a tournament ever has thousands of entries.
- **Regenerating a draw destroys results.** It deletes every match in the
  category first. The UI confirms, but there is no undo.
- **`current_players` stays correct** on its own — the
  `sync_category_registration_count` trigger recounts on every insert, delete,
  status change and category move.
- **`src/types.ts` is a copy** of the app's `src/types/index.ts`, and
  `src/lib/draw.ts` is a port of the app's draw logic. Change one, change the
  other.
- `AGENTS.md` and `CLAUDE.md` here are generated by Next 16 on every dev run.
