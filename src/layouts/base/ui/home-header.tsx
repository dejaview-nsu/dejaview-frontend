import { Link } from "@effector/router-react";
import { useUnit } from "effector-react";
import { ChevronDown, LogOut, Menu as MenuIcon, User } from "lucide-react";
import { Button, Menu, MenuItem, MenuTrigger, Popover } from "react-aria-components";

import { $$session } from "@/entities/session";

import { routes } from "@/shared/routes";

import { BrandLogo } from "./brand-logo";

const menuItemStyle =
  "flex min-h-11 cursor-pointer items-center gap-2 p-2 font-label text-sm font-semibold uppercase tracking-widest outline-none data-[focused]:bg-header data-[focused]:text-on-dark";
const triggerStyle = "inline-flex min-h-11 cursor-pointer items-center gap-2 outline-link hover:text-brand-gold";
const popoverStyle = "z-50 border-2 border-border-strong bg-card p-3.5 font-body text-ink shadow-hard-lg";

export const HomeHeader = () => {
  const { status, user, signOut, openProfile, openRegister } = useUnit({
    status: $$session.outputs.$status,
    user: $$session.outputs.$user,
    signOut: $$session.inputs.signedOut,
    openProfile: routes.profile.open,
    openRegister: routes.register.open,
  });

  const username = user?.username ?? "Пользователь";
  const initials = username.slice(0, 2).toUpperCase();

  return (
    <header className="relative z-20 h-14 border-b border-on-dark/40 bg-header px-4 text-on-dark md:h-[72px] md:px-12">
      <nav
        aria-label="Главная навигация"
        className="mx-auto flex h-full w-full max-w-results items-center justify-between gap-4"
      >
        <Link to={routes.home} aria-label="DejaView — главная" className="shrink-0 outline-link">
          <BrandLogo />
        </Link>
        {status === "guest" && (
          <div className="flex items-center gap-4 md:gap-5">
            <Link
              to={routes.login}
              className="flex min-h-11 items-center font-label text-[15px] leading-none font-semibold tracking-widest uppercase outline-link hover:text-brand-gold"
            >
              Войти
            </Link>
            <Link
              to={routes.register}
              className="hidden h-12 items-center border-2 border-brand-gold px-6 font-label text-[15px] leading-none font-semibold tracking-widest text-brand-gold uppercase outline-link hover:bg-brand-brown md:inline-flex"
            >
              Зарегистрироваться
            </Link>
            <div className="md:hidden">
              <MenuTrigger>
                <Button aria-label="Открыть меню" className={`${triggerStyle} justify-center min-w-11`}>
                  <MenuIcon size={24} strokeWidth={1.75} aria-hidden="true" />
                </Button>
                <Popover placement="bottom end" offset={4} className={popoverStyle}>
                  <Menu aria-label="Меню" className="outline-none">
                    <MenuItem className={menuItemStyle} onAction={() => openRegister()}>
                      Зарегистрироваться
                    </MenuItem>
                  </Menu>
                </Popover>
              </MenuTrigger>
            </div>
          </div>
        )}
        {status === "authenticated" && (
          <MenuTrigger>
            <Button aria-label={`Меню пользователя ${username}`} className={`${triggerStyle} group min-w-0`}>
              <span
                aria-hidden="true"
                className="flex size-[35px] shrink-0 items-center justify-center rounded-full bg-brand-gold font-label text-[15px] leading-none font-semibold tracking-widest text-ink md:size-10"
              >
                {initials}
              </span>
              <span className="max-w-24 truncate font-body text-sm font-normal md:max-w-48 md:text-base">
                {username}
              </span>
              <ChevronDown
                size={18}
                strokeWidth={1.75}
                className="shrink-0 group-data-[pressed]:rotate-180"
                aria-hidden="true"
              />
            </Button>
            <Popover placement="bottom end" offset={4} className={`${popoverStyle} min-w-[146px]`}>
              <Menu aria-label="Меню пользователя" className="flex flex-col gap-2 outline-none">
                <MenuItem className={menuItemStyle} onAction={() => openProfile()}>
                  <User size={24} strokeWidth={1.75} aria-hidden="true" /> Профиль
                </MenuItem>
                <MenuItem className={menuItemStyle} onAction={() => signOut()}>
                  <LogOut size={24} strokeWidth={1.75} aria-hidden="true" /> Выйти
                </MenuItem>
              </Menu>
            </Popover>
          </MenuTrigger>
        )}
      </nav>
    </header>
  );
};
