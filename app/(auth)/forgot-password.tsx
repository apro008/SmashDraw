import { useState, useMemo } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from '~/components/AppText';
import { AppButton } from '~/components/AppButton';
import { useAuthStore } from '~/store/useAuthStore';
import { useTheme } from '~/hooks/useTheme';
import { useAlert } from '~/providers/AlertProvider';

export default function ForgotPassword() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [email, setEmail] = useState('');
  const { resetPassword, loading, clearError } = useAuthStore();
  const { showAlert } = useAlert();

  const handleReset = async () => {
    if (!email.trim()) {
      showAlert({ type: 'warning', title: 'Email required', message: 'Please enter your email address.' });
      return;
    }
    clearError();
    const success = await resetPassword(email.trim().toLowerCase());
    if (success) {
      showAlert({
        type: 'success',
        title: 'Email sent',
        message: 'Check your inbox for password reset instructions.',
        onConfirm: () => router.back(),
      });
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bottomOffset={16}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.content}>
          <View style={styles.iconWrap}>
            <Ionicons name="lock-open-outline" size={40} color={colors.primary} />
          </View>

          <AppText variant="headingLg" weight="bold" center>
            Forgot Password?
          </AppText>
          <AppText variant="body" color={colors.textSecondary} center style={styles.subtitle}>
            Enter your email and we'll send you a link to reset your password.
          </AppText>

          <View style={styles.field}>
            <AppText variant="label" weight="medium" color={colors.textSecondary} style={styles.label}>
              Email address
            </AppText>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleReset}
            />
          </View>

          <AppButton title="Send Reset Link" onPress={handleReset} loading={loading} style={styles.btn} />

          <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
            <AppText variant="body" color={colors.textSecondary}>
              Back to{' '}
              <AppText variant="body" color={colors.primary} weight="semiBold">
                Sign In
              </AppText>
            </AppText>
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      flexGrow: 1,
    },
    backBtn: {
      margin: 16,
      padding: 4,
      alignSelf: 'flex-start',
    },
    content: {
      flex: 1,
      paddingHorizontal: 28,
      paddingTop: 24,
      alignItems: 'center',
    },
    iconWrap: {
      width: 96,
      height: 96,
      borderRadius: 28,
      backgroundColor: colors.primaryLight,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 28,
    },
    subtitle: {
      marginTop: 10,
      marginBottom: 8,
      lineHeight: 22,
    },
    field: {
      width: '100%',
      marginTop: 28,
    },
    label: {
      marginBottom: 6,
    },
    input: {
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      minHeight: 48,
      paddingHorizontal: 14,
      fontSize: 15,
      color: colors.text,
      fontFamily: 'Inter_Regular',
    },
    btn: {
      marginTop: 24,
      width: '100%',
    },
    backLink: {
      marginTop: 20,
    },
  });
}
