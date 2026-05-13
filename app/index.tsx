import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useSession } from '~/providers/AuthProvider';
import { useTheme } from '~/hooks/useTheme';

export default function Index() {
  const { session, loading } = useSession();
  const { colors } = useTheme();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return <Redirect href={session ? '/(app)/(tabs)' : '/(auth)/login'} />;
}
