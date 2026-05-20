import { InfoBlock, StaticPage } from '~/components/profile/StaticPage';

export default function SupportScreen() {
  return (
    <StaticPage
      title="Help & Support"
      icon="help-circle-outline"
      subtitle="Quick support information for players, organizers, and admins."
    >
      <InfoBlock
        icon="mail-outline"
        title="Contact"
        body="For account, registration, or tournament help, contact the SmashDraw support team at support@smashdraw.app."
      />
      <InfoBlock
        icon="trophy-outline"
        title="Tournament issues"
        body="If match details, categories, or venue information look wrong, contact the tournament organizer first."
      />
      <InfoBlock
        icon="shield-checkmark-outline"
        title="Safety and disputes"
        body="Keep registration details accurate. For disputes, admins may review organizer records and player submissions."
      />
    </StaticPage>
  );
}
