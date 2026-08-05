import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { AppText } from '~/components/AppText';
import { useTheme } from '~/hooks/useTheme';
import type { Contestant } from '~/lib/contestants';

interface ContestantPickerProps {
  contestants: Contestant[];
  excludedId?: string;
  label: string;
  selectedId: string;
  onSelect: (id: string) => void;
  onRemoveGuest?: (id: string) => void;
}

export function ContestantPicker({
  contestants,
  excludedId,
  label,
  onRemoveGuest,
  onSelect,
  selectedId,
}: ContestantPickerProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const options = contestants.filter((item) => item.id !== excludedId);

  return (
    <View style={styles.pickerBlock}>
      <AppText variant="label" weight="medium" color={colors.textSecondary}>
        {label}
      </AppText>
      {options.length === 0 ? (
        <AppText variant="caption" color={colors.textMuted}>
          No one to pick yet — add a name below.
        </AppText>
      ) : (
        <View style={styles.optionList}>
          {options.map((item) => {
            const selected = selectedId === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => onSelect(item.id)}
                style={[styles.option, selected ? styles.optionActive : null]}
              >
                <View style={{ flex: 1 }}>
                  <AppText variant="caption" weight="semiBold" numberOfLines={1}>
                    {item.name}
                  </AppText>
                  {item.detail ? (
                    <AppText variant="xs" color={colors.textMuted} numberOfLines={1}>
                      {item.detail}
                    </AppText>
                  ) : null}
                </View>
                {item.isGuest && onRemoveGuest ? (
                  <Pressable
                    accessibilityLabel={`Remove ${item.name}`}
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() => onRemoveGuest(item.id)}
                  >
                    <Ionicons name="close-circle" size={17} color={colors.textMuted} />
                  </Pressable>
                ) : null}
                {selected ? (
                  <Ionicons name="checkmark-circle" size={17} color={colors.primary} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

interface ManualContestantInputProps {
  isDoubles?: boolean;
  onAdd: (name: string) => void;
}

/**
 * Lets the organizer enter a player who never registered in the app, so results can be
 * recorded for a full draw even when only part of the field signed up here.
 */
export function ManualContestantInput({ isDoubles, onAdd }: ManualContestantInputProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const trimmed = name.trim();

  const submit = () => {
    if (!trimmed) return;
    onAdd(trimmed);
    setName('');
    setOpen(false);
  };

  if (!open) {
    return (
      <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={styles.addTrigger}>
        <Ionicons name="person-add-outline" size={16} color={colors.primary} />
        <AppText variant="caption" weight="semiBold" color={colors.primary}>
          Add a player who didn&apos;t register
        </AppText>
      </Pressable>
    );
  }

  return (
    <View style={styles.addBlock}>
      <TextInput
        autoFocus
        onChangeText={setName}
        onSubmitEditing={submit}
        placeholder={isDoubles ? 'e.g. Rahul Verma / Aditi Rao' : 'Player name'}
        placeholderTextColor={colors.textMuted}
        returnKeyType="done"
        style={styles.addInput}
        value={name}
      />
      <View style={styles.addActions}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setName('');
            setOpen(false);
          }}
          style={styles.addCancel}
        >
          <AppText variant="caption" weight="semiBold" color={colors.textSecondary}>
            Cancel
          </AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={!trimmed}
          onPress={submit}
          style={[styles.addConfirm, !trimmed ? styles.addConfirmDisabled : null]}
        >
          <AppText variant="caption" weight="semiBold" color="#fff">
            Add
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    pickerBlock: {
      gap: 8,
      marginTop: 10,
    },
    optionList: {
      gap: 7,
    },
    option: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 10,
      minHeight: 52,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    optionActive: {
      backgroundColor: colors.primaryLight,
      borderColor: colors.primary,
    },
    addTrigger: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      flexDirection: 'row',
      gap: 7,
      marginTop: 12,
      paddingVertical: 8,
    },
    addBlock: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      gap: 10,
      marginTop: 12,
      padding: 12,
    },
    addInput: {
      backgroundColor: colors.inputBg,
      borderColor: colors.border,
      borderRadius: 10,
      borderWidth: 1,
      color: colors.text,
      fontFamily: 'Inter_Regular',
      fontSize: 15,
      minHeight: 44,
      paddingHorizontal: 12,
    },
    addActions: {
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'flex-end',
    },
    addCancel: {
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    addConfirm: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingHorizontal: 16,
      paddingVertical: 9,
    },
    addConfirmDisabled: {
      opacity: 0.5,
    },
  });
}
