import { ReactNode, useMemo } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '~/components/AppText';
import { useTheme } from '~/hooks/useTheme';

interface StaticPageProps {
  title: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: ReactNode;
}

export function StaticPage({ children, icon, subtitle, title }: StaticPageProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

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
        <AppText variant="title" weight="bold" style={{ flex: 1 }}>
          {title}
        </AppText>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name={icon} size={26} color={colors.primary} />
          </View>
          <AppText variant="heading" weight="bold">
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="body" color={colors.textSecondary} style={styles.subtitle}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function InfoBlock({
  body,
  icon,
  title,
}: {
  body: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.block}>
      <View style={styles.blockIcon}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="bodyLg" weight="semiBold">
          {title}
        </AppText>
        <AppText variant="body" color={colors.textSecondary} style={styles.blockBody}>
          {body}
        </AppText>
      </View>
    </View>
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
    scroll: {
      gap: 12,
      padding: 20,
      paddingBottom: 36,
    },
    hero: {
      marginBottom: 10,
    },
    heroIcon: {
      alignItems: 'center',
      backgroundColor: colors.primaryLight,
      borderRadius: 16,
      height: 52,
      justifyContent: 'center',
      marginBottom: 14,
      width: 52,
    },
    subtitle: {
      lineHeight: 22,
      marginTop: 6,
    },
    block: {
      alignItems: 'flex-start',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 12,
      padding: 16,
    },
    blockIcon: {
      alignItems: 'center',
      backgroundColor: colors.primaryLight,
      borderRadius: 12,
      height: 38,
      justifyContent: 'center',
      width: 38,
    },
    blockBody: {
      lineHeight: 21,
      marginTop: 4,
    },
  });
}
