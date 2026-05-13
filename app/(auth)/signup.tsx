import { useState, useMemo } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Link, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from '~/components/AppText';
import { AppButton } from '~/components/AppButton';
import { useAuthStore } from '~/store/useAuthStore';
import { useTheme } from '~/hooks/useTheme';

export default function Signup() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { signup, loading, error, clearError } = useAuthStore();

  const handleSignup = async () => {
    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Password mismatch', 'Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters.');
      return;
    }
    clearError();
    const success = await signup(email.trim().toLowerCase(), password, name.trim());
    if (success) {
      Alert.alert(
        'Account created!',
        'Check your email to verify your account, then sign in.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
      );
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={styles.logoWrap}>
              <Ionicons name="tennisball" size={36} color="#fff" />
            </View>
            <AppText variant="heading" weight="bold" color="#fff" center>
              Create Account
            </AppText>
            <AppText variant="body" color="rgba(255,255,255,0.75)" center>
              Join the badminton community
            </AppText>
          </View>

          {/* Form card */}
          <View style={styles.card}>
            {/* Full name */}
            <View style={styles.field}>
              <AppText variant="label" weight="medium" color={colors.textSecondary} style={styles.label}>
                Full Name
              </AppText>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Prakash Padukone"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
                returnKeyType="next"
              />
            </View>

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
              />
            </View>

            {/* Password */}
            <View style={styles.field}>
              <AppText variant="label" weight="medium" color={colors.textSecondary} style={styles.label}>
                Password
              </AppText>
              <View>
                <TextInput
                  style={[styles.input, { paddingRight: 48 }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Min. 6 characters"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showPassword}
                  returnKeyType="next"
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

            {/* Confirm Password */}
            <View style={styles.field}>
              <AppText variant="label" weight="medium" color={colors.textSecondary} style={styles.label}>
                Confirm Password
              </AppText>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleSignup}
              />
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={14} color={colors.danger} />
                <AppText variant="label" color={colors.danger} style={{ marginLeft: 6, flex: 1 }}>
                  {error}
                </AppText>
              </View>
            ) : null}

            <AppButton
              title="Create Account"
              onPress={handleSignup}
              loading={loading}
              style={styles.btn}
            />

            <View style={styles.loginRow}>
              <AppText variant="body" color={colors.textSecondary}>
                Already have an account?{' '}
              </AppText>
              <Link href="/(auth)/login">
                <AppText variant="body" color={colors.primary} weight="semiBold">
                  Sign in
                </AppText>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    header: {
      backgroundColor: colors.primary,
      paddingTop: 16,
      paddingBottom: 48,
      alignItems: 'center',
      gap: 8,
    },
    backBtn: {
      alignSelf: 'flex-start',
      marginLeft: 16,
      marginBottom: 16,
      padding: 4,
    },
    logoWrap: {
      width: 72,
      height: 72,
      borderRadius: 22,
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
    btn: {
      marginTop: 24,
    },
    loginRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 20,
    },
  });
}
