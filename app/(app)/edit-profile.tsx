import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppButton } from '~/components/AppButton';
import { AppText } from '~/components/AppText';
import { StateCityPicker } from '~/components/common/StateCityPicker';
import { useTheme } from '~/hooks/useTheme';
import { supabase } from '~/lib/supabase';
import { useAlert } from '~/providers/AlertProvider';
import { useAuthStore } from '~/store/useAuthStore';
import { Gender, SkillLevel } from '~/types';

const SKILL_OPTIONS: SkillLevel[] = ['beginner', 'intermediate', 'advanced', 'open'];
const GENDER_OPTIONS: Gender[] = ['male', 'female', 'other'];

export default function EditProfileScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { showAlert } = useAlert();
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);

  const [name, setName] = useState(profile?.name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [clubName, setClubName] = useState(profile?.club_name ?? '');
  const [age, setAge] = useState(profile?.age ? String(profile.age) : '');
  const [gender, setGender] = useState<Gender | null>(profile?.gender ?? null);
  const [skillLevel, setSkillLevel] = useState<SkillLevel>(profile?.skill_level ?? 'beginner');
  const [selectedState, setSelectedState] = useState(profile?.state ?? '');
  const [selectedCity, setSelectedCity] = useState(profile?.city ?? '');
  const [saving, setSaving] = useState(false);

  const canSave = !!user?.id && !!name.trim() && !!selectedState && !!selectedCity;

  const saveProfile = async () => {
    if (!user?.id || !canSave) return;

    setSaving(true);
    try {
      const parsedAge = age.trim() ? Number(age.trim()) : null;
      if (parsedAge !== null && (!Number.isFinite(parsedAge) || parsedAge < 1 || parsedAge > 120)) {
        throw new Error('Please enter a valid age.');
      }

      const updates = {
        name: name.trim(),
        phone: phone.trim() || null,
        club_name: clubName.trim() || null,
        age: parsedAge,
        gender,
        skill_level: skillLevel,
        state: selectedState,
        city: selectedCity,
      };

      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select('*')
        .single();

      if (error) throw error;
      setProfile(data);
      showAlert({
        type: 'success',
        title: 'Profile updated',
        message: 'Your profile details have been saved.',
      });
      router.back();
    } catch (err: any) {
      showAlert({
        type: 'danger',
        title: 'Could not save profile',
        message: err?.message ?? 'Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.iconButton}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <AppText variant="title" weight="bold" style={{ flex: 1 }}>
          Edit Profile
        </AppText>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Field
          label="Full name *"
          value={name}
          onChangeText={setName}
          styles={styles}
          colors={colors}
        />
        <Field
          label="Phone"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          styles={styles}
          colors={colors}
        />
        <Field
          label="Club name"
          value={clubName}
          onChangeText={setClubName}
          styles={styles}
          colors={colors}
        />
        <Field
          label="Age"
          value={age}
          onChangeText={setAge}
          keyboardType="number-pad"
          styles={styles}
          colors={colors}
        />

        <AppText
          variant="label"
          weight="medium"
          color={colors.textSecondary}
          style={styles.groupLabel}
        >
          Skill level
        </AppText>
        <View style={styles.segmentRow}>
          {SKILL_OPTIONS.map((option) => (
            <Chip
              key={option}
              label={option}
              selected={skillLevel === option}
              onPress={() => setSkillLevel(option)}
              styles={styles}
              colors={colors}
            />
          ))}
        </View>

        <AppText
          variant="label"
          weight="medium"
          color={colors.textSecondary}
          style={styles.groupLabel}
        >
          Gender
        </AppText>
        <View style={styles.segmentRow}>
          {GENDER_OPTIONS.map((option) => (
            <Chip
              key={option}
              label={option}
              selected={gender === option}
              onPress={() => setGender(option)}
              styles={styles}
              colors={colors}
            />
          ))}
        </View>

        <StateCityPicker
          selectedState={selectedState}
          selectedCity={selectedCity}
          onStateChange={setSelectedState}
          onCityChange={setSelectedCity}
        />

        <View style={styles.roleNote}>
          <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} />
          <AppText variant="caption" color={colors.textSecondary} style={{ flex: 1 }}>
            Account role is managed by SmashDraw and cannot be edited here.
          </AppText>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <AppButton
          title="Save Profile"
          onPress={saveProfile}
          disabled={!canSave}
          loading={saving}
        />
      </View>
    </SafeAreaView>
  );
}

function Field({
  colors,
  keyboardType,
  label,
  onChangeText,
  styles,
  value,
}: {
  colors: ReturnType<typeof useTheme>['colors'];
  keyboardType?: 'default' | 'number-pad' | 'phone-pad';
  label: string;
  onChangeText: (value: string) => void;
  styles: ReturnType<typeof makeStyles>;
  value: string;
}) {
  return (
    <View style={styles.field}>
      <AppText variant="label" weight="medium" color={colors.textSecondary} style={styles.label}>
        {label}
      </AppText>
      <TextInput
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

function Chip({
  colors,
  label,
  onPress,
  selected,
  styles,
}: {
  colors: ReturnType<typeof useTheme>['colors'];
  label: string;
  onPress: () => void;
  selected: boolean;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      style={[styles.chip, selected ? styles.chipSelected : null]}
    >
      <AppText
        variant="label"
        weight={selected ? 'semiBold' : 'regular'}
        color={selected ? colors.primary : colors.textSecondary}
      >
        {label.charAt(0).toUpperCase() + label.slice(1)}
      </AppText>
    </TouchableOpacity>
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
      padding: 20,
      paddingBottom: 32,
    },
    field: {
      marginBottom: 14,
    },
    label: {
      marginBottom: 6,
    },
    input: {
      backgroundColor: colors.inputBg,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      color: colors.text,
      fontFamily: 'Inter_Regular',
      fontSize: 15,
      minHeight: 48,
      paddingHorizontal: 14,
    },
    groupLabel: {
      marginBottom: 8,
      marginTop: 4,
    },
    segmentRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 14,
    },
    chip: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    chipSelected: {
      backgroundColor: colors.primaryLight,
      borderColor: colors.primary,
    },
    roleNote: {
      alignItems: 'flex-start',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 8,
      marginTop: 18,
      padding: 12,
    },
    footer: {
      backgroundColor: colors.background,
      borderTopColor: colors.border,
      borderTopWidth: 1,
      padding: 16,
    },
  });
}
