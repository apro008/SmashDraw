import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { supabase } from '~/lib/supabase';
import { AppNotification, NotificationType } from '~/types';

/** Foreground behaviour — show the banner even while the app is open. */
export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

/** Android needs an explicit channel or notifications arrive silently. */
async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('default', {
    name: 'Tournament updates',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#1A73E8',
    sound: 'default',
  });
}

function getProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId
  );
}

/**
 * Asks for permission and returns the device's Expo push token.
 * Returns null on simulators, on web, or when the user declines.
 */
export async function getExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null;
  if (Platform.OS === 'web') return null;

  await ensureAndroidChannel();

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let status = existingStatus;

  if (status !== 'granted') {
    const request = await Notifications.requestPermissionsAsync();
    status = request.status;
  }

  if (status !== 'granted') return null;

  const projectId = getProjectId();
  if (!projectId) {
    console.warn('[notifications] Missing EAS projectId — cannot get a push token.');
    return null;
  }

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch (err) {
    console.warn('[notifications] Failed to get push token', err);
    return null;
  }
}

/**
 * Registers this device against the signed-in user. Safe to call on every
 * launch — the token is unique, so re-registering just re-points the row.
 */
export async function registerPushToken(userId: string): Promise<string | null> {
  const token = await getExpoPushToken();
  if (!token) return null;

  const { error } = await supabase.from('push_tokens').upsert(
    {
      user_id: userId,
      token,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      device_name: Device.deviceName ?? Device.modelName ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'token' }
  );

  if (error) {
    console.warn('[notifications] Failed to save push token', error.message);
    return null;
  }

  return token;
}

/** Called on logout so the next user of this device does not get the old user's pushes. */
export async function unregisterPushToken() {
  const token = await Notifications.getExpoPushTokenAsync({
    projectId: getProjectId(),
  })
    .then(({ data }) => data)
    .catch(() => null);

  if (!token) return;

  await supabase.from('push_tokens').delete().eq('token', token);
}

// ────────────────────────────────────────────
// Feed queries
// ────────────────────────────────────────────

export async function fetchNotifications(userId: string, limit = 50) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as AppNotification[];
}

export async function fetchUnreadCount(userId: string) {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationRead(notificationId: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .is('read_at', null);

  if (error) throw error;
}

export async function markAllNotificationsRead() {
  const { error } = await supabase.rpc('mark_all_notifications_read');
  if (error) throw error;
}

export async function deleteNotification(notificationId: string) {
  const { error } = await supabase.from('notifications').delete().eq('id', notificationId);
  if (error) throw error;
}

/** Organizer/admin broadcast to everyone registered in a tournament. */
export async function sendTournamentAnnouncement(
  tournamentId: string,
  title: string,
  body: string
) {
  const { data, error } = await supabase.rpc('send_tournament_announcement', {
    p_tournament_id: tournamentId,
    p_title: title,
    p_body: body,
  });

  if (error) throw error;
  return (data as number) ?? 0;
}

/** Keeps the app icon badge in sync with the unread count. */
export async function setAppBadgeCount(count: number) {
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch {
    // Badges are unsupported on some Android launchers — not worth surfacing.
  }
}

// ────────────────────────────────────────────
// Presentation helpers
// ────────────────────────────────────────────

const NOTIFICATION_ICONS: Record<NotificationType, string> = {
  registration_approved: 'checkmark-circle-outline',
  registration_rejected: 'close-circle-outline',
  registration_waitlisted: 'hourglass-outline',
  registration_received: 'person-add-outline',
  match_scheduled: 'calendar-outline',
  match_result: 'trophy-outline',
  tournament_status: 'megaphone-outline',
  tournament_published: 'sparkles-outline',
  announcement: 'megaphone-outline',
};

export function notificationIcon(type: NotificationType) {
  return NOTIFICATION_ICONS[type] ?? 'notifications-outline';
}

/** Semantic colour key from the theme, chosen per notification type. */
export function notificationTone(
  type: NotificationType
): 'win' | 'loss' | 'ongoing' | 'upcoming' | 'primary' {
  switch (type) {
    case 'registration_approved':
      return 'win';
    case 'registration_rejected':
      return 'loss';
    case 'registration_waitlisted':
      return 'ongoing';
    case 'match_scheduled':
      return 'upcoming';
    case 'match_result':
      return 'win';
    case 'tournament_published':
      return 'upcoming';
    default:
      return 'primary';
  }
}

export function formatRelativeTime(iso: string) {
  const then = new Date(iso).getTime();
  const diffSeconds = Math.floor((Date.now() - then) / 1000);

  if (diffSeconds < 60) return 'Just now';
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
  if (diffSeconds < 604800) return `${Math.floor(diffSeconds / 86400)}d ago`;

  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
