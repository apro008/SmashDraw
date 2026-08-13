import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppButton } from '~/components/AppButton';
import { AppText } from '~/components/AppText';
import { isDoublesCategory } from '~/constants/TournamentCategories';
import { useTheme } from '~/hooks/useTheme';
import { addTournamentEntry, searchPlayers } from '~/lib/tournaments';
import { useAlert } from '~/providers/AlertProvider';
import { Tournament, TournamentCategory, UserProfile } from '~/types';

type PlayerMatch = Pick<UserProfile, 'id' | 'name' | 'email' | 'phone' | 'city' | 'state'>;

interface AddEntrySheetProps {
  tournament: Tournament;
  visible: boolean;
  onClose: () => void;
  onAdded: () => void;
}

/**
 * Organizer-side roster entry. Unlike the player registration sheet this writes
 * an already-approved row, and the account link is optional — a walk-in at the
 * venue is stored by name alone.
 */
export function AddEntrySheet({ onAdded, onClose, tournament, visible }: AddEntrySheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { showAlert } = useAlert();

  const categories = useMemo(() => tournament.categories ?? [], [tournament.categories]);
  const [selectedCategory, setSelectedCategory] = useState<TournamentCategory | null>(
    categories[0] ?? null
  );
  const [playerName, setPlayerName] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [linkQuery, setLinkQuery] = useState('');
  const [linkResults, setLinkResults] = useState<PlayerMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [linkedPlayer, setLinkedPlayer] = useState<PlayerMatch | null>(null);

  // Keyed on `visible` alone: the parent refetches the tournament after every
  // roster change, and depending on `categories` would wipe half-typed input
  // when that new array arrives while the sheet is open.
  useEffect(() => {
    if (!visible) return;
    setSelectedCategory(categories[0] ?? null);
    setPlayerName('');
    setPartnerName('');
    setPhone('');
    setNotes('');
    setLinkQuery('');
    setLinkResults([]);
    setLinkedPlayer(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Debounced so a fast typist does not fire a request per keystroke.
  useEffect(() => {
    if (linkedPlayer) return;
    const term = linkQuery.trim();
    if (term.length < 2) {
      setLinkResults([]);
      // Clearing the box cancels the in-flight search, whose own `finally` is
      // suppressed by the cleanup below — so the spinner has to stop here.
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const matches = await searchPlayers(term);
        if (!cancelled) setLinkResults(matches);
      } catch {
        if (!cancelled) setLinkResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [linkQuery, linkedPlayer]);

  const isDoubles = selectedCategory ? isDoublesCategory(selectedCategory.name) : false;
  const canSubmit = !!selectedCategory && !!playerName.trim() && !submitting;

  const handleLinkPlayer = (player: PlayerMatch) => {
    setLinkedPlayer(player);
    setLinkResults([]);
    setLinkQuery('');
    if (!playerName.trim()) setPlayerName(player.name);
    if (!phone.trim() && player.phone) setPhone(player.phone);
  };

  const handleSubmit = async () => {
    if (!selectedCategory || !canSubmit) return;

    setSubmitting(true);
    try {
      await addTournamentEntry({
        tournamentId: tournament.id,
        categoryId: selectedCategory.id,
        playerName: playerName.trim(),
        partnerName: isDoubles ? partnerName.trim() || null : null,
        phone: phone.trim() || null,
        email: linkedPlayer?.email ?? null,
        userId: linkedPlayer?.id ?? null,
        notes: notes.trim() || null,
      });

      showAlert({
        type: 'success',
        title: 'Entry added',
        message: `${playerName.trim()} is on the ${selectedCategory.name} roster.`,
      });
      onAdded();
      onClose();
    } catch (err: any) {
      showAlert({
        type: 'danger',
        title: 'Could not add entry',
        message: err?.message ?? 'Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <AppText variant="title" weight="bold">
              Add Entry
            </AppText>
            <AppText variant="caption" color={colors.textSecondary}>
              {tournament.title}
            </AppText>
          </View>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={20} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={17} color={colors.primary} />
            <AppText variant="caption" color={colors.textSecondary} style={{ flex: 1 }}>
              Entries you add are approved straight away and count towards the category slots. Link
              a SmashDraw account if the player has one — that is what lets them get match
              notifications.
            </AppText>
          </View>

          <AppText
            variant="label"
            weight="semiBold"
            color={colors.textMuted}
            style={styles.sectionLabel}
          >
            CATEGORY
          </AppText>
          <View style={styles.categoryGrid}>
            {categories.map((category) => {
              const selected = selectedCategory?.id === category.id;
              const entryLabel = isDoublesCategory(category.name) ? 'teams' : 'players';
              return (
                <Pressable
                  key={category.id}
                  accessibilityRole="button"
                  onPress={() => setSelectedCategory(category)}
                  style={[styles.categoryChip, selected ? styles.categoryChipActive : null]}
                >
                  <AppText
                    variant="label"
                    weight={selected ? 'semiBold' : 'regular'}
                    color={selected ? colors.primary : colors.text}
                  >
                    {category.name}
                  </AppText>
                  <AppText variant="xs" color={colors.textMuted}>
                    {category.current_players}/{category.max_players} {entryLabel}
                  </AppText>
                </Pressable>
              );
            })}
          </View>

          <AppText
            variant="label"
            weight="semiBold"
            color={colors.textMuted}
            style={styles.sectionLabel}
          >
            SMASHDRAW ACCOUNT (OPTIONAL)
          </AppText>
          {linkedPlayer ? (
            <View style={styles.linkedCard}>
              <Ionicons name="person-circle-outline" size={22} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <AppText variant="body" weight="semiBold">
                  {linkedPlayer.name}
                </AppText>
                {linkedPlayer.email ? (
                  <AppText variant="xs" color={colors.textMuted}>
                    {linkedPlayer.email}
                  </AppText>
                ) : null}
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => setLinkedPlayer(null)}
                style={styles.closeButton}
              >
                <Ionicons name="close-circle" size={20} color={colors.textMuted} />
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.searchRow}>
                <Ionicons name="search" size={16} color={colors.textMuted} />
                <TextInput
                  value={linkQuery}
                  onChangeText={setLinkQuery}
                  placeholder="Search by name or email"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  style={styles.searchInput}
                />
                {searching ? <ActivityIndicator size="small" color={colors.primary} /> : null}
              </View>
              {linkResults.map((player) => (
                <Pressable
                  key={player.id}
                  accessibilityRole="button"
                  onPress={() => handleLinkPlayer(player)}
                  style={styles.resultRow}
                >
                  <View style={{ flex: 1 }}>
                    <AppText variant="body">{player.name}</AppText>
                    <AppText variant="xs" color={colors.textMuted}>
                      {[player.email, player.city].filter(Boolean).join(' · ')}
                    </AppText>
                  </View>
                  <Ionicons name="add-circle-outline" size={19} color={colors.primary} />
                </Pressable>
              ))}
            </>
          )}

          <AppText
            variant="label"
            weight="semiBold"
            color={colors.textMuted}
            style={styles.sectionLabel}
          >
            {isDoubles ? 'TEAM' : 'PLAYER'}
          </AppText>
          <Field
            colors={colors}
            label={isDoubles ? 'Player 1 name *' : 'Name *'}
            onChangeText={setPlayerName}
            styles={styles}
            value={playerName}
          />
          {isDoubles ? (
            <Field
              colors={colors}
              label="Partner name"
              onChangeText={setPartnerName}
              styles={styles}
              value={partnerName}
            />
          ) : null}
          <Field
            colors={colors}
            keyboardType="phone-pad"
            label="Phone"
            onChangeText={setPhone}
            styles={styles}
            value={phone}
          />
          <Field
            colors={colors}
            label="Notes"
            multiline
            onChangeText={setNotes}
            placeholder="Paid in cash, club name, seeding note..."
            styles={styles}
            value={notes}
          />

          <AppButton
            title="Add to Roster"
            onPress={handleSubmit}
            loading={submitting}
            disabled={!canSubmit}
            style={styles.submitButton}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}

function Field({
  colors,
  label,
  multiline,
  onChangeText,
  placeholder,
  styles,
  value,
  keyboardType,
}: {
  colors: ReturnType<typeof useTheme>['colors'];
  label: string;
  multiline?: boolean;
  onChangeText: (text: string) => void;
  placeholder?: string;
  styles: ReturnType<typeof makeStyles>;
  value: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
}) {
  return (
    <View style={styles.field}>
      <AppText variant="label" weight="medium" color={colors.textSecondary} style={styles.label}>
        {label}
      </AppText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        multiline={multiline}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, multiline ? styles.textarea : null]}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
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
      maxHeight: '86%',
      paddingBottom: 24,
      paddingHorizontal: 20,
      paddingTop: 18,
      position: 'absolute',
      right: 0,
    },
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },
    closeButton: {
      alignItems: 'center',
      height: 36,
      justifyContent: 'center',
      width: 36,
    },
    infoBox: {
      alignItems: 'flex-start',
      backgroundColor: colors.primaryLight,
      borderRadius: 12,
      flexDirection: 'row',
      gap: 9,
      padding: 12,
    },
    sectionLabel: {
      marginBottom: 8,
      marginTop: 16,
    },
    categoryGrid: {
      gap: 8,
    },
    categoryChip: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      gap: 3,
      padding: 12,
    },
    categoryChipActive: {
      backgroundColor: colors.primaryLight,
      borderColor: colors.primary,
    },
    searchRow: {
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
    searchInput: {
      color: colors.text,
      flex: 1,
      fontFamily: 'Inter_Regular',
      fontSize: 15,
      minHeight: 48,
    },
    resultRow: {
      alignItems: 'center',
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: 10,
      paddingVertical: 11,
    },
    linkedCard: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.primary,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 10,
      padding: 12,
    },
    field: {
      marginTop: 10,
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
    textarea: {
      minHeight: 88,
      paddingTop: 12,
    },
    submitButton: {
      marginBottom: 8,
      marginTop: 22,
    },
  });
}
