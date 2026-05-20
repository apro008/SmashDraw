import { Platform } from 'react-native';
import * as Calendar from 'expo-calendar';

export interface CalendarEventInput {
  title: string;
  location?: string;
  notes?: string;
  startDate: Date;
  endDate: Date;
}

async function ensureCalendarPermissions() {
  if (Platform.OS === 'web') {
    throw new Error('Calendar reminders are only available in the mobile app.');
  }

  const current = await Calendar.getCalendarPermissionsAsync();
  if (current.granted) return;

  if (current.status === 'denied' && !current.canAskAgain) {
    throw new Error('Calendar permission is blocked. Enable it from device settings.');
  }

  const requested = await Calendar.requestCalendarPermissionsAsync();
  if (!requested.granted) {
    throw new Error('Calendar permission was not granted.');
  }
}

async function getWritableCalendarId() {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const appCalendar = calendars.find(
    (calendar) => calendar.title === 'SmashDraw' && calendar.allowsModifications
  );
  if (appCalendar) return appCalendar.id;

  const writableCalendar = calendars.find(
    (calendar) => calendar.allowsModifications && calendar.source?.name !== 'Contacts'
  );
  if (writableCalendar) return writableCalendar.id;

  const defaultCalendar = await Calendar.getDefaultCalendarAsync().catch(() => null);
  const source =
    Platform.OS === 'ios' && defaultCalendar?.source
      ? defaultCalendar.source
      : { isLocalAccount: true, name: 'SmashDraw', type: Calendar.SourceType.LOCAL };

  return Calendar.createCalendarAsync({
    title: 'SmashDraw',
    color: '#1A73E8',
    entityType: Calendar.EntityTypes.EVENT,
    ...(Platform.OS === 'ios' && defaultCalendar?.source?.id
      ? { sourceId: defaultCalendar.source.id }
      : null),
    source,
    name: 'SmashDraw',
    ownerAccount: 'SmashDraw',
    accessLevel: Calendar.CalendarAccessLevel.OWNER,
  });
}

export async function addCalendarEvent(input: CalendarEventInput) {
  await ensureCalendarPermissions();
  const calendarId = await getWritableCalendarId();

  return Calendar.createEventAsync(calendarId, {
    title: input.title,
    location: input.location,
    notes: input.notes,
    startDate: input.startDate,
    endDate: input.endDate,
    alarms: [{ relativeOffset: -60 }],
    timeZone: 'Asia/Kolkata',
  });
}
