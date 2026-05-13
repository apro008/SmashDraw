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

Copy `.env.example` to `.env` and fill in your Supabase credentials:
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

## Supabase Database Tables

profiles, tournaments, tournament_categories, registrations, matches, fixture_brackets

See `supabase/schema.sql` for full schema.

## Common Style Values

- Form field spacing: `marginBottom: 14` or `gap: 18`
- Label: `fontSize: 13, fontWeight: 'medium', color: colors.textSecondary, marginBottom: 6`
- Input: `minHeight: 48`, border radius 12
- Cards: border radius 16, shadow with `colors.shadow`
- Font family: Inter (Regular, Medium, SemiBold, Bold)
