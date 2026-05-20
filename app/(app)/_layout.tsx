import { useEffect } from 'react';
import { Stack, Redirect, router } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useSession } from '~/providers/AuthProvider';
import { useAuthStore } from '~/store/useAuthStore';
import { useTheme } from '~/hooks/useTheme';

export default function AppLayout() {
  const { session, loading } = useSession();
  const profile = useAuthStore((s) => s.profile);
  const { colors } = useTheme();

  useEffect(() => {
    if (!loading && session && profile !== null && !profile.city) {
      router.replace('/(app)/onboarding');
    }
  }, [loading, session, profile]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
