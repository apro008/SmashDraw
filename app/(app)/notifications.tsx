import { InfoBlock, StaticPage } from '~/components/profile/StaticPage';

export default function NotificationsScreen() {
  return (
    <StaticPage
      title="Notifications"
      icon="notifications-outline"
      subtitle="A preview of the alerts SmashDraw will send for tournament activity."
    >
      <InfoBlock
        icon="checkmark-circle-outline"
        title="Registration updates"
        body="You will see confirmations, waitlist updates, and organizer decisions here."
      />
      <InfoBlock
        icon="calendar-outline"
        title="Match reminders"
        body="Upcoming match schedules, finals reminders, and calendar prompts will appear in this feed."
      />
      <InfoBlock
        icon="megaphone-outline"
        title="Tournament announcements"
        body="Organizers can use this area for venue changes, reporting time, and important event notes."
      />
    </StaticPage>
  );
}
