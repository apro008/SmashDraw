import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { configureNotificationHandler } from '~/lib/notifications';
import { useSession } from '~/providers/AuthProvider';
import { useNotificationStore } from '~/store/useNotificationStore';

// Foreground presentation rules are global — set them once at module load.
configureNotificationHandler();

/** Route a tapped notification to the screen it refers to. */
function openFromNotification(data: Record<string, unknown> | undefined) {
  const tournamentId = data?.tournamentId;
  const notificationId = data?.notificationId;

  if (typeof notificationId === 'string') {
    useNotificationStore.getState().markRead(notificationId);
  }

  if (typeof tournamentId === 'string' && tournamentId) {
    router.push({ pathname: '/(app)/tournament/[id]', params: { id: tournamentId } });
    return;
  }

  router.push('/(app)/notifications');
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { session } = useSession();
  const userId = session?.user?.id ?? null;
  const previousUserId = useRef<string | null>(null);
  const handledColdStart = useRef(false);

  // Bring the feed up (and register the device) for whoever is signed in.
  useEffect(() => {
    const { init, teardown } = useNotificationStore.getState();

    if (userId) {
      init(userId);
    } else if (previousUserId.current) {
      // Signed out — drop this device's token so the next user is not spammed.
      teardown({ removeToken: true });
    }

    previousUserId.current = userId;
  }, [userId]);

  // Taps on a delivered notification.
  useEffect(() => {
    if (!userId) return;

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      openFromNotification(
        response.notification.request.content.data as Record<string, unknown> | undefined
      );
    });

    // The app may have been launched cold by a tap — that response is not
    // replayed through the listener above.
    if (!handledColdStart.current) {
      handledColdStart.current = true;
      Notifications.getLastNotificationResponseAsync().then((response) => {
        if (!response) return;
        openFromNotification(
          response.notification.request.content.data as Record<string, unknown> | undefined
        );
      });
    }

    return () => responseSub.remove();
  }, [userId]);

  // Realtime can miss events while the app is backgrounded — resync on resume.
  useEffect(() => {
    if (!userId) return;

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        useNotificationStore.getState().refresh(userId);
      }
    });

    return () => subscription.remove();
  }, [userId]);

  return <>{children}</>;
}
