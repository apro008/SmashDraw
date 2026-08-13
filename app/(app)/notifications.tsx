import { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from '~/components/AppText';
import { SkeletonLoader } from '~/components/common/SkeletonLoader';
import { useTheme } from '~/hooks/useTheme';
import { formatRelativeTime, notificationIcon, notificationTone } from '~/lib/notifications';
import { useAuthStore } from '~/store/useAuthStore';
import { useNotificationStore } from '~/store/useNotificationStore';
import { AppNotification } from '~/types';

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const userId = useAuthStore((s) => s.user?.id);

  const notifications = useNotificationStore((s) => s.notifications);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const loading = useNotificationStore((s) => s.loading);
  const error = useNotificationStore((s) => s.error);
  const refresh = useNotificationStore((s) => s.refresh);
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const remove = useNotificationStore((s) => s.remove);

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    if (!userId) return;
    setRefreshing(true);
    await refresh(userId);
    setRefreshing(false);
  }, [refresh, userId]);

  const onPressNotification = useCallback(
    (notification: AppNotification) => {
      markRead(notification.id);
      if (notification.tournament_id) {
        router.push({
          pathname: '/(app)/tournament/[id]',
          params: { id: notification.tournament_id },
        });
      }
    },
    [markRead]
  );

  const toneColor = useCallback(
    (notification: AppNotification) => {
      const tone = notificationTone(notification.type);
      return colors[tone];
    },
    [colors]
  );

  const renderItem = useCallback(
    ({ item }: { item: AppNotification }) => {
      const accent = toneColor(item);
      const unread = item.read_at === null;

      return (
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.85}
          onPress={() => onPressNotification(item)}
          style={[styles.card, unread && styles.cardUnread]}
        >
          <View style={[styles.cardIcon, { backgroundColor: accent + '1F' }]}>
            <Ionicons
              name={notificationIcon(item.type) as keyof typeof Ionicons.glyphMap}
              size={18}
              color={accent}
            />
          </View>

          <View style={styles.cardBody}>
            <View style={styles.cardHeader}>
              <AppText variant="bodyLg" weight="semiBold" numberOfLines={1} style={{ flex: 1 }}>
                {item.title}
              </AppText>
              {unread ? <View style={[styles.dot, { backgroundColor: accent }]} /> : null}
            </View>

            <AppText variant="body" color={colors.textSecondary} style={styles.cardText}>
              {item.body}
            </AppText>

            <AppText variant="xs" color={colors.textMuted} style={styles.cardTime}>
              {formatRelativeTime(item.created_at)}
            </AppText>
          </View>

          <TouchableOpacity
            accessibilityLabel="Dismiss notification"
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => remove(item.id)}
            style={styles.dismiss}
          >
            <Ionicons name="close" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </TouchableOpacity>
      );
    },
    [colors, onPressNotification, remove, styles, toneColor]
  );

  const showSkeleton = loading && notifications.length === 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.iconButton}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <AppText variant="title" weight="bold">
            Notifications
          </AppText>
          {unreadCount > 0 ? (
            <AppText variant="xs" color={colors.textMuted}>
              {unreadCount} unread
            </AppText>
          ) : null}
        </View>

        {unreadCount > 0 ? (
          <TouchableOpacity accessibilityRole="button" onPress={markAllRead} hitSlop={8}>
            <AppText variant="sm" weight="semiBold" color={colors.primary}>
              Mark all read
            </AppText>
          </TouchableOpacity>
        ) : null}
      </View>

      {showSkeleton ? (
        <View style={styles.skeleton}>
          <SkeletonLoader variant="detail" count={3} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, notifications.length === 0 && styles.listEmpty]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="notifications-outline" size={28} color={colors.primary} />
              </View>
              <AppText variant="bodyLg" weight="semiBold" center>
                {error ? 'Could not load notifications' : 'Nothing yet'}
              </AppText>
              <AppText variant="body" color={colors.textSecondary} center style={styles.emptyText}>
                {error ?? 'Registration updates, match schedules, and results will show up here.'}
              </AppText>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    safe: {
      backgroundColor: colors.background,
      flex: 1,
    },
    header: {
      alignItems: 'center',
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    iconButton: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 18,
      height: 36,
      justifyContent: 'center',
      width: 36,
    },
    skeleton: {
      padding: 20,
    },
    list: {
      gap: 10,
      padding: 16,
      paddingBottom: 36,
    },
    listEmpty: {
      flexGrow: 1,
      justifyContent: 'center',
    },
    card: {
      alignItems: 'flex-start',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 12,
      padding: 14,
    },
    cardUnread: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.primary,
    },
    cardIcon: {
      alignItems: 'center',
      borderRadius: 12,
      height: 38,
      justifyContent: 'center',
      width: 38,
    },
    cardBody: {
      flex: 1,
    },
    cardHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    dot: {
      borderRadius: 4,
      height: 8,
      width: 8,
    },
    cardText: {
      lineHeight: 20,
      marginTop: 3,
    },
    cardTime: {
      marginTop: 8,
    },
    dismiss: {
      paddingLeft: 4,
      paddingTop: 2,
    },
    empty: {
      alignItems: 'center',
      padding: 24,
    },
    emptyIcon: {
      alignItems: 'center',
      backgroundColor: colors.primaryLight,
      borderRadius: 18,
      height: 60,
      justifyContent: 'center',
      marginBottom: 14,
      width: 60,
    },
    emptyText: {
      lineHeight: 21,
      marginTop: 6,
    },
  });
}
