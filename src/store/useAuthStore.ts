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
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (email: string, password: string, name: string) => Promise<boolean>;
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

  signup: async (email, password, name) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });
      if (error) throw error;
      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          name,
          email,
          role: 'player',
          skill_level: 'beginner',
          ranking_points: 0,
          tournaments_played: 0,
          tournaments_won: 0,
        });
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
    set({ user: null, profile: null });
  },

  resetPassword: async (email) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
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
    if (data) set({ profile: data as UserProfile });
  },

  clearError: () => set({ error: null }),
}));
