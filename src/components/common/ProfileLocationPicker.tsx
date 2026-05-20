import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppButton } from '~/components/AppButton';
import { AppText } from '~/components/AppText';
import { StateCityPicker } from '~/components/common/StateCityPicker';
import { useTheme } from '~/hooks/useTheme';
import { supabase } from '~/lib/supabase';
import { useAuthStore } from '~/store/useAuthStore';

interface ProfileLocationPickerProps {
  visible: boolean;
  onClose: () => void;
}

export function ProfileLocationPicker({ onClose, visible }: ProfileLocationPickerProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);
  const [selectedState, setSelectedState] = useState(profile?.state ?? '');
  const [selectedCity, setSelectedCity] = useState(profile?.city ?? '');
  const [saving, setSaving] = useState(false);

  const saveLocation = async () => {
    if (!user || !selectedState || !selectedCity) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ state: selectedState, city: selectedCity })
        .eq('id', user.id);
      if (error) throw error;
      if (profile) setProfile({ ...profile, state: selectedState, city: selectedCity });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <AppText variant="title" weight="bold">
            Profile Location
          </AppText>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={20} color={colors.text} />
          </Pressable>
        </View>
        <StateCityPicker
          selectedState={selectedState}
          selectedCity={selectedCity}
          onStateChange={setSelectedState}
          onCityChange={setSelectedCity}
        />
        <AppButton
          title="Save Location"
          onPress={saveLocation}
          loading={saving}
          disabled={!selectedState || !selectedCity}
          style={styles.button}
        />
      </View>
    </Modal>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay,
    },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      bottom: 0,
      left: 0,
      paddingBottom: 28,
      paddingHorizontal: 20,
      paddingTop: 18,
      position: 'absolute',
      right: 0,
    },
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    closeButton: {
      alignItems: 'center',
      height: 36,
      justifyContent: 'center',
      width: 36,
    },
    button: {
      marginTop: 24,
    },
  });
}
