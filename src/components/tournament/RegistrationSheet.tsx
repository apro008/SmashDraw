import { useEffect, useMemo, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppButton } from '~/components/AppButton';
import { AppText } from '~/components/AppText';
import { isDoublesCategory } from '~/constants/TournamentCategories';
import { useTheme } from '~/hooks/useTheme';
import { supabase } from '~/lib/supabase';
import {
  getTournamentCoordinates,
  getTournamentLocationLabel,
  openTournamentMap,
} from '~/lib/maps';
import { useAlert } from '~/providers/AlertProvider';
import { useAuthStore } from '~/store/useAuthStore';
import { Tournament, TournamentCategory } from '~/types';

interface RegistrationSheetProps {
  tournament: Tournament;
  visible: boolean;
  onClose: () => void;
  onRegistered: () => void;
  registeredCategoryIds?: string[];
}

export function RegistrationSheet({
  onClose,
  onRegistered,
  registeredCategoryIds = [],
  tournament,
  visible,
}: RegistrationSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { showAlert } = useAlert();
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);

  const categories = useMemo(() => tournament.categories ?? [], [tournament.categories]);
  const exactCoordinates = getTournamentCoordinates(tournament);
  const hasMapLocation = !!tournament.venue_map_url || !!exactCoordinates;
  const contactPhones = [
    tournament.contact_phone,
    tournament.contact_phone_2,
    tournament.contact_phone_3,
  ].filter((phone): phone is string => !!phone);
  const [selectedCategory, setSelectedCategory] = useState<TournamentCategory | null>(
    categories[0] ?? null
  );
  const [playerName, setPlayerName] = useState(profile?.name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [email, setEmail] = useState(profile?.email ?? user?.email ?? '');
  const [partnerName, setPartnerName] = useState('');
  const [partnerPhone, setPartnerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [paymentNoticeVisible, setPaymentNoticeVisible] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const nextCategory =
      categories.find(
        (category) =>
          !registeredCategoryIds.includes(category.id) &&
          category.current_players < category.max_players
      ) ??
      categories[0] ??
      null;
    setSelectedCategory(nextCategory);
  }, [categories, registeredCategoryIds, visible]);

  const isDoubles = selectedCategory ? isDoublesCategory(selectedCategory.name) : false;
  const alreadyRegistered =
    !!selectedCategory && registeredCategoryIds.includes(selectedCategory.id);
  const categoryFull =
    selectedCategory && selectedCategory.current_players >= selectedCategory.max_players;
  const canSubmit =
    !!user &&
    !!selectedCategory &&
    !!playerName.trim() &&
    !!phone.trim() &&
    !!email.trim() &&
    (!isDoubles || (!!partnerName.trim() && !!partnerPhone.trim())) &&
    !alreadyRegistered &&
    !categoryFull;

  const handleSubmitPress = () => {
    if (!canSubmit) return;
    setPaymentNoticeVisible(true);
  };

  const openWhatsApp = async () => {
    const phoneNumber = normalizePhoneForWhatsApp(contactPhones[0]);
    if (!phoneNumber) {
      showAlert({
        type: 'warning',
        title: 'No WhatsApp number',
        message: 'The organizer has not added a valid phone number.',
      });
      return;
    }

    const message = [
      `Hi, I registered for ${tournament.title}.`,
      selectedCategory ? `Category: ${selectedCategory.name}` : null,
      'I have completed the payment. Sharing the payment screenshot here.',
    ]
      .filter(Boolean)
      .join('\n');
    const url = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;

    try {
      await Linking.openURL(url);
    } catch {
      showAlert({
        type: 'danger',
        title: 'Could not open WhatsApp',
        message: 'Please send the payment screenshot manually to the organizer contact.',
      });
    }
  };

  const submitRegistration = async () => {
    if (!user || !selectedCategory || !canSubmit) return;

    setSubmitting(true);
    try {
      const registrationNotes = JSON.stringify({
        playerName: playerName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        partnerName: isDoubles ? partnerName.trim() : null,
        partnerPhone: isDoubles ? partnerPhone.trim() : null,
        notes: notes.trim() || null,
      });

      const { error } = await supabase.from('registrations').insert({
        user_id: user.id,
        tournament_id: tournament.id,
        category_id: selectedCategory.id,
        status: 'pending',
        notes: registrationNotes,
      });

      if (error) throw error;

      showAlert({
        type: 'success',
        title: 'Request sent',
        message: 'Your entry is pending. Please share your payment screenshot on WhatsApp.',
      });
      setPaymentNoticeVisible(false);
      onRegistered();
      onClose();
    } catch (err: any) {
      const duplicate = String(err?.message ?? '')
        .toLowerCase()
        .includes('duplicate');
      showAlert({
        type: duplicate ? 'warning' : 'danger',
        title: duplicate ? 'Already registered' : 'Registration failed',
        message: duplicate
          ? 'You have already registered for this category.'
          : (err?.message ?? 'Please try again.'),
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
          <View>
            <AppText variant="title" weight="bold">
              Register
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
          <AppText
            variant="label"
            weight="semiBold"
            color={colors.textMuted}
            style={styles.sectionLabel}
          >
            VENUE
          </AppText>
          <View style={styles.infoCard}>
            <View style={styles.infoTop}>
              <View style={{ flex: 1 }}>
                <AppText variant="bodyLg" weight="semiBold">
                  {tournament.venue}
                </AppText>
                <AppText variant="caption" color={colors.textSecondary} style={{ marginTop: 2 }}>
                  {getTournamentLocationLabel(tournament)}
                </AppText>
              </View>
              {hasMapLocation ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => openTournamentMap(tournament)}
                  style={styles.mapButton}
                >
                  <Ionicons name="navigate-outline" size={16} color={colors.primary} />
                </Pressable>
              ) : null}
            </View>
            <View style={styles.infoMeta}>
              {exactCoordinates ? (
                <View style={styles.inlineMeta}>
                  <Ionicons name="pin-outline" size={13} color={colors.textMuted} />
                  <AppText variant="caption" color={colors.textMuted}>
                    Exact pin
                  </AppText>
                </View>
              ) : null}
              {hasMapLocation ? (
                <View style={styles.inlineMeta}>
                  <Ionicons name="map-outline" size={13} color={colors.primary} />
                  <AppText variant="caption" weight="semiBold" color={colors.primary}>
                    Open in Maps
                  </AppText>
                </View>
              ) : null}
            </View>
          </View>

          {tournament.payment_address ? (
            <>
              <AppText
                variant="label"
                weight="semiBold"
                color={colors.textMuted}
                style={styles.sectionLabel}
              >
                PAYMENT
              </AppText>
              <View style={styles.infoCard}>
                <View style={styles.inlineBlock}>
                  <Ionicons name="card-outline" size={16} color={colors.primary} />
                  <AppText variant="body" color={colors.textSecondary} style={{ flex: 1 }}>
                    {tournament.payment_address}
                  </AppText>
                </View>
              </View>
            </>
          ) : null}

          {contactPhones.length > 0 ? (
            <>
              <AppText
                variant="label"
                weight="semiBold"
                color={colors.textMuted}
                style={styles.sectionLabel}
              >
                ORGANIZER
              </AppText>
              <View style={styles.infoCard}>
                {contactPhones.map((phone, index) => (
                  <View
                    key={phone}
                    style={[styles.inlineBlock, index > 0 ? { marginTop: 8 } : null]}
                  >
                    <Ionicons name="call-outline" size={16} color={colors.primary} />
                    <AppText variant="body">{phone}</AppText>
                  </View>
                ))}
              </View>
            </>
          ) : null}

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
              const full = category.current_players >= category.max_players;
              const joined = registeredCategoryIds.includes(category.id);
              const entryLabel = isDoublesCategory(category.name) ? 'teams' : 'players';
              return (
                <Pressable
                  key={category.id}
                  accessibilityRole="button"
                  disabled={full || joined}
                  onPress={() => setSelectedCategory(category)}
                  style={[
                    styles.categoryChip,
                    selected ? styles.categoryChipActive : null,
                    full || joined ? styles.disabled : null,
                  ]}
                >
                  <View style={styles.categoryHeader}>
                    <AppText
                      variant="label"
                      weight={selected ? 'semiBold' : 'regular'}
                      color={selected ? colors.primary : colors.text}
                    >
                      {category.name}
                    </AppText>
                    {joined ? (
                      <View style={styles.joinedBadge}>
                        <Ionicons name="checkmark-circle" size={12} color={colors.primary} />
                        <AppText variant="xs" weight="semiBold" color={colors.primary}>
                          Registered
                        </AppText>
                      </View>
                    ) : null}
                  </View>
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
            PLAYER DETAILS
          </AppText>
          <Field
            label="Name *"
            value={playerName}
            onChangeText={setPlayerName}
            styles={styles}
            colors={colors}
          />
          <Field
            label="Phone *"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            styles={styles}
            colors={colors}
          />
          <Field
            label="Email *"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            styles={styles}
            colors={colors}
          />

          {isDoubles ? (
            <>
              <AppText
                variant="label"
                weight="semiBold"
                color={colors.textMuted}
                style={styles.sectionLabel}
              >
                PARTNER DETAILS
              </AppText>
              <Field
                label="Partner name *"
                value={partnerName}
                onChangeText={setPartnerName}
                styles={styles}
                colors={colors}
              />
              <Field
                label="Partner phone *"
                value={partnerPhone}
                onChangeText={setPartnerPhone}
                keyboardType="phone-pad"
                styles={styles}
                colors={colors}
              />
            </>
          ) : null}

          <Field
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder="Seed request, club name, timing notes..."
            styles={styles}
            colors={colors}
          />

          {categoryFull ? (
            <AppText variant="caption" color={colors.danger} style={styles.errorText}>
              This category is full.
            </AppText>
          ) : null}
          {alreadyRegistered ? (
            <AppText variant="caption" color={colors.primary} style={styles.errorText}>
              You already have an entry for this category.
            </AppText>
          ) : null}

          <AppButton
            title="Submit Registration"
            onPress={handleSubmitPress}
            loading={submitting}
            disabled={!canSubmit}
            style={styles.submitButton}
          />
        </ScrollView>
      </View>
      <PaymentNotice
        contactPhones={contactPhones}
        entryFee={selectedCategory?.entry_fee ?? null}
        onClose={() => setPaymentNoticeVisible(false)}
        onOpenWhatsApp={openWhatsApp}
        onSubmit={submitRegistration}
        paymentAddress={tournament.payment_address}
        saving={submitting}
        selectedCategoryName={selectedCategory?.name ?? null}
        tournamentTitle={tournament.title}
        visible={paymentNoticeVisible}
      />
    </Modal>
  );
}

function PaymentNotice({
  contactPhones,
  entryFee,
  onClose,
  onOpenWhatsApp,
  onSubmit,
  paymentAddress,
  saving,
  selectedCategoryName,
  tournamentTitle,
  visible,
}: {
  contactPhones: string[];
  entryFee: number | null;
  onClose: () => void;
  onOpenWhatsApp: () => void;
  onSubmit: () => void;
  paymentAddress: string | null;
  saving: boolean;
  selectedCategoryName: string | null;
  tournamentTitle: string;
  visible: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const primaryContact = contactPhones[0] ?? null;

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.noticeBackdrop}>
        <View style={styles.noticeCard}>
          <View style={styles.noticeIcon}>
            <Ionicons name="wallet-outline" size={24} color={colors.primary} />
          </View>
          <AppText variant="title" weight="bold" center>
            Complete payment
          </AppText>
          <AppText variant="body" color={colors.textSecondary} center style={styles.noticeText}>
            Please pay the entry fee, then share the payment screenshot with the tournament contact
            on WhatsApp. The organizer will approve your entry after checking it.
          </AppText>

          <View style={styles.noticeDetails}>
            <DetailRow label="Tournament" value={tournamentTitle} />
            {selectedCategoryName ? (
              <DetailRow label="Category" value={selectedCategoryName} />
            ) : null}
            {entryFee !== null ? <DetailRow label="Entry fee" value={`Rs ${entryFee}`} /> : null}
            {paymentAddress ? (
              <DetailRow label="Payment details" value={paymentAddress} />
            ) : (
              <DetailRow
                label="Payment details"
                value="Organizer has not added UPI or bank details. Please contact them before paying."
              />
            )}
            {primaryContact ? <DetailRow label="WhatsApp contact" value={primaryContact} /> : null}
          </View>

          {primaryContact ? (
            <Pressable style={styles.whatsAppButton} onPress={onOpenWhatsApp}>
              <Ionicons name="logo-whatsapp" size={18} color="#128C7E" />
              <AppText variant="label" weight="semiBold" color="#128C7E">
                Open WhatsApp
              </AppText>
            </Pressable>
          ) : null}

          <View style={styles.noticeActions}>
            <AppButton
              disabled={saving}
              fullWidth={false}
              onPress={onClose}
              title="Cancel"
              variant="outline"
              style={styles.noticeActionButton}
            />
            <AppButton
              fullWidth={false}
              loading={saving}
              onPress={onSubmit}
              title="Register"
              style={styles.noticeActionButton}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 2 }}>
      <AppText variant="xs" weight="semiBold" color={colors.textMuted}>
        {label.toUpperCase()}
      </AppText>
      <AppText variant="body" color={colors.textSecondary}>
        {value}
      </AppText>
    </View>
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
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    closeButton: {
      alignItems: 'center',
      height: 36,
      justifyContent: 'center',
      width: 36,
    },
    sectionLabel: {
      marginBottom: 8,
      marginTop: 14,
    },
    infoCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      padding: 12,
    },
    infoTop: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 10,
    },
    infoMeta: {
      alignItems: 'center',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginTop: 10,
    },
    inlineMeta: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 5,
    },
    inlineBlock: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 10,
    },
    mapButton: {
      alignItems: 'center',
      backgroundColor: colors.primaryLight,
      borderRadius: 999,
      height: 36,
      justifyContent: 'center',
      width: 36,
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
    categoryHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'space-between',
    },
    categoryChipActive: {
      backgroundColor: colors.primaryLight,
      borderColor: colors.primary,
    },
    joinedBadge: {
      alignItems: 'center',
      backgroundColor: colors.background,
      borderColor: colors.primary,
      borderRadius: 999,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 3,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    disabled: {
      opacity: 0.5,
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
    errorText: {
      marginTop: 12,
    },
    submitButton: {
      marginTop: 22,
    },
    noticeBackdrop: {
      alignItems: 'center',
      backgroundColor: colors.overlay,
      flex: 1,
      justifyContent: 'center',
      padding: 20,
    },
    noticeCard: {
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 20,
      width: '100%',
    },
    noticeIcon: {
      alignItems: 'center',
      alignSelf: 'center',
      backgroundColor: colors.primaryLight,
      borderRadius: 999,
      height: 54,
      justifyContent: 'center',
      marginBottom: 12,
      width: 54,
    },
    noticeText: {
      marginTop: 8,
    },
    noticeDetails: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      gap: 12,
      marginTop: 16,
      padding: 12,
    },
    whatsAppButton: {
      alignItems: 'center',
      alignSelf: 'center',
      flexDirection: 'row',
      gap: 7,
      marginTop: 16,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    noticeActions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 18,
    },
    noticeActionButton: {
      flex: 1,
    },
  });
}

function normalizePhoneForWhatsApp(phone: string | null | undefined) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length > 10) return digits;
  return null;
}
