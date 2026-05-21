import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { SkeletonLoader } from '~/components/common/SkeletonLoader';
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
      <View style={{ flex: 1, padding: 20, paddingTop: 72, backgroundColor: colors.background }}>
        <SkeletonLoader variant="detail" count={2} />
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
