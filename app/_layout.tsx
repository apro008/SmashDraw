import { useEffect } from 'react';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { AuthProvider } from '~/providers/AuthProvider';
import { AlertProvider } from '~/providers/AlertProvider';
import { NotificationProvider } from '~/providers/NotificationProvider';
import { useTheme } from '~/hooks/useTheme';
import { SplashLoader } from '~/components/SplashLoader';

SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 600, fade: true });

export default function RootLayout() {
  const [loaded] = useFonts({
    Inter_Regular: require('../assets/fonts/Inter_Regular.ttf'),
    Inter_Medium: require('../assets/fonts/Inter_Medium.ttf'),
    Inter_SemiBold: require('../assets/fonts/Inter_SemiBold.ttf'),
    Inter_Bold: require('../assets/fonts/Inter_Bold.ttf'),
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return <SplashLoader />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <AuthProvider>
          <AlertProvider>
            <NotificationProvider>
              <RootStack />
            </NotificationProvider>
          </AlertProvider>
        </AuthProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

function RootStack() {
  const { isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
