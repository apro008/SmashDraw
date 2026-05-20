import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useSession } from '~/providers/AuthProvider';
import { useAuthStore } from '~/store/useAuthStore';
import { useTheme } from '~/hooks/useTheme';

export default function Index() {
  const { session, loading } = useSession();
  const profile = useAuthStore((s) => s.profile);
  const profileFetched = useAuthStore((s) => s.profileFetched);
  const { colors } = useTheme();

  if (loading || (session && !profileFetched)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  if (profile?.role === 'admin') {
    return <Redirect href="/(app)/(admin-tabs)" />;
  }
  if (profile?.role === 'organizer') {
    return <Redirect href="/(app)/(organizer-tabs)" />;
  }
  return <Redirect href="/(app)/(tabs)" />;
}
