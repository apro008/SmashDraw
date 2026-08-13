import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '~/components/AppText';
import { useTheme } from '~/hooks/useTheme';
import { isGoogleSignInAvailable } from '~/lib/googleAuth';
import { useAuthStore } from '~/store/useAuthStore';

/** Google blue, from their brand palette. */
const GOOGLE_BLUE = '#4285F4';

interface GoogleSignInButtonProps {
  /** Shown on the button — "Continue with Google" reads better on signup. */
  label?: string;
  /** Disable while the email/password form is mid-submit. */
  disabled?: boolean;
}

export function GoogleSignInButton({
  label = 'Continue with Google',
  disabled = false,
}: GoogleSignInButtonProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle);
  const googleLoading = useAuthStore((s) => s.googleLoading);

  // Nothing to show in builds without the client IDs (Expo Go, web, unconfigured).
  if (!isGoogleSignInAvailable()) return null;

  const isDisabled = disabled || googleLoading;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: googleLoading }}
      activeOpacity={0.8}
      disabled={isDisabled}
      onPress={loginWithGoogle}
      style={[styles.button, isDisabled && styles.disabled]}
    >
      {googleLoading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <View style={styles.content}>
          <Ionicons name="logo-google" size={18} color={GOOGLE_BLUE} />
          <AppText variant="bodyLg" weight="semiBold">
            {label}
          </AppText>
        </View>
      )}
    </TouchableOpacity>
  );
}

/** "or" rule to sit between the password form and the Google button. */
export function AuthDivider({ label = 'or' }: { label?: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.divider}>
      <View style={styles.dividerLine} />
      <AppText variant="label" color={colors.textMuted}>
        {label}
      </AppText>
      <View style={styles.dividerLine} />
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    button: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1.5,
      height: 50,
      justifyContent: 'center',
      paddingHorizontal: 20,
      width: '100%',
    },
    disabled: {
      opacity: 0.5,
    },
    content: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
    },
    divider: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
      marginVertical: 18,
    },
    dividerLine: {
      backgroundColor: colors.border,
      flex: 1,
      height: 1,
    },
  });
}
