import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

if (__DEV__ && supabaseUrl) {
  const _fetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
    const isSupabase = url.includes(supabaseUrl);
    if (isSupabase) {
      const method = init?.method ?? 'GET';
      console.log(`\n[API →] ${method} ${url}`);
      if (init?.body) {
        try {
          console.log('[API →] Body:', JSON.parse(init.body as string));
        } catch {}
      }
    }
    const res = await _fetch(input, init);
    if (isSupabase) {
      res
        .clone()
        .json()
        .then((data: unknown) => console.log(`[API ←] ${res.status}`, data))
        .catch(() => {});
    }
    return res;
  };
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
