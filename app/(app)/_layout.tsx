import { useEffect } from 'react';
import { Stack, Redirect, router } from 'expo-router';
import { View } from 'react-native';
import { SkeletonLoader } from '~/components/common/SkeletonLoader';
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
      <View style={{ flex: 1, padding: 20, paddingTop: 72, backgroundColor: colors.background }}>
        <SkeletonLoader variant="detail" count={2} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
