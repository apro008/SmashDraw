import { useState, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '~/components/AppText';
import { AppButton } from '~/components/AppButton';
import { StateCityPicker } from '~/components/common/StateCityPicker';
import { useTheme } from '~/hooks/useTheme';
import { useAuthStore } from '~/store/useAuthStore';
import { supabase } from '~/lib/supabase';

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);

  const [selectedState, setSelectedState] = useState(profile?.state ?? '');
  const [selectedCity, setSelectedCity] = useState(profile?.city ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!selectedState || !selectedCity || !user) return;
    setSaving(true);
    try {
      await supabase
        .from('profiles')
        .update({ city: selectedCity, state: selectedState })
        .eq('id', user.id);
      if (profile) setProfile({ ...profile, city: selectedCity, state: selectedState });
      router.replace('/(app)/(tabs)');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Icon + heading */}
        <View style={styles.hero}>
          <View style={styles.iconWrap}>
            <Ionicons name="location" size={36} color={colors.primary} />
          </View>
          <AppText variant="heading" weight="bold" center style={{ marginTop: 16 }}>
            Where are you based?
          </AppText>
          <AppText variant="body" color={colors.textSecondary} center style={{ marginTop: 6 }}>
            We will show you tournaments near you first.
          </AppText>
        </View>

        <StateCityPicker
          selectedState={selectedState}
          selectedCity={selectedCity}
          onStateChange={setSelectedState}
          onCityChange={setSelectedCity}
        />

        {/* Actions */}
        <AppButton
          title="Continue"
          onPress={handleSave}
          loading={saving}
          disabled={!selectedState || !selectedCity}
          style={styles.btn}
        />
        <TouchableOpacity onPress={() => router.replace('/(app)/(tabs)')} style={styles.skipBtn}>
          <AppText variant="body" color={colors.textMuted}>
            Skip for now
          </AppText>
        </TouchableOpacity>
      </ScrollView>
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
      padding: 24,
      flexGrow: 1,
    },
    hero: {
      alignItems: 'center',
      marginBottom: 32,
      marginTop: 16,
    },
    iconWrap: {
      width: 80,
      height: 80,
      borderRadius: 24,
      backgroundColor: colors.primaryLight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    btn: {
      marginTop: 32,
      marginBottom: 16,
    },
    skipBtn: {
      alignItems: 'center',
      paddingVertical: 8,
    },
  });
}
