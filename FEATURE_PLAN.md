# SmashDraw Feature Plan

## Project Identified

SmashDraw is a badminton tournament management mobile app built with Expo, React Native, TypeScript, expo-router, Zustand, and Supabase.

The app currently has role-based areas for:

- Players: browse tournaments, view details, profile, and "My Events"
- Organizers: create tournaments and manage their own events
- Admins: view platform overview, users, tournaments, and profile

The backend schema already includes the main tournament lifecycle tables:

- `profiles`
- `tournaments`
- `tournament_categories`
- `registrations`
- `matches`
- `fixture_brackets`

## Current App Snapshot

Implemented or partially implemented:

- Authentication with Supabase
- Player, organizer, and admin route groups
- Role-based navigation after login
- Tournament browsing UI
- Tournament detail page
- Organizer tournament creation form
- Organizer "My Events" list from Supabase
- Mock tournament data for public browsing and dashboards
- Basic theme, reusable text, button, alert, and tournament card components

Still early or placeholder:

- Player tournament registration button has no action yet
- Player "My Events" uses empty mock arrays
- Explore and home screens still use mock tournament data
- Admin statistics and actions are mostly placeholders
- Tournament creation does not yet create categories, rules, contact info, prize pool, court count, or banner image
- Match generation, fixtures, live scoring, and results are not implemented yet

## Recommended Feature Roadmap

### Phase 1: Make The Core Tournament Flow Real

Goal: replace mock/demo paths with real Supabase data and allow a player to complete the basic journey.

- Load open tournaments from Supabase on Home and Explore.
- Load tournament detail from Supabase by `id`, including categories.
- Add tournament registration flow:
  - Choose category
  - Confirm player details
  - Submit registration
  - Show pending/approved/waitlisted status
- Fill Player "My Events" from the `registrations` table.
- Add empty, loading, error, and refresh states to all real-data screens.
- Add duplicate registration protection in the UI before insert.

### Phase 2: Organizer Tournament Management

Goal: let organizers build and operate a tournament without touching the database directly.

- Add edit tournament screen for draft/open tournaments.
- Add category management:
  - Add category
  - Edit category
  - Set entry fee, max players, skill level, prize
  - Delete category before registrations exist
- Add publish/unpublish controls.
- Add registration management:
  - View pending registrations
  - Approve, reject, or waitlist players
  - See category-wise registration counts
- Add organizer dashboard stats:
  - Total events
  - Open events
  - Pending registrations
  - Upcoming matches

### Phase 3: Fixtures, Draws, And Matches

Goal: make SmashDraw live up to the name by handling tournament draws and match progression.

- Generate fixtures for singles categories.
- Store generated bracket data in `fixture_brackets`.
- Create match rows in `matches`.
- Add bracket view per category.
- Add court assignment and scheduled time per match.
- Add organizer score entry:
  - Winner
  - Score
  - Walkover
  - Match status
- Auto-advance winners to next round.
- Show live and completed matches on tournament detail.

### Phase 4: Payments And Proof Uploads

Goal: support realistic local tournament registration workflows.

- Add payment instructions per tournament or category.
- Add payment screenshot upload using Supabase Storage.
- Add organizer payment verification.
- Add registration status history or notes.
- Add filters for paid, unpaid, approved, rejected, and waitlisted players.

### Phase 5: Profiles, Rankings, And Player Experience

Goal: make the app useful even outside a single registration.

- Add profile editing:
  - Name
  - Phone
  - City/state
  - Skill level
  - Club name
  - Age/gender
  - Avatar
- Add player stats from completed matches.
- Add ranking points calculation.
- Add tournament history.
- Add favorites or saved tournaments.
- Add share tournament link.
- Add reminders for upcoming matches or registration deadlines.

### Phase 6: Admin And Platform Controls

Goal: give admins tools to monitor and moderate the platform.

- Replace admin mock stats with real Supabase aggregate data.
- Add user list filters by role, city, and status.
- Add role management for admins.
- Add tournament moderation:
  - View all tournaments
  - Change status
  - Flag or hide tournament
- Add reports screen:
  - Registrations by month
  - Active organizers
  - Popular cities
  - Completed tournaments

## Small High-Impact Features

These are good candidates when you want visible progress without a large refactor:

- Connect Explore screen to Supabase.
- Make the tournament detail screen fetch real tournament data.
- Add category picker modal to the registration button.
- Wire the player "Browse Tournaments" empty-state button.
- Wire the organizer "Create" button in the player My Events screen.
- Add a banner image upload to tournament creation.
- Add date validation to tournament creation.
- Add city and status filters from live tournament data.
- Add a "Registration closes in X days" label.
- Add contact buttons for phone and email.

## Known Issue Cleanup For Later

You mentioned there are already many issues, so this section is intentionally not the main focus yet. These can become a separate bug backlog later.

- Fix mojibake/encoding artifacts in some comments and display strings.
- Review all placeholder button actions.
- Make sure mock data is removed or clearly isolated.
- Add proper error handling for Supabase queries that currently ignore `error`.
- Add form validation helpers instead of repeated inline checks.
- Add tests or smoke checks for auth, role redirects, and tournament creation.
- Review role and RLS behavior for signup, profile creation, organizer access, and admin access.
- Check package manager consistency because both `package-lock.json` and `yarn.lock` are present.

## Suggested Next Feature To Build First

Start with real tournament browsing:

1. Create a reusable tournament service or store method for fetching tournaments with categories.
2. Replace `MOCK_TOURNAMENTS` on Home, Explore, and Tournament Detail.
3. Add loading, error, and refresh states.
4. Keep the same UI components so the change stays focused.

This unlocks the rest of the player flow and makes future features easier to test against real data.
