import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '~/hooks/useTheme';
import { ThemeColors } from '~/constants/Colors';
import { AppText } from './AppText';
import type { AlertConfig, AlertType } from '~/providers/AlertProvider';

interface CustomAlertProps {
  visible: boolean;
  config: AlertConfig | null;
  onConfirm: () => void;
  onCancel: () => void;
}

const SPRING = { damping: 20, stiffness: 300, mass: 0.8 };

function getTypeConfig(type: AlertType, colors: ThemeColors) {
  switch (type) {
    case 'success':
      return {
        icon: 'checkmark-circle' as const,
        color: colors.success,
        bg: `${colors.success}22`,
      };
    case 'warning':
      return { icon: 'warning' as const, color: colors.ongoing, bg: `${colors.ongoing}22` };
    case 'danger':
      return { icon: 'close-circle' as const, color: colors.danger, bg: `${colors.danger}1E` };
    case 'confirm':
      return {
        icon: 'alert-circle' as const,
        color: colors.primary,
        bg: colors.primaryLight,
      };
    default:
      return {
        icon: 'information-circle' as const,
        color: colors.primary,
        bg: colors.primaryLight,
      };
  }
}

export function CustomAlert({ visible, config, onConfirm, onCancel }: CustomAlertProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [modalVisible, setModalVisible] = useState(false);

  const backdropOpacity = useSharedValue(0);
  const scale = useSharedValue(0.85);
  const translateY = useSharedValue(24);
  const dialogOpacity = useSharedValue(0);

  const hideModal = useCallback(() => setModalVisible(false), []);

  useEffect(() => {
    if (visible) {
      setModalVisible(true);
      backdropOpacity.value = withTiming(1, { duration: 220 });
      dialogOpacity.value = withTiming(1, { duration: 200 });
      scale.value = withSpring(1, SPRING);
      translateY.value = withSpring(0, SPRING);
    } else {
      backdropOpacity.value = withTiming(0, { duration: 220 });
      dialogOpacity.value = withTiming(0, { duration: 180 });
      scale.value = withTiming(0.85, { duration: 200, easing: Easing.in(Easing.ease) });
      translateY.value = withTiming(
        24,
        { duration: 200, easing: Easing.in(Easing.ease) },
        (finished) => {
          if (finished) runOnJS(hideModal)();
        },
      );
    }
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

  const dialogStyle = useAnimatedStyle(() => ({
    opacity: dialogOpacity.value,
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  if (!modalVisible) return null;

  const type = config?.type ?? 'info';
  const { icon, color, bg } = getTypeConfig(type, colors);
  const isConfirm = type === 'confirm';
  const confirmLabel = config?.confirmText ?? (isConfirm ? 'Confirm' : 'OK');
  const cancelLabel = config?.cancelText ?? 'Cancel';
  const confirmBg = type === 'danger' || config?.destructive ? colors.danger : colors.primary;

  return (
    <Modal transparent visible={modalVisible} statusBarTranslucent animationType="none">
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={!isConfirm ? onCancel : undefined} />

        <Animated.View style={[styles.dialog, dialogStyle]}>
          <View style={[styles.iconCircle, { backgroundColor: bg }]}>
            <Ionicons name={icon} size={40} color={color} />
          </View>

          <AppText variant="heading" weight="semiBold" center style={styles.title}>
            {config?.title ?? ''}
          </AppText>

          {config?.message ? (
            <AppText variant="body" color={colors.textSecondary} center style={styles.message}>
              {config.message}
            </AppText>
          ) : null}

          <View style={[styles.btnRow, isConfirm && styles.btnRowDouble]}>
            {isConfirm && (
              <Pressable
                style={({ pressed }) => [
                  styles.btn,
                  styles.btnCancel,
                  { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                ]}
                onPress={onCancel}
              >
                <AppText variant="bodyLg" weight="medium" color={colors.textSecondary}>
                  {cancelLabel}
                </AppText>
              </Pressable>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.btn,
                { backgroundColor: confirmBg, opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={onConfirm}
            >
              <AppText variant="bodyLg" weight="semiBold" color="#fff">
                {confirmLabel}
              </AppText>
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 36,
    },
    dialog: {
      width: '100%',
      backgroundColor: colors.surface,
      borderRadius: 24,
      paddingHorizontal: 24,
      paddingTop: 32,
      paddingBottom: 24,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.2,
      shadowRadius: 28,
      elevation: 14,
    },
    iconCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
    },
    title: {
      marginBottom: 6,
    },
    message: {
      lineHeight: 22,
      marginTop: 2,
    },
    btnRow: {
      marginTop: 28,
      width: '100%',
    },
    btnRowDouble: {
      flexDirection: 'row',
      gap: 12,
    },
    btn: {
      height: 50,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
      flex: 1,
    },
    btnCancel: {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
    },
  });
}
