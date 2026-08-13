import type { RegistrationDetails, RegistrationNotes } from '~/types';

/**
 * `registrations.notes` holds a JSON blob written by the app's registration and
 * add-entry sheets. Older or hand-written rows may be plain text, which the app
 * treats as a free-form note — same fallback here.
 */
export function parseNotes(notes: string | null): RegistrationNotes {
  if (!notes) return {};
  try {
    const parsed = JSON.parse(notes);
    return parsed && typeof parsed === 'object' ? (parsed as RegistrationNotes) : { notes };
  } catch {
    return { notes };
  }
}

export function isDoublesCategory(name: string | null | undefined) {
  return (name ?? '').toLowerCase().includes('doubles');
}

/** Everything the table needs about one entry, notes already unpacked. */
export interface EntryView {
  registration: RegistrationDetails;
  details: RegistrationNotes;
  /** Player name, then the partner for a doubles pair. */
  displayName: string;
  partnerName: string | null;
  phone: string | null;
  email: string | null;
  freeNotes: string | null;
  /** True when an organizer or admin created this entry rather than the player. */
  isManualEntry: boolean;
  /** A walk-in with no SmashDraw account — gets no push notifications. */
  isWalkIn: boolean;
}

export function toEntryView(registration: RegistrationDetails): EntryView {
  const details = parseNotes(registration.notes);
  const playerName = details.playerName ?? registration.player?.name ?? 'Unnamed entry';
  const partnerName = details.partnerName?.trim() || null;

  return {
    registration,
    details,
    displayName: playerName,
    partnerName,
    phone: details.phone?.trim() || registration.player?.phone || null,
    email: details.email?.trim() || registration.player?.email || null,
    freeNotes: details.notes?.trim() || null,
    // `!= null` on purpose: on a database where features.sql has not been run
    // yet the column is absent, so the field is `undefined` rather than null,
    // and a strict check would label every entry as manually added.
    isManualEntry: registration.added_by != null || details.addedByOrganizer === true,
    isWalkIn: registration.user_id === null,
  };
}
