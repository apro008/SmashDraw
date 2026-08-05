import { isDoublesCategory } from '~/constants/TournamentCategories';
import type { TournamentRegistrationDetails } from '~/lib/tournaments';

export interface Contestant {
  id: string;
  /** Null for manually added names — those players never registered on SmashDraw. */
  userId: string | null;
  categoryId: string | null;
  name: string;
  detail: string;
  isGuest: boolean;
}

export function buildContestants(
  registrations: TournamentRegistrationDetails[],
  categoryId: string | null
): Contestant[] {
  return registrations
    .filter((registration) => registration.status === 'approved')
    .filter((registration) => !categoryId || registration.category_id === categoryId)
    .map((registration) => {
      const notes = parseRegistrationNotes(registration.notes);
      const playerName = notes.playerName ?? registration.player?.name ?? 'Player';
      const partnerName = notes.partnerName;
      const isDoubles = isDoublesCategory(registration.category?.name ?? '');
      return {
        id: registration.id,
        userId: registration.user_id,
        categoryId: registration.category_id,
        name: isDoubles && partnerName ? `${playerName} / ${partnerName}` : playerName,
        detail: registration.player?.city ?? '',
        isGuest: false,
      };
    });
}

let guestCounter = 0;

/**
 * A contestant the organizer typed in by hand. Used when a player reached the draw
 * without registering in the app — the result is stored by name with a null player id.
 */
export function createGuestContestant(
  name: string,
  categoryId: string | null,
  userId: string | null = null
): Contestant {
  guestCounter += 1;
  return {
    id: `guest-${guestCounter}`,
    userId,
    categoryId,
    name: name.trim(),
    detail: 'Added manually',
    isGuest: true,
  };
}

export function findContestantId(
  contestants: Contestant[],
  userId?: string | null,
  name?: string | null
) {
  return (
    (userId ? contestants.find((item) => item.userId === userId)?.id : undefined) ??
    (name ? contestants.find((item) => item.name === name)?.id : undefined)
  );
}

export function parseRegistrationNotes(notes: string | null) {
  if (!notes) return {};
  try {
    return JSON.parse(notes) as {
      playerName?: string;
      partnerName?: string | null;
    };
  } catch {
    return {};
  }
}
