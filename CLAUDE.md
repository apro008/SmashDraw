# CLAUDE.md — SmashDraw

Badminton tournament management app built with Expo + Supabase.

## Commands

```bash
npm start              # Start Expo dev server
npm run android        # Run on Android
npm run ios            # Run on iOS
npm test               # Run Jest tests
npm run lint           # ESLint + Prettier check
npm run format         # Auto-fix lint + format
npm run build:apk      # EAS preview APK
npm run build:production # EAS production AAB
npx tsc --noEmit       # Type check
```

## Tech Stack

- **Framework:** React Native 0.83 + Expo 55 + TypeScript 5.9
- **Navigation:** expo-router (file-based routing)
- **State:** Zustand (MMKV persistence for theme only)
- **Backend:** Supabase (Auth, Postgres, Realtime, Storage)
- **Auth storage:** expo-secure-store
- **UI:** Ionicons, Inter font
- **Formatting:** Prettier (100 width, 2 spaces, single quotes)

## Architecture

### Data Flow: Supabase → Zustand Store → Component

1. **Supabase** (`src/lib/supabase.ts`): Single client instance using env vars.
2. **Zustand Stores** (`src/store/`): `useAuthStore` (user + profile), `useThemeStore` (MMKV-persisted).
3. **AuthProvider** (`src/providers/AuthProvider.tsx`): Listens to Supabase auth state changes, exposes `useSession()`.
4. **Components**: Access stores via hooks. Never call Supabase directly from components — use store actions.

### Navigation Layout

```
app/_layout.tsx              # Root: GestureHandlerRootView → AuthProvider → fonts + stack
app/index.tsx                # Entry: redirects to auth or tabs based on session
app/(auth)/                  # Stack: login, signup, forgot-password
app/(app)/(tabs)/            # Tabs: Home, Explore, My Events, Profile
```

### Theme System

- `useTheme()` returns `{ colors, isDark, theme }`
- Never import `Colors.ts` directly in components
- 21 semantic color properties — badminton-specific: `win`, `loss`, `upcoming`, `ongoing`
- Style pattern: `makeStyles(colors)` + `useMemo(() => makeStyles(colors), [colors])`

## Key Conventions

- **Path alias:** `~/` maps to `src/` (configured in tsconfig.json — no babel plugin needed)
- **Text:** Always use `AppText`, never raw `Text`
- **Pressables:** Use `TouchableOpacity`
- **Icons:** `Ionicons` from `@expo/vector-icons`
- **Dates in DB:** `YYYY-MM-DD` strings
- **Tournament status:** `'draft' | 'open' | 'ongoing' | 'completed' | 'cancelled'`
- **User roles:** `'player' | 'organizer' | 'admin'`
- **Skill levels:** `'beginner' | 'intermediate' | 'advanced' | 'open'`

## Environment Variables

Copy `.env.example` to `.env` and fill in:
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=    # required for the Google button to render
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=    # iOS only
```

## Google Sign-In

Native flow — `@react-native-google-signin/google-signin` produces a Google ID
token, which goes to `supabase.auth.signInWithIdToken({ provider: 'google' })`.
No browser round-trip.

- `src/lib/googleAuth.ts` — configure, sign in, sign out
- `useAuthStore.loginWithGoogle()` — seeds a `profiles` row on first sign-in
- `GoogleSignInButton` renders **only** when the client IDs are set and it's a
  native build; it returns null in Expo Go and on web
- Android needs the Web client ID (not the Android one) — the Android client is
  matched by package name + SHA-1, but the Web client mints the token
- Supabase → Auth → Providers → Google → **Authorized Client IDs** must list the
  Android/iOS client IDs, or the token is rejected for bad audience

## Supabase Database Tables

profiles, tournaments, tournament_categories, registrations, matches,
push_tokens, notifications

SQL files, in run order — all three are idempotent and safe to re-run:

1. `supabase/schema.sql` — core tables and policies
2. `supabase/notifications.sql` — push tables, dispatch, notification triggers
3. `supabase/features.sql` — organizer roster entries, draw announcement RPC

`supabase/push-secrets.local.sql` holds the Vault secrets with the real service
role key. It is gitignored (`*.local.sql`) and must never be committed.

## Push Notifications

Database triggers write rows into `notifications` on registration decisions, match
scheduling/results, and tournament status changes. An `after insert` trigger calls the
`send-push` Edge Function over pg_net, which delivers to Expo's push service.

- Client entry point: `src/lib/notifications.ts`, state in `useNotificationStore`
- Device registration + tap routing: `src/providers/NotificationProvider.tsx`
- Edge Function: `supabase/functions/send-push/`
- Push requires a dev/EAS build — tokens are not issued in Expo Go or on simulators.

**Fan-outs.** Anything going to more than one person (a tournament opening, a
status change, an organizer announcement, a published draw) writes its rows in
one statement under a shared `notifications.broadcast_id`. Those rows skip the
per-row dispatch trigger; `dispatch_broadcast_push()` sends the batch id once and
`send-push` pages through it. Never loop `create_notification()` over a large
audience — that is one HTTP request per recipient.

`tournament_published` is the only notification that reaches users with no prior
link to the tournament. It fires once per tournament, guarded by
`tournaments.announced_at`.

## Organizer Roster Entries

Organizers can put a player or team on the roster themselves, including walk-ins
with no account — `registrations.user_id` is nullable and the name lives in the
`notes` JSON. `added_by` marks organizer-created entries.

- `add_tournament_entry()` / `remove_tournament_entry()` RPCs in `features.sql`
- UI: `src/components/tournament/AddEntrySheet.tsx`
- Entries are inserted already approved and count towards category slots
- Only organizer-added entries can be deleted; a real player registration is
  declined via `set_registration_status` instead
- Unlinked walk-ins get no push — they have no account to send to

## Draws

Random knockout draws live in `src/lib/draw.ts` and are written straight to
`matches` (organizers already hold write access through the "Organizers can
manage matches" policy — no server function involved).

- Round 1 is a plain shuffle, no seeding, padded to a power of two with byes
- Byes are stored as real matches with `status = 'walkover'` and a winner, so
  they advance on their own
- Later rounds are **not** random: `buildNextRound` pairs winners in bracket order
- Screen: `app/(app)/draw/[id].tsx`, reached from the organizer roster section
- Generating a draw calls `notify_draw_published`; scheduling a match later is
  what triggers the per-player `match_scheduled` push

## Admin Web Panel (`admin/`)

A standalone Next.js 16 app, deployed separately to Vercel with its root
directory set to `admin`. Same Supabase project, no shared code — `admin/src/types.ts`
is a copy of `src/types/index.ts` and has to be updated alongside it.

Covers tournaments and categories, registrations and roster entries, draws and
matches, players and roles, and tournament announcements.

- Reads and writes go through server actions holding `SUPABASE_SERVICE_ROLE_KEY`,
  which bypasses RLS — so `requireAdmin()` (`admin/src/lib/auth.ts`) is the whole
  security boundary and runs first in every page and action
- The service role has no `auth.uid()`, so every RPC that checks it
  (`add_tournament_entry`, `remove_tournament_entry`, `set_registration_status`,
  `notify_draw_published`, `send_tournament_announcement`) rejects it. The actions
  write to the tables directly, which is also what lets an admin delete a real
  player's registration or create a tournament for another organizer
- Notifications are inserted one row per recipient — `notifications.broadcast_id`
  and `dispatch_broadcast_push` are not on the live database yet
- `admin/src/lib/draw.ts` is a port of `src/lib/draw.ts`; `admin/src/types.ts` is
  a copy of `src/types/index.ts`. Both must be updated alongside their originals
- Login is email + password, gated on `profiles.role = 'admin'`;
  `admin/scripts/promote-admin.mjs` grants the role and can set a password
- Entry creation needs `supabase/features.sql`, which is not yet applied to the
  live database

## Common Style Values

- Form field spacing: `marginBottom: 14` or `gap: 18`
- Label: `fontSize: 13, fontWeight: 'medium', color: colors.textSecondary, marginBottom: 6`
- Input: `minHeight: 48`, border radius 12
- Cards: border radius 16, shadow with `colors.shadow`
- Font family: Inter (Regular, Medium, SemiBold, Bold)
