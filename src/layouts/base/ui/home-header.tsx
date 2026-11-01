import { Link } from "@effector/router-react";
import { useUnit } from "effector-react";
import { Menu as MenuIcon } from "lucide-react";
import { Button, Menu, MenuItem, MenuTrigger, Popover } from "react-aria-components";

import { $$session } from "@/entities/session";

import { cn } from "@/shared/lib/cn";
import { routes } from "@/shared/routes";

import { BrandLogo } from "./brand-logo";
import { UserMenu, userMenuItemStyle, userMenuPopoverStyle, userMenuTriggerStyle } from "./user-menu";

export const HomeHeader = ({
  showGuestActions = true,
  loginPage = false,
}: {
  showGuestActions?: boolean;
  loginPage?: boolean;
}) => {
  const { status, openRegister, openLogin } = useUnit({
    status: $$session.outputs.$status,
    openRegister: routes.register.open,
    openLogin: $$session.inputs.loginPressed,
  });

  return (
    <header
      className={cn(
        "relative z-20 h-14 bg-header text-on-dark md:h-[72px] md:px-12",
        loginPage ? "px-2.5 md:border-b md:border-on-dark/40" : "border-b border-on-dark/40 px-4",
      )}
    >
      <nav
        aria-label="Главная навигация"
        className="mx-auto flex h-full w-full max-w-results items-center justify-between gap-4"
      >
        <Link to={routes.home} aria-label="DejaView — главная" className="shrink-0 outline-link">
          <BrandLogo />
        </Link>
        {showGuestActions && status === "guest" && (
          <div className="flex items-center gap-4 md:gap-5">
            <Button
              onPress={() => openLogin()}
              className="flex min-h-11 items-center font-label text-[15px] leading-none font-semibold tracking-widest uppercase outline-link hover:text-brand-gold"
            >
              Войти
            </Button>
            <Link
              to={routes.register}
              className="hidden h-12 items-center border-2 border-brand-gold px-6 font-label text-[15px] leading-none font-semibold tracking-widest text-brand-gold uppercase outline-link hover:bg-brand-brown md:inline-flex"
            >
              Зарегистрироваться
            </Link>
            <div className="md:hidden">
              <MenuTrigger>
                <Button
                  aria-label="Открыть меню"
                  className={`${userMenuTriggerStyle} justify-center min-w-11 hover:text-brand-gold`}
                >
                  <MenuIcon size={24} strokeWidth={1.75} aria-hidden="true" />
                </Button>
                <Popover placement="bottom end" offset={4} className={userMenuPopoverStyle}>
                  <Menu aria-label="Меню" className="outline-none">
                    <MenuItem className={userMenuItemStyle} onAction={() => openRegister()}>
                      Зарегистрироваться
                    </MenuItem>
                  </Menu>
                </Popover>
              </MenuTrigger>
            </div>
          </div>
        )}
        {status === "authenticated" && <UserMenu className="hover:text-brand-gold" />}
      </nav>
    </header>
  );
};
