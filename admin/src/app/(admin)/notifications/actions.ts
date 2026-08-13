'use server';

import { randomUUID } from 'node:crypto';

import { requireAdmin } from '~/lib/auth';
import { isRegistrationStatus, resolveAudience, type Audience } from '~/lib/audience';
import { supabaseAdmin } from '~/lib/supabaseAdmin';
import { USER_ROLES, type UserRole } from '~/types';
import { fail, ok, type ActionResult } from '../tournaments/[id]/state';
import type { ComposerState } from './state';

/**
 * Free-text notifications, addressed by tournament or by player attributes.
 *
 * `requireAdmin()` first, as everywhere here — the service role ignores RLS, and
 * this writes rows that make a push land on someone's lock screen.
 */

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? '').trim();
  return value.length > 0 ? value : null;
}

function readAudience(formData: FormData): Audience {
  const role = String(formData.get('role') ?? 'all');
  return {
    mode: formData.get('mode') === 'tournament' ? 'tournament' : 'users',
    tournamentId: text(formData, 'tournament_id'),
    statuses: formData.getAll('statuses').map(String).filter(isRegistrationStatus),
    role: (USER_ROLES as string[]).includes(role) ? (role as UserRole) : 'all',
    city: text(formData, 'city'),
    state: text(formData, 'state'),
  };
}

/** Step one: how many people would this reach, and who are they. */
export async function previewAudience(
  prev: ComposerState,
  formData: FormData
): Promise<ComposerState> {
  await requireAdmin();

  const title = text(formData, 'title');
  const body = text(formData, 'body');
  if (!title || !body) {
    return { ...prev, ...fail('A notification needs both a title and a message.'), preview: null };
  }

  try {
    const { userIds, label } = await resolveAudience(readAudience(formData));
    if (userIds.length === 0) {
      return {
        ...prev,
        ...fail(`Nobody matches that — no accounts found for ${label}.`),
        preview: null,
      };
    }
    return {
      ok: true,
      message: '',
      preview: { count: userIds.length, label, title, body },
    };
  } catch (error) {
    return { ...prev, ...fail(errorMessage(error)), preview: null };
  }
}

/**
 * Step two. The audience is resolved again rather than trusting the count the
 * browser posts back — if it moved since the preview, the send stops instead of
 * reaching more people than were confirmed.
 */
export async function sendNotification(
  prev: ComposerState,
  formData: FormData
): Promise<ComposerState> {
  await requireAdmin();

  const title = text(formData, 'title');
  const body = text(formData, 'body');
  const confirmed = Number.parseInt(String(formData.get('confirmed_count') ?? ''), 10);
  if (!title || !body) {
    return { ...prev, ...fail('A notification needs both a title and a message.') };
  }

  const audience = readAudience(formData);

  try {
    const { userIds, label } = await resolveAudience(audience);
    if (userIds.length === 0) {
      return { ...prev, ...fail('Nobody matches that any more — nothing was sent.') };
    }
    if (userIds.length !== confirmed) {
      return {
        ok: false,
        message: `The audience changed from ${confirmed} to ${userIds.length} since you previewed it. Check the count and send again.`,
        preview: { count: userIds.length, label, title, body },
      };
    }

    const result = await insertBroadcast(userIds, {
      title,
      body,
      tournamentId: audience.mode === 'tournament' ? audience.tournamentId : null,
    });
    if (!result.ok) return { ...prev, ...result };

    return {
      ok: true,
      message: `Sent to ${userIds.length} ${userIds.length === 1 ? 'person' : 'people'} — ${label}.`,
      preview: null,
    };
  } catch (error) {
    return { ...prev, ...fail(errorMessage(error)) };
  }
}

/*
 * One `broadcast_id` across every row, which makes the per-row push trigger skip
 * them, then a single `dispatch_broadcast_push` for the batch. Inserting these
 * without a broadcast id would fire one Edge Function request per recipient.
 */
const INSERT_CHUNK = 500;

async function insertBroadcast(
  userIds: string[],
  content: { title: string; body: string; tournamentId: string | null }
): Promise<ActionResult> {
  const db = supabaseAdmin();
  const broadcastId = randomUUID();

  for (let index = 0; index < userIds.length; index += INSERT_CHUNK) {
    const { error } = await db.from('notifications').insert(
      userIds.slice(index, index + INSERT_CHUNK).map((userId) => ({
        user_id: userId,
        type: 'announcement',
        title: content.title,
        body: content.body,
        tournament_id: content.tournamentId,
        data: {},
        broadcast_id: broadcastId,
      }))
    );

    if (error) {
      const missingColumn = /broadcast_id/i.test(error.message);
      return fail(
        missingColumn
          ? `${error.message} — run supabase/notifications.sql on the database; it adds broadcast_id and is safe to re-run.`
          : error.message
      );
    }
  }

  const { error: dispatchError } = await db.rpc('dispatch_broadcast_push', {
    p_broadcast_id: broadcastId,
  });

  // The feed rows are already written, so a failed dispatch is a partial success:
  // everyone sees it in-app, nobody got a push. Say so rather than claiming both.
  if (dispatchError) {
    return fail(
      `Saved to ${userIds.length} notification feeds, but the push dispatch failed: ${dispatchError.message}`
    );
  }

  return ok('');
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
