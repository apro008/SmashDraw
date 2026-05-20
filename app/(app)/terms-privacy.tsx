import { InfoBlock, StaticPage } from '~/components/profile/StaticPage';

export default function TermsPrivacyScreen() {
  return (
    <StaticPage
      title="Terms & Privacy"
      icon="document-text-outline"
      subtitle="Static policy overview for the SmashDraw app experience."
    >
      <InfoBlock
        icon="document-outline"
        title="Terms"
        body="Use SmashDraw to create, discover, and join tournaments responsibly. Organizers are responsible for accurate event details and fair communication."
      />
      <InfoBlock
        icon="lock-closed-outline"
        title="Privacy"
        body="Profile, location, and registration details are used to run tournament workflows and show relevant event information."
      />
      <InfoBlock
        icon="people-outline"
        title="Registration data"
        body="Tournament organizers and admins may view submitted player details for event operations, approvals, and scheduling."
      />
      <InfoBlock
        icon="trash-outline"
        title="Data requests"
        body="For correction or deletion requests, contact support@smashdraw.app from your registered email address."
      />
    </StaticPage>
  );
}
