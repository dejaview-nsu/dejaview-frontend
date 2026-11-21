import { useUnit } from "effector-react";
import { Camera, CircleAlert, Pencil, User, X } from "lucide-react";
import { type PointerEvent, useState } from "react";
import { Button as AriaButton } from "react-aria-components";

import { $$session } from "@/entities/session";

import { Button } from "@/shared/ui";

import { PROFILE_TEXTS } from "../config";
import { formatDate } from "../lib";
import { $$userProfile, comingSoonPressed } from "../model";
import { ProfileStats } from "./profile-stats";

const ProfileAvatar = ({
  url,
  username,
  onComingSoon,
}: {
  url: string | null;
  username: string;
  onComingSoon: () => void;
}) => {
  const [failed, setFailed] = useState(false);
  const [hovered, setHovered] = useState(false);

  const handlePointerHover = (event: PointerEvent<HTMLDivElement>, value: boolean) => {
    if (event.pointerType !== "touch") setHovered(value);
  };

  return (
    <div
      data-hovered={hovered || undefined}
      onPointerEnter={(event) => handlePointerHover(event, true)}
      onPointerLeave={(event) => handlePointerHover(event, false)}
      className="group relative size-27 shrink-0 md:size-40"
    >
      <div className="size-full overflow-hidden rounded-full border-4 border-card bg-brand-gold">
        {url && !failed ? (
          <img
            src={url}
            alt={PROFILE_TEXTS.avatarAlt(username)}
            className="size-full object-cover"
            onError={() => setFailed(true)}
          />
        ) : (
          <span
            className="flex size-full items-center justify-center text-ink transition-opacity duration-200 group-data-[hovered]:opacity-0 group-has-[[data-focus-visible]]:opacity-0"
            aria-hidden="true"
          >
            <User className="size-14 md:size-20" strokeWidth={1.5} />
          </span>
        )}
      </div>

      <AriaButton
        aria-label={PROFILE_TEXTS.changePhoto}
        onPress={onComingSoon}
        className="absolute inset-1 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-full bg-header/65 text-on-dark opacity-0 outline-link transition-opacity duration-200 group-data-[hovered]:opacity-100 data-[focus-visible]:opacity-100 data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-4"
      >
        <Camera className="size-6 md:size-8" strokeWidth={1.75} aria-hidden="true" />
        <span className="hidden text-sm leading-tight font-medium md:block">{PROFILE_TEXTS.changePhoto}</span>
      </AriaButton>

      {url && (
        <AriaButton
          aria-label={PROFILE_TEXTS.deletePhoto}
          onPress={onComingSoon}
          className="absolute -bottom-5.5 left-1/2 flex size-11 -translate-x-1/2 cursor-pointer items-center justify-center rounded-full outline-link transition-opacity duration-200 data-[focus-visible]:outline-2 md:opacity-0 md:group-data-[hovered]:opacity-100 md:group-has-[[data-focus-visible]]:opacity-100"
        >
          <span className="flex size-8 items-center justify-center rounded-full border-2 border-border-strong bg-card text-ink">
            <X size={18} strokeWidth={2} aria-hidden="true" />
          </span>
        </AriaButton>
      )}
    </div>
  );
};

const ProfileHeaderSkeleton = () => (
  <div
    role="status"
    aria-label={PROFILE_TEXTS.loadingProfile}
    className="flex flex-col gap-4 motion-safe:animate-pulse"
  >
    <div className="h-10 w-48 bg-disabled-bg md:h-14 md:w-64" />
    <div className="h-4 w-72 max-w-full bg-disabled-bg" />
    <span className="sr-only">{PROFILE_TEXTS.loadingProfile}…</span>
  </div>
);

export const ProfileHeader = () => {
  const { user, profile, status, retryPressed, showComingSoon } = useUnit({
    user: $$session.outputs.$user,
    profile: $$userProfile.outputs.$profile,
    status: $$userProfile.outputs.$status,
    retryPressed: $$userProfile.inputs.retryPressed,
    showComingSoon: comingSoonPressed,
  });

  const username = profile?.username ?? user?.username ?? "";

  return (
    <section className="flex flex-col">
      <div aria-hidden="true" className="h-[143px] bg-header md:h-[178px]" />

      <div className="mx-auto flex w-full max-w-[calc(var(--container-content)+4rem)] flex-col gap-5 px-4 md:gap-12 md:px-8">
        <div className="-mt-[54px] md:-mt-20">
          <ProfileAvatar
            key={user?.avatar_url}
            url={user?.avatar_url ?? null}
            username={username}
            onComingSoon={() => showComingSoon()}
          />
        </div>

        {(status === "idle" || status === "loading") && <ProfileHeaderSkeleton />}

        {status === "failed" && (
          <div role="alert" className="flex flex-wrap items-center gap-4">
            <CircleAlert className="shrink-0 text-error-text" size={24} aria-hidden="true" />
            <p className="text-base text-error-text">{PROFILE_TEXTS.profileFailed}</p>
            <Button
              variant="brand-secondary-small"
              aria-label={PROFILE_TEXTS.retryProfile}
              onPress={() => retryPressed()}
            >
              {PROFILE_TEXTS.retry}
            </Button>
          </div>
        )}

        {status === "ready" && profile && (
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between md:gap-8">
            <div className="flex min-w-0 flex-col gap-3 md:gap-4">
              <div className="flex min-w-0 items-center gap-2">
                <h1
                  className="truncate font-heading text-mobile-heading-1 font-extrabold md:text-heading-1"
                  title={profile.username}
                >
                  {profile.username}
                </h1>
                <AriaButton
                  aria-label={PROFILE_TEXTS.editName}
                  onPress={() => showComingSoon()}
                  className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center text-link outline-link hover:opacity-70 data-[focus-visible]:outline-2"
                >
                  <Pencil className="size-6 md:size-7" strokeWidth={1.75} aria-hidden="true" />
                </AriaButton>
              </div>
              <p className="flex flex-col gap-1 text-sm leading-normal text-muted md:flex-row md:gap-0">
                <span>
                  {PROFILE_TEXTS.registeredAt}: {formatDate(profile.registered_at)}
                </span>
                <span aria-hidden="true" className="hidden md:inline">
                  &nbsp;·&nbsp;
                </span>
                <span>
                  {PROFILE_TEXTS.birthYear}: {profile.birth_year}
                </span>
              </p>
            </div>
            <ProfileStats stats={profile.stats} />
          </div>
        )}
      </div>
    </section>
  );
};
