import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '~/components/AppText';
import { useTheme } from '~/hooks/useTheme';

export type AppDatePickerMode = 'date' | 'time' | 'datetime';

interface AppDatePickerProps {
  value: Date | null;
  onChange: (date: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  mode?: AppDatePickerMode;
  label?: string;
  error?: string;
}

function formatValue(value: Date | null, mode: AppDatePickerMode) {
  if (!value) return 'Select';

  if (mode === 'time') {
    return value.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }

  if (mode === 'datetime') {
    return value.toLocaleString('en-IN', {
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  return value.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function AppDatePicker({
  error,
  label,
  maximumDate,
  minimumDate,
  mode = 'date',
  onChange,
  value,
}: AppDatePickerProps) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [iosVisible, setIosVisible] = useState(false);

  const pickerMode = mode === 'datetime' ? 'datetime' : mode;
  const displayValue = formatValue(value, mode);
  const safeValue = value ?? new Date();

  const handleChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      if (event.type === 'set' && selectedDate) onChange(selectedDate);
      return;
    }

    if (selectedDate) onChange(selectedDate);
  };

  const openAndroidPicker = () => {
    DateTimePickerAndroid.open({
      value: safeValue,
      mode: pickerMode === 'datetime' ? 'date' : pickerMode,
      minimumDate,
      maximumDate,
      is24Hour: true,
      onChange: (event, selectedDate) => {
        if (event.type !== 'set' || !selectedDate) return;

        if (mode !== 'datetime') {
          onChange(selectedDate);
          return;
        }

        DateTimePickerAndroid.open({
          value: selectedDate,
          mode: 'time',
          is24Hour: true,
          onChange: (timeEvent, selectedTime) => {
            if (timeEvent.type !== 'set' || !selectedTime) return;
            const next = new Date(selectedDate);
            next.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
            onChange(next);
          },
        });
      },
    });
  };

  const openPicker = () => {
    if (Platform.OS === 'android') {
      openAndroidPicker();
      return;
    }

    setIosVisible((current) => !current);
  };

  return (
    <View style={styles.container}>
      {label ? (
        <AppText variant="label" weight="medium" color={colors.textSecondary} style={styles.label}>
          {label}
        </AppText>
      ) : null}
      <Pressable
        accessibilityRole="button"
        onPress={openPicker}
        style={[styles.input, error ? styles.inputError : null]}
      >
        <AppText variant="body" color={value ? colors.text : colors.textMuted} style={styles.value}>
          {displayValue}
        </AppText>
        <Ionicons
          name={mode === 'time' ? 'time-outline' : 'calendar-outline'}
          size={18}
          color={colors.textSecondary}
        />
      </Pressable>
      {Platform.OS === 'ios' && iosVisible ? (
        <View style={styles.iosPicker}>
          <DateTimePicker
            value={safeValue}
            mode={pickerMode}
            display={mode === 'time' ? 'spinner' : 'inline'}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            themeVariant={isDark ? 'dark' : 'light'}
            onChange={handleChange}
          />
        </View>
      ) : null}
      {error ? (
        <AppText variant="caption" color={colors.danger} style={styles.error}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    container: {
      gap: 6,
    },
    label: {
      marginBottom: 0,
    },
    input: {
      alignItems: 'center',
      backgroundColor: colors.inputBg,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 10,
      minHeight: 48,
      paddingHorizontal: 14,
    },
    inputError: {
      borderColor: colors.danger,
    },
    value: {
      flex: 1,
    },
    iosPicker: {
      backgroundColor: colors.inputBg,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      overflow: 'hidden',
    },
    error: {
      marginTop: 2,
    },
  });
}
