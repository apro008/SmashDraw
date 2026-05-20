import { useState, useMemo, useRef } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from '~/components/AppText';
import { AppButton } from '~/components/AppButton';
import { useAuthStore } from '~/store/useAuthStore';
import { useTheme } from '~/hooks/useTheme';

export default function Login() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, loading, error, clearError } = useAuthStore();
  const passwordRef = useRef<TextInput>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password) return;
    clearError();
    await login(email.trim().toLowerCase(), password);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bottomOffset={16}
      >
          {/* Hero header */}
          <View style={styles.hero}>
            <View style={styles.logoWrap}>
              <Ionicons name="tennisball" size={44} color="#fff" />
            </View>
            <AppText variant="headingLg" weight="bold" color="#fff" center>
              SmashDraw
            </AppText>
            <AppText variant="body" color="rgba(255,255,255,0.75)" center>
              Badminton Tournament Manager
            </AppText>
          </View>

          {/* Form card */}
          <View style={styles.card}>
            <AppText variant="heading" weight="bold">
              Welcome back
            </AppText>
            <AppText variant="body" color={colors.textSecondary} style={{ marginTop: 4 }}>
              Sign in to your account
            </AppText>

            {/* Email */}
            <View style={styles.field}>
              <AppText variant="label" weight="medium" color={colors.textSecondary} style={styles.label}>
                Email
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
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                blurOnSubmit={false}
              />
            </View>

            {/* Password */}
            <View style={styles.field}>
              <AppText variant="label" weight="medium" color={colors.textSecondary} style={styles.label}>
                Password
              </AppText>
              <View>
                <TextInput
                  ref={passwordRef}
                  style={[styles.input, { paddingRight: 48 }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeBtn}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={14} color={colors.danger} />
                <AppText variant="label" color={colors.danger} style={{ marginLeft: 6, flex: 1 }}>
                  {error}
                </AppText>
              </View>
            ) : null}

            <TouchableOpacity style={styles.forgotRow}>
              <Link href="/(auth)/forgot-password">
                <AppText variant="label" color={colors.primary} weight="medium">
                  Forgot password?
                </AppText>
              </Link>
            </TouchableOpacity>

            <AppButton title="Sign In" onPress={handleLogin} loading={loading} style={styles.btn} />

            <View style={styles.signupRow}>
              <AppText variant="body" color={colors.textSecondary}>
                Don't have an account?{' '}
              </AppText>
              <Link href="/(auth)/signup">
                <AppText variant="body" color={colors.primary} weight="semiBold">
                  Sign up
                </AppText>
              </Link>
            </View>
          </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.primary,
    },
    scroll: {
      flexGrow: 1,
    },
    hero: {
      backgroundColor: colors.primary,
      paddingTop: 40,
      paddingBottom: 56,
      alignItems: 'center',
      gap: 8,
    },
    logoWrap: {
      width: 88,
      height: 88,
      borderRadius: 28,
      backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
    },
    card: {
      flex: 1,
      backgroundColor: colors.background,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      padding: 28,
      paddingTop: 32,
      minHeight: 500,
    },
    field: {
      marginTop: 18,
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
    eyeBtn: {
      position: 'absolute',
      right: 14,
      top: 0,
      bottom: 0,
      justifyContent: 'center',
    },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 12,
      padding: 12,
      backgroundColor: '#FEE2E2',
      borderRadius: 10,
    },
    forgotRow: {
      alignSelf: 'flex-end',
      marginTop: 10,
      marginBottom: 4,
    },
    btn: {
      marginTop: 20,
    },
    signupRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 20,
    },
  });
}
