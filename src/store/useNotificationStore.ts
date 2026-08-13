import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '~/lib/supabase';
import {
  deleteNotification,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  registerPushToken,
  setAppBadgeCount,
  unregisterPushToken,
} from '~/lib/notifications';
import { AppNotification } from '~/types';

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  pushToken: string | null;
  channel: RealtimeChannel | null;

  init: (userId: string) => Promise<void>;
  refresh: (userId: string) => Promise<void>;
  markRead: (notificationId: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  remove: (notificationId: string) => Promise<void>;
  teardown: (options?: { removeToken?: boolean }) => Promise<void>;
}

function countUnread(notifications: AppNotification[]) {
  return notifications.filter((n) => n.read_at === null).length;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,
  pushToken: null,
  channel: null,

  /** Register the device, load the feed, and subscribe to live inserts. */
  init: async (userId) => {
    await get().refresh(userId);

    // Push registration is best-effort — a declined prompt or a simulator
    // should never break the in-app feed.
    registerPushToken(userId)
      .then((token) => set({ pushToken: token }))
      .catch(() => {});

    if (get().channel) return;

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const incoming = payload.new as AppNotification;
          set((state) => {
            if (state.notifications.some((n) => n.id === incoming.id)) return state;
            const notifications = [incoming, ...state.notifications];
            const unreadCount = countUnread(notifications);
            setAppBadgeCount(unreadCount);
            return { notifications, unreadCount };
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as AppNotification;
          set((state) => {
            const notifications = state.notifications.map((n) =>
              n.id === updated.id ? updated : n
            );
            return { notifications, unreadCount: countUnread(notifications) };
          });
        }
      )
      .subscribe();

    set({ channel });
  },

  refresh: async (userId) => {
    set({ loading: true, error: null });
    try {
      const notifications = await fetchNotifications(userId);
      const unreadCount = countUnread(notifications);
      set({ notifications, unreadCount });
      setAppBadgeCount(unreadCount);
    } catch (err: any) {
      set({ error: err?.message ?? 'Unable to load notifications.' });
    } finally {
      set({ loading: false });
    }
  },

  markRead: async (notificationId) => {
    const target = get().notifications.find((n) => n.id === notificationId);
    if (!target || target.read_at !== null) return;

    const readAt = new Date().toISOString();
    const optimistic = get().notifications.map((n) =>
      n.id === notificationId ? { ...n, read_at: readAt } : n
    );
    const unreadCount = countUnread(optimistic);
    set({ notifications: optimistic, unreadCount });
    setAppBadgeCount(unreadCount);

    try {
      await markNotificationRead(notificationId);
    } catch {
      // Roll back so the badge does not lie.
      const rolledBack = get().notifications.map((n) =>
        n.id === notificationId ? { ...n, read_at: null } : n
      );
      set({ notifications: rolledBack, unreadCount: countUnread(rolledBack) });
    }
  },

  markAllRead: async () => {
    const previous = get().notifications;
    if (previous.every((n) => n.read_at !== null)) return;

    const readAt = new Date().toISOString();
    set({
      notifications: previous.map((n) => (n.read_at ? n : { ...n, read_at: readAt })),
      unreadCount: 0,
    });
    setAppBadgeCount(0);

    try {
      await markAllNotificationsRead();
    } catch {
      set({ notifications: previous, unreadCount: countUnread(previous) });
    }
  },

  remove: async (notificationId) => {
    const previous = get().notifications;
    const next = previous.filter((n) => n.id !== notificationId);
    const unreadCount = countUnread(next);
    set({ notifications: next, unreadCount });
    setAppBadgeCount(unreadCount);

    try {
      await deleteNotification(notificationId);
    } catch {
      set({ notifications: previous, unreadCount: countUnread(previous) });
    }
  },

  teardown: async ({ removeToken = false } = {}) => {
    const { channel } = get();
    if (channel) {
      await supabase.removeChannel(channel);
    }

    if (removeToken) {
      await unregisterPushToken().catch(() => {});
    }

    setAppBadgeCount(0);
    set({
      notifications: [],
      unreadCount: 0,
      loading: false,
      error: null,
      pushToken: null,
      channel: null,
    });
  },
}));
