import { ProfileActions } from "./profile-actions";
import { ProfileHeader } from "./profile-header";
import { ProfileTabs } from "./profile-tabs";

export const ProfilePage = () => {
  return (
    <div className="flex w-full flex-col gap-12 pb-12 font-body text-ink md:gap-20 md:pb-16">
      <ProfileHeader />

      <div className="mx-auto flex w-full max-w-[calc(var(--container-content)+4rem)] flex-col gap-12 px-4 md:gap-16 md:px-8">
        <ProfileTabs />
        <ProfileActions />
      </div>
    </div>
  );
};
