import { useUnit } from "effector-react";
import { ChevronDown, LogOut, User } from "lucide-react";
import { Button, Menu, MenuItem, MenuTrigger, Popover } from "react-aria-components";

import { $$session } from "@/entities/session";

import { cn } from "@/shared/lib/cn";
import { routes } from "@/shared/routes";

export const userMenuItemStyle =
  "flex min-h-11 cursor-pointer items-center gap-2 p-2 font-label text-sm font-semibold uppercase tracking-widest outline-none data-[focused]:bg-header data-[focused]:text-on-dark";

export const userMenuTriggerStyle = "inline-flex min-h-11 cursor-pointer items-center gap-2 outline-link";

export const userMenuPopoverStyle =
  "z-50 border-2 border-border-strong bg-card p-3.5 font-body text-ink shadow-hard-lg";

export const UserMenu = ({ className }: { className?: string }) => {
  const { user, isSigningOut, signOut, openProfile } = useUnit({
    user: $$session.outputs.$user,
    isSigningOut: $$session.outputs.$isSigningOut,
    signOut: $$session.inputs.signedOut,
    openProfile: routes.profile.open,
  });

  const username = user?.username ?? "Пользователь";
  const initials = username.slice(0, 2).toUpperCase();

  return (
    <MenuTrigger>
      <Button
        aria-label={`Меню пользователя ${username}`}
        aria-busy={isSigningOut}
        isDisabled={isSigningOut}
        className={cn(userMenuTriggerStyle, "group min-w-0 disabled:cursor-wait disabled:opacity-60", className)}
      >
        <span
          aria-hidden="true"
          className="flex size-[35px] shrink-0 items-center justify-center rounded-full bg-brand-gold font-label text-[15px] leading-none font-semibold tracking-widest text-ink md:size-10"
        >
          {initials}
        </span>
        <span className="max-w-24 truncate font-body text-sm font-normal md:max-w-48 md:text-base">
          {isSigningOut ? "Выходим…" : username}
        </span>
        <ChevronDown
          size={18}
          strokeWidth={1.75}
          className="shrink-0 group-data-[pressed]:rotate-180"
          aria-hidden="true"
        />
      </Button>
      <Popover placement="bottom end" offset={4} className={`${userMenuPopoverStyle} min-w-[146px]`}>
        <Menu aria-label="Меню пользователя" className="flex flex-col gap-2 outline-none">
          <MenuItem className={userMenuItemStyle} onAction={() => openProfile()}>
            <User size={24} strokeWidth={1.75} aria-hidden="true" /> Профиль
          </MenuItem>
          <MenuItem className={userMenuItemStyle} onAction={() => signOut()}>
            <LogOut size={24} strokeWidth={1.75} aria-hidden="true" /> Выйти
          </MenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
  );
};
