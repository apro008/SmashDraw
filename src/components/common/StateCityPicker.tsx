import { useMemo, useState } from 'react';
import { Dimensions, FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { City, State } from 'country-state-city';
import { AppText } from '~/components/AppText';
import { useTheme } from '~/hooks/useTheme';

interface StateCityPickerProps {
  selectedState: string;
  selectedCity: string;
  onStateChange: (state: string) => void;
  onCityChange: (city: string) => void;
  error?: string;
}

type PickerMode = 'state' | 'city';

const INDIA_CODE = 'IN';

export function StateCityPicker({
  error,
  onCityChange,
  onStateChange,
  selectedCity,
  selectedState,
}: StateCityPickerProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const modalHeight = useMemo(() => Math.min(Dimensions.get('window').height * 0.72, 560), []);
  const [mode, setMode] = useState<PickerMode>('state');
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');

  const states = useMemo(() => State.getStatesOfCountry(INDIA_CODE), []);
  const selectedStateMeta = useMemo(
    () => states.find((state) => state.name === selectedState),
    [selectedState, states]
  );
  const cities = useMemo(
    () => (selectedStateMeta ? City.getCitiesOfState(INDIA_CODE, selectedStateMeta.isoCode) : []),
    [selectedStateMeta]
  );

  const options = useMemo(() => {
    const source = mode === 'state' ? states : cities;
    const normalized = query.trim().toLowerCase();
    if (!normalized) return source;
    return source.filter((item) => item.name.toLowerCase().includes(normalized));
  }, [cities, mode, query, states]);

  const open = (nextMode: PickerMode) => {
    if (nextMode === 'city' && !selectedStateMeta) return;
    setMode(nextMode);
    setQuery('');
    setVisible(true);
  };

  const close = () => setVisible(false);

  const selectOption = (name: string) => {
    if (mode === 'state') {
      if (name !== selectedState) onCityChange('');
      onStateChange(name);
      setMode('city');
      setQuery('');
      return;
    }

    onCityChange(name);
    close();
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.column}>
          <AppText
            variant="label"
            weight="medium"
            color={colors.textSecondary}
            style={styles.label}
          >
            State *
          </AppText>
          <Pressable
            accessibilityRole="button"
            onPress={() => open('state')}
            style={[styles.input, error ? styles.inputError : null]}
          >
            <AppText
              variant="body"
              color={selectedState ? colors.text : colors.textMuted}
              style={styles.value}
            >
              {selectedState || 'Select state'}
            </AppText>
            <Ionicons name="chevron-down" size={17} color={colors.textSecondary} />
          </Pressable>
        </View>
        <View style={styles.column}>
          <AppText
            variant="label"
            weight="medium"
            color={colors.textSecondary}
            style={styles.label}
          >
            City *
          </AppText>
          <Pressable
            accessibilityRole="button"
            disabled={!selectedStateMeta}
            onPress={() => open('city')}
            style={[
              styles.input,
              !selectedStateMeta ? styles.disabled : null,
              error ? styles.inputError : null,
            ]}
          >
            <AppText
              variant="body"
              color={selectedCity ? colors.text : colors.textMuted}
              style={styles.value}
            >
              {selectedCity || 'Select city'}
            </AppText>
            <Ionicons name="chevron-down" size={17} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      {error ? (
        <AppText variant="caption" color={colors.danger} style={styles.error}>
          {error}
        </AppText>
      ) : null}

      <Modal
        animationType="fade"
        navigationBarTranslucent
        onRequestClose={close}
        statusBarTranslucent
        transparent
        visible={visible}
      >
        <Pressable style={styles.backdrop} onPress={close} />
        <View pointerEvents="box-none" style={styles.modalCenter}>
          <View style={[styles.sheet, { height: modalHeight }]}>
            <View style={styles.sheetHeader}>
              <AppText variant="title" weight="bold">
                Select {mode === 'state' ? 'State' : 'City'}
              </AppText>
              <Pressable accessibilityRole="button" onPress={close} style={styles.closeButton}>
                <Ionicons name="close" size={20} color={colors.text} />
              </Pressable>
            </View>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput
                autoCorrect={false}
                placeholder="Search"
                placeholderTextColor={colors.textMuted}
                value={query}
                onChangeText={setQuery}
                style={styles.searchInput}
              />
            </View>
            <FlatList
              data={options}
              keyExtractor={(item) => `${mode}-${item.name}`}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const selected =
                  mode === 'state' ? item.name === selectedState : item.name === selectedCity;
                return (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => selectOption(item.name)}
                    style={[styles.option, selected ? styles.optionSelected : null]}
                  >
                    <AppText
                      variant="bodyLg"
                      weight={selected ? 'semiBold' : 'regular'}
                      color={selected ? colors.primary : colors.text}
                      style={styles.value}
                    >
                      {item.name}
                    </AppText>
                    {selected ? (
                      <Ionicons name="checkmark" size={18} color={colors.primary} />
                    ) : null}
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <AppText variant="body" color={colors.textMuted} center style={styles.empty}>
                  No results found
                </AppText>
              }
              style={styles.list}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    container: {
      marginTop: 14,
    },
    row: {
      flexDirection: 'row',
      gap: 12,
    },
    column: {
      flex: 1,
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
      gap: 8,
      minHeight: 48,
      paddingHorizontal: 14,
    },
    inputError: {
      borderColor: colors.danger,
    },
    disabled: {
      opacity: 0.5,
    },
    value: {
      flex: 1,
    },
    error: {
      marginTop: 6,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay,
    },
    modalCenter: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 18,
    },
    sheet: {
      backgroundColor: colors.card,
      borderRadius: 20,
      elevation: 12,
      maxWidth: 520,
      overflow: 'hidden',
      paddingBottom: 12,
      paddingHorizontal: 18,
      paddingTop: 18,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.18,
      shadowRadius: 24,
      width: '100%',
    },
    sheetHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    closeButton: {
      alignItems: 'center',
      height: 36,
      justifyContent: 'center',
      width: 36,
    },
    searchBox: {
      alignItems: 'center',
      backgroundColor: colors.inputBg,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 10,
      marginBottom: 12,
      paddingHorizontal: 12,
    },
    searchInput: {
      color: colors.text,
      flex: 1,
      fontFamily: 'Inter_Regular',
      fontSize: 15,
      minHeight: 46,
    },
    list: {
      flex: 1,
    },
    option: {
      alignItems: 'center',
      borderBottomColor: colors.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      minHeight: 50,
      paddingHorizontal: 4,
    },
    optionSelected: {
      backgroundColor: colors.primaryLight,
    },
    empty: {
      paddingVertical: 32,
    },
  });
}
