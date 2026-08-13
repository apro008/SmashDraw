import 'server-only';

import { supabaseAdmin } from './supabaseAdmin';
import { REGISTRATION_STATUSES, type RegistrationStatus, type UserRole } from '~/types';

/**
 * Who a custom notification goes to.
 *
 * Resolving lives here rather than in the action so the count shown in the
 * preview and the list actually written are produced by the same code — a
 * preview that disagrees with the send is worse than no preview.
 */
export interface Audience {
  mode: 'tournament' | 'users';
  /** `tournament` mode. */
  tournamentId: string | null;
  statuses: RegistrationStatus[];
  /** `users` mode. Empty/`all` means "do not narrow on this". */
  role: UserRole | 'all';
  city: string | null;
  state: string | null;
}

export interface ResolvedAudience {
  userIds: string[];
  /** Human description, shown on the confirm step. */
  label: string;
}

/*
 * PostgREST caps a response at 1000 rows by default, so a single `select` would
 * silently under-count any audience bigger than that — and under-counting here
 * means quietly not notifying people. Page until the source runs dry.
 */
const PAGE_SIZE = 1000;

async function fetchAllIds(
  build: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
  pick: (row: never) => string | null
) {
  const ids: string[] = [];
  for (let page = 0; ; page++) {
    const { data, error } = await build(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (error) throw error;
    const rows = (data ?? []) as never[];
    for (const row of rows) {
      const id = pick(row);
      if (id) ids.push(id);
    }
    if (rows.length < PAGE_SIZE) break;
  }
  return ids;
}

export function isRegistrationStatus(value: string): value is RegistrationStatus {
  return (REGISTRATION_STATUSES as string[]).includes(value);
}

export async function resolveAudience(audience: Audience): Promise<ResolvedAudience> {
  const db = supabaseAdmin();

  if (audience.mode === 'tournament') {
    if (!audience.tournamentId) return { userIds: [], label: 'No tournament selected' };
    const statuses = audience.statuses.length > 0 ? audience.statuses : ['approved'];

    const ids = await fetchAllIds(
      (from, to) =>
        db
          .from('registrations')
          .select('user_id')
          .eq('tournament_id', audience.tournamentId)
          .in('status', statuses)
          .not('user_id', 'is', null)
          .range(from, to),
      (row: { user_id: string | null }) => row.user_id
    );

    const { data: tournament } = await db
      .from('tournaments')
      .select('title')
      .eq('id', audience.tournamentId)
      .maybeSingle<{ title: string }>();

    // A player entered in two categories has two registration rows.
    const userIds = [...new Set(ids)];
    return {
      userIds,
      label: `${statuses.join(' or ')} entries in ${tournament?.title ?? 'the tournament'}`,
    };
  }

  const ids = await fetchAllIds(
    (from, to) => {
      let query = db.from('profiles').select('id');
      if (audience.role !== 'all') query = query.eq('role', audience.role);
      if (audience.city) query = query.ilike('city', audience.city);
      if (audience.state) query = query.ilike('state', audience.state);
      return query.range(from, to);
    },
    (row: { id: string }) => row.id
  );

  const parts = [
    audience.role === 'all' ? 'all accounts' : `${audience.role}s`,
    audience.city ? `in ${audience.city}` : null,
    audience.state ? `(${audience.state})` : null,
  ].filter(Boolean);

  return { userIds: [...new Set(ids)], label: parts.join(' ') };
}
