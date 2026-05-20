import { create } from 'zustand';
import { supabase } from '~/lib/supabase';
import { UserProfile } from '~/types';

interface AuthUser {
  id: string;
  email: string | null;
  phone: string | null;
}

interface AuthState {
  user: AuthUser | null;
  profile: UserProfile | null;
  profileFetched: boolean;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (email: string, password: string, name: string, role?: 'player' | 'organizer') => Promise<boolean>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<boolean>;
  setUser: (user: AuthUser | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  fetchProfile: (userId: string) => Promise<void>;
  clearError: () => void;
}

function friendlyError(message: string): string {
  if (message.includes('Invalid login credentials')) return 'Incorrect email or password.';
  if (message.includes('Email not confirmed')) return 'Please verify your email first.';
  if (message.includes('User already registered')) return 'An account with this email already exists.';
  if (message.includes('Password should be')) return 'Password must be at least 6 characters.';
  if (message.includes('Unable to validate email')) return 'Please enter a valid email address.';
  return message;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  profileFetched: false,
  loading: false,
  error: null,

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return true;
    } catch (err: any) {
      set({ error: friendlyError(err.message) });
      return false;
    } finally {
      set({ loading: false });
    }
  },

  signup: async (email, password, name, role = 'player') => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name, role }, emailRedirectTo: 'smashdraw://' },
      });
      if (error) throw error;
      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          name,
          email,
          role,
          skill_level: 'beginner',
          ranking_points: 0,
          tournaments_played: 0,
          tournaments_won: 0,
        });
        // Session is available when email confirmation is disabled — sync profile into store immediately
        if (data.session) {
          await get().fetchProfile(data.user.id);
        }
      }
      return true;
    } catch (err: any) {
      set({ error: friendlyError(err.message) });
      return false;
    } finally {
      set({ loading: false });
    }
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null, profile: null, profileFetched: false });
  },

  resetPassword: async (email) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'smashdraw://',
      });
      if (error) throw error;
      return true;
    } catch (err: any) {
      set({ error: friendlyError(err.message) });
      return false;
    } finally {
      set({ loading: false });
    }
  },

  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),

  fetchProfile: async (userId) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();

    // Read the intended role from the locally-cached session metadata (no extra network call).
    const { data: { session } } = await supabase.auth.getSession();
    const metaRole = session?.user?.user_metadata?.role as string | undefined;

    if (data) {
      // Auto-correct role if the signup metadata recorded a higher-privilege role but the DB
      // row has 'player' (can happen from the race-condition bug or a failed signup upsert).
      if (metaRole && metaRole !== data.role && (metaRole === 'organizer' || metaRole === 'admin')) {
        await supabase.from('profiles').update({ role: metaRole }).eq('id', userId);
        set({ profile: { ...data, role: metaRole } as UserProfile, profileFetched: true });
      } else {
        set({ profile: data as UserProfile, profileFetched: true });
      }
    } else {
      // No profile row yet — happens when email confirmation is required and the signup-time
      // upsert had no RLS session. Create from auth user metadata on first login.
      if (metaRole !== undefined || session?.user) {
        const meta = session?.user?.user_metadata ?? {};
        const { data: created } = await supabase
          .from('profiles')
          .upsert({
            id: userId,
            name: meta.name ?? '',
            email: session?.user?.email ?? '',
            role: metaRole ?? 'player',
            skill_level: 'beginner',
            ranking_points: 0,
            tournaments_played: 0,
            tournaments_won: 0,
          })
          .select()
          .single();
        set({ profile: (created ?? null) as UserProfile | null, profileFetched: true });
      } else {
        set({ profileFetched: true });
      }
    }
  },

  clearError: () => set({ error: null }),
}));
