import { createContext, useContext, useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { supabase } from '~/lib/supabase';
import { useAuthStore } from '~/store/useAuthStore';

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({ session: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const setUser = useAuthStore((s) => s.setUser);
  const fetchProfile = useAuthStore((s) => s.fetchProfile);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email ?? null, phone: session.user.phone ?? null });
        await fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email ?? null, phone: session.user.phone ?? null });
        fetchProfile(session.user.id);
      } else {
        setUser(null);
      }
    });

    const handleDeepLink = async (url: string) => {
      // PKCE flow: smashdraw://?code=XXX
      const codeMatch = url.match(/[?&]code=([^&]+)/);
      if (codeMatch) {
        await supabase.auth.exchangeCodeForSession(decodeURIComponent(codeMatch[1]));
        return;
      }
      // Implicit flow: smashdraw://#access_token=XXX&refresh_token=XXX
      const hashMatch = url.match(/#(.+)/);
      if (hashMatch) {
        const params = new URLSearchParams(hashMatch[1]);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        if (accessToken && refreshToken) {
          await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        }
      }
    };

    Linking.getInitialURL().then((url) => { if (url) handleDeepLink(url); });
    const linkingSub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));

    return () => {
      subscription.unsubscribe();
      linkingSub.remove();
    };
  }, []);

  return <AuthContext.Provider value={{ session, loading }}>{children}</AuthContext.Provider>;
}

export const useSession = () => useContext(AuthContext);
