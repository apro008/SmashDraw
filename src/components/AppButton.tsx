import { TouchableOpacity, ActivityIndicator, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '~/hooks/useTheme';
import { AppText } from './AppText';
import { useMemo } from 'react';

interface AppButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'outline' | 'ghost' | 'danger';
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
}

export function AppButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  style,
  fullWidth = true,
}: AppButtonProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[
        styles.base,
        styles[variant],
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? '#fff' : colors.primary} />
      ) : (
        <AppText
          variant="bodyLg"
          weight="semiBold"
          color={
            variant === 'primary' || variant === 'danger'
              ? '#fff'
              : variant === 'outline'
                ? colors.primary
                : colors.text
          }
        >
          {title}
        </AppText>
      )}
    </TouchableOpacity>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    base: {
      height: 50,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
    },
    fullWidth: {
      width: '100%',
    },
    primary: {
      backgroundColor: colors.primary,
    },
    outline: {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: colors.primary,
    },
    ghost: {
      backgroundColor: 'transparent',
    },
    danger: {
      backgroundColor: colors.danger,
    },
    disabled: {
      opacity: 0.5,
    },
  });
}
