// SmashDraw — send-push Edge Function
//
// Two entry points, both from pg_net:
//   { "notification_id": "<uuid>" }  one notification → that user's devices
//   { "broadcast_id": "<uuid>" }     a fan-out batch → every recipient's devices
//
// Deploy:  supabase functions deploy send-push
// Secrets: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.
//          Set EXPO_ACCESS_TOKEN only if you enabled push security in Expo.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

/** Expo's documented per-request maximum. */
const EXPO_CHUNK_SIZE = 100;

/** Rows pulled per page when expanding a broadcast. */
const BROADCAST_PAGE_SIZE = 1000;

interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  tournament_id: string | null;
  match_id: string | null;
  data: Record<string, unknown>;
}

interface ExpoPushMessage {
  to: string;
  sound: string;
  title: string;
  body: string;
  badge?: number;
  channelId: string;
  priority: string;
  data: Record<string, unknown>;
}

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

function buildMessage(
  notification: NotificationRow,
  token: string,
  badge?: number
): ExpoPushMessage {
  return {
    to: token,
    sound: 'default',
    title: notification.title,
    body: notification.body,
    badge,
    channelId: 'default',
    priority: 'high',
    data: {
      notificationId: notification.id,
      type: notification.type,
      tournamentId: notification.tournament_id,
      matchId: notification.match_id,
      ...notification.data,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Function is missing Supabase credentials' }, 500);
  }

  let notificationId: string | undefined;
  let broadcastId: string | undefined;
  try {
    ({ notification_id: notificationId, broadcast_id: broadcastId } = await req.json());
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (!notificationId && !broadcastId) {
    return json({ error: 'notification_id or broadcast_id is required' }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const messages: ExpoPushMessage[] = [];

  if (notificationId) {
    const { data: notification, error: notificationError } = await supabase
      .from('notifications')
      .select('id, user_id, type, title, body, tournament_id, match_id, data')
      .eq('id', notificationId)
      .single<NotificationRow>();

    if (notificationError || !notification) {
      return json({ error: notificationError?.message ?? 'Notification not found' }, 404);
    }

    const { data: tokenRows, error: tokenError } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', notification.user_id);

    if (tokenError) {
      return json({ error: tokenError.message }, 500);
    }

    const tokens = (tokenRows ?? []).map((row) => row.token as string);
    if (tokens.length === 0) {
      return json({ sent: 0, reason: 'No registered devices for this user' });
    }

    // Unread count so the app icon badge stays accurate.
    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', notification.user_id)
      .is('read_at', null);

    for (const token of tokens) {
      messages.push(buildMessage(notification, token, unreadCount ?? undefined));
    }
  } else {
    // Broadcast: page through the batch, and resolve devices per page so a
    // platform-wide announcement never holds every row in memory at once.
    // The badge is left off here — one count query per recipient would cost far
    // more than the badge is worth, and the app corrects it on next launch.
    for (let offset = 0; ; offset += BROADCAST_PAGE_SIZE) {
      const { data: rows, error: rowsError } = await supabase
        .from('notifications')
        .select('id, user_id, type, title, body, tournament_id, match_id, data')
        .eq('broadcast_id', broadcastId)
        .order('created_at', { ascending: true })
        .range(offset, offset + BROADCAST_PAGE_SIZE - 1)
        .returns<NotificationRow[]>();

      if (rowsError) {
        return json({ error: rowsError.message }, 500);
      }
      if (!rows || rows.length === 0) break;

      const { data: tokenRows, error: tokenError } = await supabase
        .from('push_tokens')
        .select('user_id, token')
        .in(
          'user_id',
          rows.map((row) => row.user_id)
        );

      if (tokenError) {
        return json({ error: tokenError.message }, 500);
      }

      const tokensByUser = new Map<string, string[]>();
      for (const row of tokenRows ?? []) {
        const userId = row.user_id as string;
        const existing = tokensByUser.get(userId);
        if (existing) existing.push(row.token as string);
        else tokensByUser.set(userId, [row.token as string]);
      }

      for (const row of rows) {
        for (const token of tokensByUser.get(row.user_id) ?? []) {
          messages.push(buildMessage(row, token));
        }
      }

      if (rows.length < BROADCAST_PAGE_SIZE) break;
    }

    if (messages.length === 0) {
      return json({ sent: 0, reason: 'No registered devices for this broadcast' });
    }
  }

  const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'Accept-Encoding': 'gzip, deflate',
  };
  if (expoAccessToken) {
    headers.Authorization = `Bearer ${expoAccessToken}`;
  }

  // Tickets come back positionally, so pair them with the chunk that produced
  // them — a failed chunk must not shift the alignment for the chunks after it.
  const tickets: ExpoPushTicket[] = [];
  const staleTokens: string[] = [];

  for (let i = 0; i < messages.length; i += EXPO_CHUNK_SIZE) {
    const chunk = messages.slice(i, i + EXPO_CHUNK_SIZE);
    const response = await fetch(EXPO_PUSH_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify(chunk),
    });

    const result = await response.json().catch(() => null);
    if (!response.ok) {
      console.error('Expo push request failed', response.status, result);
      continue;
    }

    const chunkTickets = (result?.data ?? []) as ExpoPushTicket[];
    tickets.push(...chunkTickets);

    // Drop tokens Expo tells us are dead so we stop pushing to them.
    chunkTickets.forEach((ticket, index) => {
      const token = chunk[index]?.to;
      if (token && ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
        staleTokens.push(token);
      }
    });
  }

  if (staleTokens.length > 0) {
    await supabase.from('push_tokens').delete().in('token', staleTokens);
  }

  const delivered = tickets.filter((ticket) => ticket.status === 'ok').length;

  return json({
    sent: delivered,
    failed: tickets.length - delivered,
    removedTokens: staleTokens.length,
  });
});
