import { useMemo, useState } from 'react';
import { Modal, Pressable, TextInput, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { AppText } from '~/components/AppText';
import { AppButton } from '~/components/AppButton';
import { AppDatePicker } from '~/components/common/AppDatePicker';
import { StateCityPicker } from '~/components/common/StateCityPicker';
import { useTheme } from '~/hooks/useTheme';
import { useAuthStore } from '~/store/useAuthStore';
import { supabase } from '~/lib/supabase';
import { useAlert } from '~/providers/AlertProvider';
import { extractCoordinatesFromMapText, isValidCoordinates, openLocationSearch } from '~/lib/maps';
import { startOfToday, toDateOnlyString } from '~/lib/tournaments';
import {
  createEditableCategoryPresets,
  getAutoPrizeDistribution,
  getCategoryEntryLabel,
} from '~/constants/TournamentCategories';

export default function CreateTournamentScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { showAlert } = useAlert();
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);

  const [title, setTitle] = useState('');
  const [city, setCity] = useState('');
  const [tournState, setTournState] = useState('');
  const [venue, setVenue] = useState('');
  const [venueAddress, setVenueAddress] = useState('');
  const [venueLatitude, setVenueLatitude] = useState('');
  const [venueLongitude, setVenueLongitude] = useState('');
  const [venueMapUrl, setVenueMapUrl] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [regDeadline, setRegDeadline] = useState<Date | null>(null);
  const [description, setDescription] = useState('');
  const [contactPhones, setContactPhones] = useState<string[]>([profile?.phone ?? '']);
  const [paymentAddress, setPaymentAddress] = useState('');
  const [publishStatus, setPublishStatus] = useState<'draft' | 'open'>('draft');
  const [categories, setCategories] = useState(createEditableCategoryPresets);
  const [customCategoryName, setCustomCategoryName] = useState('');
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [mapPickerVisible, setMapPickerVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const enabledCategories = categories.filter((category) => category.enabled);
  const selectedCoordinate = getSelectedCoordinate(venueLatitude, venueLongitude);

  const updateCategory = (index: number, patch: Partial<(typeof categories)[number]>) => {
    setCategories((current) =>
      current.map((category, itemIndex) =>
        itemIndex === index ? updatePrizeForCategory({ ...category, ...patch }) : category
      )
    );
  };

  const toggleCategory = (index: number) => {
    setCategories((current) => {
      const enabledCount = current.filter((category) => category.enabled).length;
      return current.map((category, itemIndex) => {
        if (itemIndex !== index) return category;
        if (category.enabled && enabledCount === 1) return category;
        return { ...category, enabled: !category.enabled };
      });
    });
  };

  const addCustomCategory = () => {
    const name = normalizeCategoryName(customCategoryName);
    if (!name) {
      showAlert({
        type: 'warning',
        title: 'Category name required',
        message: 'Please enter a category name.',
      });
      return;
    }

    if (
      categories.some(
        (category) => normalizeCategoryName(category.name).toLowerCase() === name.toLowerCase()
      )
    ) {
      showAlert({
        type: 'warning',
        title: 'Category already exists',
        message: 'Use a different category name.',
      });
      return;
    }

    setCategories((current) => [
      ...current,
      updatePrizeForCategory({
        id: `custom-${Date.now()}`,
        name,
        entry_fee: 0,
        max_players: 32,
        skill_level: 'open',
        prize: null,
        enabled: true,
        is_custom: true,
      }),
    ]);
    setCustomCategoryName('');
  };

  const handleLocationPicked = (location: PickedLocation) => {
    if (location.latitude !== null && location.longitude !== null) {
      const latitude = location.latitude.toFixed(6);
      const longitude = location.longitude.toFixed(6);
      setVenueLatitude(latitude);
      setVenueLongitude(longitude);
    } else {
      setVenueLatitude('');
      setVenueLongitude('');
    }
    setVenueMapUrl(
      location.mapUrl?.trim() ||
        (location.latitude !== null && location.longitude !== null
          ? `https://www.google.com/maps/search/?api=1&query=${location.latitude.toFixed(6)},${location.longitude.toFixed(6)}`
          : '')
    );
    setMapPickerVisible(false);
  };

  const resetForm = () => {
    setTitle('');
    setCity('');
    setTournState('');
    setVenue('');
    setVenueAddress('');
    setVenueLatitude('');
    setVenueLongitude('');
    setVenueMapUrl('');
    setStartDate(null);
    setEndDate(null);
    setRegDeadline(null);
    setDescription('');
    setContactPhones([profile?.phone ?? '']);
    setPaymentAddress('');
    setPublishStatus('draft');
    setCategories(createEditableCategoryPresets());
    setCustomCategoryName('');
  };

  const handleCreate = async () => {
    const cleanPhones = contactPhones.map((phone) => phone.trim()).filter(Boolean);
    const latitude = parseOptionalCoordinate(venueLatitude);
    const longitude = parseOptionalCoordinate(venueLongitude);
    const today = startOfToday();

    if (
      !title.trim() ||
      !city ||
      !tournState ||
      !venue.trim() ||
      cleanPhones.length === 0 ||
      !startDate ||
      !endDate ||
      !regDeadline ||
      enabledCategories.length === 0
    ) {
      showAlert({
        type: 'warning',
        title: 'Missing fields',
        message: 'Please fill in all required fields.',
      });
      return;
    }
    if (!user || !profile) return;

    const invalidCategory = enabledCategories.find(
      (category) => !normalizeCategoryName(category.name)
    );
    if (invalidCategory) {
      showAlert({
        type: 'warning',
        title: 'Category name required',
        message: 'Please name every selected category.',
      });
      return;
    }

    if (hasDuplicateCategoryNames(enabledCategories)) {
      showAlert({
        type: 'warning',
        title: 'Duplicate category',
        message: 'Selected categories must have unique names.',
      });
      return;
    }

    if (startDate < today) {
      showAlert({
        type: 'warning',
        title: 'Invalid start date',
        message: 'Start date must be today or later.',
      });
      return;
    }

    if (regDeadline > startDate) {
      showAlert({
        type: 'warning',
        title: 'Invalid deadline',
        message: 'Registration deadline must be on or before the start date.',
      });
      return;
    }

    if (
      (latitude === null && venueLatitude.trim()) ||
      (longitude === null && venueLongitude.trim()) ||
      (latitude === null) !== (longitude === null) ||
      (latitude !== null && longitude !== null && !isValidCoordinates(latitude, longitude))
    ) {
      showAlert({
        type: 'warning',
        title: 'Check exact location',
        message: 'Enter both latitude and longitude with valid values, or leave both blank.',
      });
      return;
    }

    setLoading(true);
    try {
      const { data: tournament, error } = await supabase
        .from('tournaments')
        .insert({
          title: title.trim(),
          city: city.trim(),
          state: tournState.trim(),
          venue: venue.trim(),
          venue_address: venueAddress.trim() || null,
          venue_latitude: latitude,
          venue_longitude: longitude,
          venue_map_url: venueMapUrl.trim() || null,
          start_date: toDateString(startDate),
          end_date: toDateString(endDate),
          registration_deadline: toDateString(regDeadline),
          description: description.trim() || null,
          organizer_id: user.id,
          organizer_name: profile.name,
          contact_phone: cleanPhones[0],
          contact_phone_2: cleanPhones[1] ?? null,
          contact_phone_3: cleanPhones[2] ?? null,
          payment_address: paymentAddress.trim() || null,
          status: publishStatus,
        })
        .select('id')
        .single();
      if (error) throw error;

      const { error: categoriesError } = await supabase.from('tournament_categories').insert(
        enabledCategories.map(({ enabled, id, is_custom, prizeEdited, ...category }) => ({
          ...category,
          name: normalizeCategoryName(category.name),
          entry_fee: Number(category.entry_fee) || 0,
          max_players: Number(category.max_players) || 0,
          prize: category.prize?.trim() || null,
          tournament_id: tournament.id,
        }))
      );
      if (categoriesError) throw categoriesError;

      resetForm();
      showAlert({
        type: 'success',
        title: 'Tournament created!',
        message: 'Saved as a draft with your selected categories and prize details.',
      });
      router.replace('/(app)/(organizer-tabs)/my-tournaments');
    } catch (err: any) {
      showAlert({ type: 'danger', title: 'Failed to create', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <AppText variant="heading" weight="bold">
          Create Tournament
        </AppText>
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bottomOffset={16}
      >
        <AppText
          variant="label"
          weight="semiBold"
          color={colors.textMuted}
          style={styles.sectionLabel}
        >
          BASIC INFO
        </AppText>

        <View style={styles.field}>
          <AppText
            variant="label"
            weight="medium"
            color={colors.textSecondary}
            style={styles.label}
          >
            Tournament Name *
          </AppText>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. City Open 2025"
            placeholderTextColor={colors.textMuted}
            returnKeyType="next"
          />
        </View>

        <StateCityPicker
          selectedState={tournState}
          selectedCity={city}
          onStateChange={setTournState}
          onCityChange={setCity}
        />

        <View style={styles.field}>
          <AppText
            variant="label"
            weight="medium"
            color={colors.textSecondary}
            style={styles.label}
          >
            Venue *
          </AppText>
          <TextInput
            style={styles.input}
            value={venue}
            onChangeText={setVenue}
            placeholder="Venue name"
            placeholderTextColor={colors.textMuted}
            returnKeyType="next"
          />
        </View>

        <View style={styles.locationCard}>
          <View style={styles.locationHeader}>
            <View style={{ flex: 1 }}>
              <AppText variant="label" weight="semiBold" color={colors.textSecondary}>
                Exact Location
              </AppText>
              <AppText variant="caption" color={colors.textMuted}>
                Add a Google Maps link or pick a location
              </AppText>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.smallAction}
              onPress={() => setMapPickerVisible(true)}
            >
              <Ionicons name="pin-outline" size={14} color={colors.primary} />
              <AppText variant="caption" weight="semiBold" color={colors.primary}>
                Pick Location
              </AppText>
            </TouchableOpacity>
          </View>

          <TextInput
            style={[styles.input, styles.locationInput]}
            value={venueAddress}
            onChangeText={setVenueAddress}
            placeholder="Full address or landmark"
            placeholderTextColor={colors.textMuted}
            returnKeyType="next"
          />
          <TextInput
            style={[styles.input, styles.locationInput]}
            value={venueMapUrl}
            onChangeText={(value) => {
              setVenueMapUrl(value);
              const coordinates = extractCoordinatesFromMapText(value);
              if (coordinates) {
                setVenueLatitude(String(coordinates.latitude));
                setVenueLongitude(String(coordinates.longitude));
              }
            }}
            placeholder="Paste Google Maps link"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            keyboardType="url"
          />
          {selectedCoordinate || venueMapUrl.trim() ? (
            <View style={styles.pickedLocationRow}>
              <View style={styles.inlineMeta}>
                <Ionicons
                  name={selectedCoordinate ? 'location' : 'link-outline'}
                  size={14}
                  color={colors.primary}
                />
                <AppText variant="caption" weight="semiBold" color={colors.primary}>
                  {selectedCoordinate ? 'Pin selected' : 'Map link added'}
                </AppText>
              </View>
              {selectedCoordinate ? (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() =>
                    openLocationSearch(
                      `${selectedCoordinate.latitude},${selectedCoordinate.longitude}`
                    )
                  }
                >
                  <AppText variant="caption" weight="semiBold" color={colors.primary}>
                    Preview
                  </AppText>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </View>

        <AppText
          variant="label"
          weight="semiBold"
          color={colors.textMuted}
          style={[styles.sectionLabel, { marginTop: 8 }]}
        >
          DATES
        </AppText>

        <View style={styles.row}>
          <View style={[styles.field, { flex: 1 }]}>
            <AppDatePicker
              label="Start Date *"
              value={startDate}
              onChange={(date) => {
                setStartDate(date);
                if (!endDate || endDate < date) setEndDate(date);
              }}
              minimumDate={startOfToday()}
              mode="date"
            />
          </View>
          <View style={[styles.field, { flex: 1 }]}>
            <AppDatePicker
              label="End Date *"
              value={endDate}
              onChange={setEndDate}
              minimumDate={startDate ?? undefined}
              mode="date"
            />
          </View>
        </View>

        <View style={styles.field}>
          <AppDatePicker
            label="Registration Deadline *"
            value={regDeadline}
            onChange={setRegDeadline}
            maximumDate={startDate ?? undefined}
            mode="date"
          />
        </View>

        <AppText
          variant="label"
          weight="semiBold"
          color={colors.textMuted}
          style={[styles.sectionLabel, { marginTop: 8 }]}
        >
          CATEGORIES & PRIZES
        </AppText>
        <View style={styles.categorySummary}>
          <Ionicons name="layers-outline" size={16} color={colors.primary} />
          <AppText variant="body" weight="semiBold" color={colors.primary}>
            {enabledCategories.length} category{enabledCategories.length === 1 ? '' : 'ies'}{' '}
            selected
          </AppText>
        </View>

        <View style={styles.categoryPickerCard}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.categoryPickerButton}
            onPress={() => setCategoryMenuOpen((open) => !open)}
          >
            <View style={{ flex: 1 }}>
              <AppText variant="label" weight="semiBold">
                Tournament Categories
              </AppText>
              <AppText variant="caption" color={colors.textSecondary}>
                Start with one, add only what you want to run
              </AppText>
            </View>
            <Ionicons
              name={categoryMenuOpen ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.textSecondary}
            />
          </TouchableOpacity>

          <View style={styles.selectedChips}>
            {enabledCategories.map((category) => {
              const categoryIndex = categories.findIndex((item) => item.id === category.id);
              return (
                <TouchableOpacity
                  key={category.id}
                  activeOpacity={0.8}
                  disabled={enabledCategories.length === 1}
                  onPress={() => toggleCategory(categoryIndex)}
                  style={styles.selectedChip}
                >
                  <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                  <AppText variant="caption" weight="semiBold" color={colors.primary}>
                    {category.name}
                  </AppText>
                  {enabledCategories.length > 1 ? (
                    <Ionicons name="close" size={13} color={colors.primary} />
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>

          {categoryMenuOpen ? (
            <View style={styles.categoryMenu}>
              {categories.map((category, index) => {
                const isLastSelected = category.enabled && enabledCategories.length === 1;
                return (
                  <TouchableOpacity
                    key={category.id}
                    activeOpacity={0.85}
                    disabled={isLastSelected}
                    style={[styles.categoryOption, category.enabled && styles.categoryOptionActive]}
                    onPress={() => toggleCategory(index)}
                  >
                    <View
                      style={[
                        styles.categoryOptionIcon,
                        category.enabled && styles.categoryOptionIconActive,
                      ]}
                    >
                      <Ionicons
                        name={category.enabled ? 'checkmark' : 'add'}
                        size={14}
                        color={category.enabled ? '#fff' : colors.primary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <AppText variant="body" weight="semiBold">
                        {category.name}
                      </AppText>
                      <AppText variant="caption" color={colors.textSecondary}>
                        {getCategoryEntryLabel(category.name)} bracket
                      </AppText>
                    </View>
                    {isLastSelected ? (
                      <AppText variant="xs" color={colors.textMuted}>
                        Required
                      </AppText>
                    ) : null}
                  </TouchableOpacity>
                );
              })}

              <View style={styles.customCategoryBox}>
                <AppText variant="label" weight="semiBold">
                  Custom Category
                </AppText>
                <View style={styles.customCategoryRow}>
                  <TextInput
                    style={[styles.input, styles.customCategoryInput]}
                    value={customCategoryName}
                    onChangeText={setCustomCategoryName}
                    placeholder="e.g. Under-17 Singles"
                    placeholderTextColor={colors.textMuted}
                    returnKeyType="done"
                    onSubmitEditing={addCustomCategory}
                  />
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={[
                      styles.addCustomCategoryButton,
                      !customCategoryName.trim() && styles.addCustomCategoryButtonDisabled,
                    ]}
                    disabled={!customCategoryName.trim()}
                    onPress={addCustomCategory}
                  >
                    <Ionicons name="add" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.categoryList}>
          {categories.map((category, index) =>
            category.enabled ? (
              <View key={category.id} style={styles.categoryCard}>
                <View style={styles.categoryHeader}>
                  <View style={styles.categoryBadge}>
                    <Ionicons
                      name={category.name.includes('Doubles') ? 'people-outline' : 'person-outline'}
                      size={16}
                      color={colors.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyLg" weight="semiBold">
                      {category.name}
                    </AppText>
                    <AppText variant="caption" color={colors.textSecondary}>
                      {getCategoryEntryLabel(category.name)} can join this category
                    </AppText>
                  </View>
                  {enabledCategories.length > 1 ? (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => toggleCategory(index)}
                      style={styles.categoryRemoveButton}
                    >
                      <Ionicons name="close" size={17} color={colors.textMuted} />
                    </TouchableOpacity>
                  ) : null}
                </View>

                {category.is_custom ? (
                  <View style={styles.field}>
                    <AppText
                      variant="label"
                      weight="medium"
                      color={colors.textSecondary}
                      style={styles.label}
                    >
                      Category Name *
                    </AppText>
                    <TextInput
                      style={styles.input}
                      value={category.name}
                      onChangeText={(value) => updateCategory(index, { name: value })}
                      placeholder="e.g. Under-17 Singles"
                      placeholderTextColor={colors.textMuted}
                      returnKeyType="next"
                    />
                  </View>
                ) : null}

                <View style={styles.row}>
                  <View style={[styles.field, { flex: 1 }]}>
                    <AppText
                      variant="label"
                      weight="medium"
                      color={colors.textSecondary}
                      style={styles.label}
                    >
                      Max {getCategoryEntryLabel(category.name)} *
                    </AppText>
                    <TextInput
                      style={styles.input}
                      value={String(category.max_players)}
                      onChangeText={(value) =>
                        updateCategory(index, { max_players: Number(value) || 0 })
                      }
                      keyboardType="number-pad"
                      placeholder="32"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                  <View style={[styles.field, { flex: 1 }]}>
                    <AppText
                      variant="label"
                      weight="medium"
                      color={colors.textSecondary}
                      style={styles.label}
                    >
                      Entry Fee
                    </AppText>
                    <TextInput
                      style={styles.input}
                      value={String(category.entry_fee)}
                      onChangeText={(value) =>
                        updateCategory(index, { entry_fee: Number(value) || 0 })
                      }
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                </View>

                <View style={styles.field}>
                  <AppText
                    variant="label"
                    weight="medium"
                    color={colors.textSecondary}
                    style={styles.label}
                  >
                    Prize Distribution
                  </AppText>
                  <TextInput
                    style={[styles.input, styles.prizeInput]}
                    value={category.prize ?? ''}
                    onChangeText={(value) =>
                      setCategories((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, prize: value, prizeEdited: true } : item
                        )
                      )
                    }
                    placeholder="1st Prize: ₹...\n2nd Prize: ₹..."
                    placeholderTextColor={colors.textMuted}
                    multiline
                    textAlignVertical="top"
                  />
                  <TouchableOpacity
                    style={styles.autoPrizeButton}
                    onPress={() =>
                      setCategories((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                prize:
                                  getAutoPrizeDistribution(item.entry_fee, item.max_players) ?? '',
                                prizeEdited: false,
                              }
                            : item
                        )
                      )
                    }
                  >
                    <Ionicons name="sparkles-outline" size={14} color={colors.primary} />
                    <AppText variant="caption" weight="semiBold" color={colors.primary}>
                      Auto-fill 1st and 2nd prize
                    </AppText>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null
          )}
        </View>

        <AppText
          variant="label"
          weight="semiBold"
          color={colors.textMuted}
          style={[styles.sectionLabel, { marginTop: 8 }]}
        >
          DETAILS
        </AppText>

        <View style={styles.field}>
          <AppText
            variant="label"
            weight="medium"
            color={colors.textSecondary}
            style={styles.label}
          >
            Organizer Phone *
          </AppText>
          <View style={styles.phoneList}>
            {contactPhones.map((phone, index) => (
              <View key={index} style={styles.phoneRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={phone}
                  onChangeText={(value) =>
                    setContactPhones((current) =>
                      current.map((item, itemIndex) => (itemIndex === index ? value : item))
                    )
                  }
                  placeholder={index === 0 ? 'Primary phone' : `Phone ${index + 1}`}
                  placeholderTextColor={colors.textMuted}
                  keyboardType="phone-pad"
                />
                {index > 0 ? (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={styles.removePhoneButton}
                    onPress={() =>
                      setContactPhones((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index)
                      )
                    }
                  >
                    <Ionicons name="close" size={18} color={colors.danger} />
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}
          </View>
          {contactPhones.length < 3 ? (
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.addPhoneButton}
              onPress={() => setContactPhones((current) => [...current, ''])}
            >
              <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
              <AppText variant="caption" weight="semiBold" color={colors.primary}>
                Add phone
              </AppText>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.field}>
          <AppText
            variant="label"
            weight="medium"
            color={colors.textSecondary}
            style={styles.label}
          >
            Payment Details
          </AppText>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={paymentAddress}
            onChangeText={setPaymentAddress}
            placeholder="UPI ID, QR note, or bank details"
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.field}>
          <AppText
            variant="label"
            weight="medium"
            color={colors.textSecondary}
            style={styles.label}
          >
            Description
          </AppText>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the tournament, rules, prizes..."
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.field}>
          <AppText
            variant="label"
            weight="medium"
            color={colors.textSecondary}
            style={styles.label}
          >
            Tournament Status *
          </AppText>
          <View style={styles.statusChoiceRow}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setPublishStatus('draft')}
              style={[styles.statusChoice, publishStatus === 'draft' && styles.statusChoiceActive]}
            >
              <Ionicons
                name="document-text-outline"
                size={18}
                color={publishStatus === 'draft' ? colors.primary : colors.textSecondary}
              />
              <View style={{ flex: 1 }}>
                <AppText
                  variant="label"
                  weight="semiBold"
                  color={publishStatus === 'draft' ? colors.primary : colors.text}
                >
                  Keep Draft
                </AppText>
                <AppText variant="xs" color={colors.textSecondary}>
                  Publish later
                </AppText>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setPublishStatus('open')}
              style={[styles.statusChoice, publishStatus === 'open' && styles.statusChoiceActive]}
            >
              <Ionicons
                name="rocket-outline"
                size={18}
                color={publishStatus === 'open' ? colors.primary : colors.textSecondary}
              />
              <View style={{ flex: 1 }}>
                <AppText
                  variant="label"
                  weight="semiBold"
                  color={publishStatus === 'open' ? colors.primary : colors.text}
                >
                  Publish Now
                </AppText>
                <AppText variant="xs" color={colors.textSecondary}>
                  Players can join
                </AppText>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <AppButton
          title="Create Tournament"
          onPress={handleCreate}
          loading={loading}
          style={styles.btn}
        />
        <View style={{ height: 24 }} />
      </KeyboardAwareScrollView>
      <LocationPickerModal
        colors={colors}
        initialCoordinate={selectedCoordinate}
        initialMapUrl={venueMapUrl}
        onClose={() => setMapPickerVisible(false)}
        onConfirm={handleLocationPicked}
        searchText={[venue, venueAddress, city, tournState, 'India'].filter(Boolean).join(', ')}
        styles={styles}
        visible={mapPickerVisible}
      />
    </SafeAreaView>
  );
}

interface MapCoordinate {
  latitude: number;
  longitude: number;
}

interface PickedLocation {
  latitude: number | null;
  longitude: number | null;
  mapUrl?: string;
}

function LocationPickerModal({
  colors,
  initialCoordinate,
  initialMapUrl,
  onClose,
  onConfirm,
  searchText,
  styles,
  visible,
}: {
  colors: ReturnType<typeof useTheme>['colors'];
  initialCoordinate: MapCoordinate | null;
  initialMapUrl: string;
  onClose: () => void;
  onConfirm: (location: PickedLocation) => void;
  searchText: string;
  styles: ReturnType<typeof makeStyles>;
  visible: boolean;
}) {
  const [mapUrl, setMapUrl] = useState(initialMapUrl);
  const [latitude, setLatitude] = useState(
    initialCoordinate ? String(initialCoordinate.latitude) : ''
  );
  const [longitude, setLongitude] = useState(
    initialCoordinate ? String(initialCoordinate.longitude) : ''
  );
  const parsedFromUrl = extractCoordinatesFromMapText(mapUrl);
  const typedCoordinate = getSelectedCoordinate(latitude, longitude);
  const pickedCoordinate = parsedFromUrl ?? typedCoordinate;
  const canUseLocation = !!mapUrl.trim() || !!pickedCoordinate;

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.mapBackdrop} onPress={onClose} />
      <View style={styles.locationSheet}>
        <KeyboardAwareScrollView
          bottomOffset={24}
          contentContainerStyle={styles.locationSheetContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.locationSheetHeader}>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.mapIconButton}>
              <Ionicons name="close" size={20} color={colors.text} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <AppText variant="bodyLg" weight="bold">
                Pick exact location
              </AppText>
              <AppText variant="caption" color={colors.textSecondary}>
                Open Maps, drop/share a pin, then paste the link here
              </AppText>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => openLocationSearch(searchText || 'India')}
            style={styles.openMapPickerButton}
          >
            <Ionicons name="map-outline" size={18} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <AppText variant="label" weight="semiBold" color={colors.primary}>
                Open Maps
              </AppText>
              <AppText variant="caption" color={colors.textSecondary}>
                Search the venue, drop a pin, then copy/share the link
              </AppText>
            </View>
            <Ionicons name="open-outline" size={17} color={colors.primary} />
          </TouchableOpacity>

          <View style={styles.field}>
            <AppText
              variant="label"
              weight="medium"
              color={colors.textSecondary}
              style={styles.label}
            >
              Maps Link
            </AppText>
            <TextInput
              autoCapitalize="none"
              keyboardType="url"
              onChangeText={(value) => {
                setMapUrl(value);
                const coordinate = extractCoordinatesFromMapText(value);
                if (coordinate) {
                  setLatitude(String(coordinate.latitude));
                  setLongitude(String(coordinate.longitude));
                }
              }}
              placeholder="Paste Google Maps pin link"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={mapUrl}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <AppText
                variant="label"
                weight="medium"
                color={colors.textSecondary}
                style={styles.label}
              >
                Latitude
              </AppText>
              <TextInput
                keyboardType="decimal-pad"
                onChangeText={setLatitude}
                placeholder="22.5726"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                value={latitude}
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <AppText
                variant="label"
                weight="medium"
                color={colors.textSecondary}
                style={styles.label}
              >
                Longitude
              </AppText>
              <TextInput
                keyboardType="decimal-pad"
                onChangeText={setLongitude}
                placeholder="88.3639"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                value={longitude}
              />
            </View>
          </View>

          {pickedCoordinate ? (
            <View style={styles.coordinatePill}>
              <Ionicons name="location-outline" size={15} color={colors.primary} />
              <AppText variant="caption" weight="semiBold" color={colors.primary}>
                {pickedCoordinate.latitude.toFixed(5)}, {pickedCoordinate.longitude.toFixed(5)}
              </AppText>
            </View>
          ) : (
            <View style={styles.locationNotice}>
              <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
              <AppText variant="caption" color={colors.textSecondary} style={{ flex: 1 }}>
                Paste a Maps link with coordinates, or enter latitude and longitude manually.
              </AppText>
            </View>
          )}

          <AppButton
            disabled={!canUseLocation}
            title="Use This Location"
            onPress={() =>
              onConfirm({
                latitude: pickedCoordinate?.latitude ?? null,
                longitude: pickedCoordinate?.longitude ?? null,
                mapUrl,
              })
            }
            style={styles.usePinButton}
          />
        </KeyboardAwareScrollView>
      </View>
    </Modal>
  );
}

function updatePrizeForCategory<
  T extends { entry_fee: number; max_players: number; prizeEdited?: boolean; prize: string | null },
>(category: T) {
  if (category.prizeEdited) return category;
  return {
    ...category,
    prize: getAutoPrizeDistribution(category.entry_fee, category.max_players),
  };
}

function normalizeCategoryName(name: string) {
  return name.trim().replace(/\s+/g, ' ');
}

function hasDuplicateCategoryNames(categories: { name: string }[]) {
  const seen = new Set<string>();
  return categories.some((category) => {
    const normalized = normalizeCategoryName(category.name).toLowerCase();
    if (!normalized) return false;
    if (seen.has(normalized)) return true;
    seen.add(normalized);
    return false;
  });
}

function toDateString(date: Date) {
  // Local calendar date — `toISOString()` would shift IST evenings back a day.
  return toDateOnlyString(date);
}

function getSelectedCoordinate(latitudeText: string, longitudeText: string) {
  const latitude = parseOptionalCoordinate(latitudeText);
  const longitude = parseOptionalCoordinate(longitudeText);
  if (latitude === null || longitude === null || !isValidCoordinates(latitude, longitude)) {
    return null;
  }

  return { latitude, longitude };
}

function parseOptionalCoordinate(value: string) {
  if (!value.trim()) return null;
  const coordinate = Number(value.trim());
  return Number.isFinite(coordinate) ? coordinate : null;
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 12,
    },
    scroll: {
      paddingHorizontal: 20,
      paddingTop: 4,
    },
    sectionLabel: {
      marginTop: 16,
      marginBottom: 4,
      letterSpacing: 0.5,
    },
    field: { marginTop: 14 },
    row: { flexDirection: 'row', gap: 12 },
    label: { marginBottom: 6 },
    input: {
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      minHeight: 48,
      paddingHorizontal: 14,
      fontSize: 15,
      color: colors.text,
      fontFamily: 'Inter_Regular',
    },
    textarea: {
      minHeight: 100,
      paddingTop: 12,
    },
    locationCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      gap: 10,
      marginTop: 14,
      padding: 14,
    },
    locationHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
    },
    locationInput: {
      backgroundColor: colors.background,
    },
    coordinateInput: {
      backgroundColor: colors.background,
      flex: 1,
    },
    pickedLocationRow: {
      alignItems: 'center',
      backgroundColor: colors.primaryLight,
      borderRadius: 10,
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    inlineMeta: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 5,
    },
    smallAction: {
      alignItems: 'center',
      backgroundColor: colors.primaryLight,
      borderRadius: 999,
      flexDirection: 'row',
      gap: 5,
      minHeight: 34,
      paddingHorizontal: 10,
    },
    phoneList: {
      gap: 8,
    },
    phoneRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    removePhoneButton: {
      alignItems: 'center',
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      height: 48,
      justifyContent: 'center',
      width: 48,
    },
    addPhoneButton: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      flexDirection: 'row',
      gap: 5,
      marginTop: 8,
      paddingVertical: 4,
    },
    categoryList: {
      gap: 12,
      marginTop: 14,
    },
    categoryPickerCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      marginTop: 12,
      padding: 12,
    },
    categoryPickerButton: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
    },
    selectedChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 12,
    },
    selectedChip: {
      alignItems: 'center',
      backgroundColor: colors.primaryLight,
      borderColor: colors.primary,
      borderRadius: 999,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 5,
      paddingHorizontal: 9,
      paddingVertical: 6,
    },
    categoryMenu: {
      borderTopColor: colors.border,
      borderTopWidth: 1,
      gap: 8,
      marginTop: 12,
      paddingTop: 12,
    },
    categoryOption: {
      alignItems: 'center',
      backgroundColor: colors.background,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 10,
      padding: 10,
    },
    categoryOptionActive: {
      backgroundColor: colors.primaryLight,
      borderColor: colors.primary,
    },
    categoryOptionIcon: {
      alignItems: 'center',
      borderColor: colors.primary,
      borderRadius: 8,
      borderWidth: 1,
      height: 26,
      justifyContent: 'center',
      width: 26,
    },
    categoryOptionIconActive: {
      backgroundColor: colors.primary,
    },
    customCategoryBox: {
      backgroundColor: colors.background,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      gap: 8,
      padding: 10,
    },
    customCategoryRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    customCategoryInput: {
      flex: 1,
    },
    addCustomCategoryButton: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 12,
      height: 48,
      justifyContent: 'center',
      width: 48,
    },
    addCustomCategoryButtonDisabled: {
      opacity: 0.45,
    },
    categorySummary: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: colors.primaryLight,
      borderRadius: 10,
      flexDirection: 'row',
      gap: 6,
      marginTop: 8,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    categoryCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      padding: 14,
    },
    categoryHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
    },
    categoryBadge: {
      alignItems: 'center',
      backgroundColor: colors.primaryLight,
      borderRadius: 10,
      height: 34,
      justifyContent: 'center',
      width: 34,
    },
    categoryRemoveButton: {
      alignItems: 'center',
      borderColor: colors.border,
      borderRadius: 10,
      borderWidth: 1,
      height: 34,
      justifyContent: 'center',
      width: 34,
    },
    checkBox: {
      alignItems: 'center',
      borderColor: colors.border,
      borderRadius: 6,
      borderWidth: 1,
      height: 24,
      justifyContent: 'center',
      width: 24,
    },
    checkBoxActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    prizeInput: {
      minHeight: 72,
      paddingTop: 12,
    },
    autoPrizeButton: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      flexDirection: 'row',
      gap: 5,
      marginTop: 8,
      paddingVertical: 4,
    },
    mapBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay,
    },
    locationSheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      bottom: 0,
      left: 0,
      maxHeight: '88%',
      overflow: 'hidden',
      position: 'absolute',
      right: 0,
    },
    locationSheetContent: {
      paddingBottom: 24,
      paddingHorizontal: 20,
      paddingTop: 18,
    },
    locationSheetHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
      marginBottom: 14,
    },
    mapIconButton: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 999,
      height: 38,
      justifyContent: 'center',
      width: 38,
    },
    openMapPickerButton: {
      alignItems: 'center',
      backgroundColor: colors.primaryLight,
      borderColor: colors.primary,
      borderRadius: 14,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 10,
      padding: 12,
    },
    coordinatePill: {
      alignItems: 'center',
      alignSelf: 'center',
      backgroundColor: colors.primaryLight,
      borderRadius: 999,
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
      marginTop: 14,
    },
    locationNotice: {
      alignItems: 'flex-start',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 8,
      marginTop: 14,
      padding: 12,
    },
    usePinButton: {
      marginTop: 14,
    },
    statusChoiceRow: {
      gap: 10,
    },
    statusChoice: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 10,
      minHeight: 58,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    statusChoiceActive: {
      backgroundColor: colors.primaryLight,
      borderColor: colors.primary,
    },
    btn: { marginTop: 28 },
  });
}
