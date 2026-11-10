import { Bookmark, Image, Star, User } from "lucide-react";
import { type ReactNode } from "react";

import { cn } from "@/shared/lib/cn";
import { PosterWall } from "@/shared/ui";

const benefits = [
  { icon: Image, title: "Поиск по кадру, видео, звуку", text: "Не только по описанию сцены" },
  { icon: Bookmark, title: "Списки фильмов", text: "«Хочу посмотреть» и «Просмотрено»" },
  { icon: Star, title: "Оценки и отзывы", text: "Делись мнением о фильмах" },
  { icon: User, title: "Профиль со статистикой", text: "Сколько посмотрел и что любишь" },
];

const AuthHero = ({ withText }: { withText: boolean }) => (
  <div data-testid="auth-hero" className="relative hidden h-72 overflow-hidden bg-header text-on-dark desktop:block">
    <PosterWall />
    {withText && (
      <div className="relative mx-auto max-w-content px-6 pt-12">
        <p className="font-heading text-hero font-extrabold">
          Присоединяйся к <em className="font-semibold text-brand-gold">DejaView</em>
        </p>
        <p className="mt-4 text-base leading-normal">Регистрация займёт минуту — и все возможности сервиса твои</p>
      </div>
    )}
  </div>
);

export const AuthBenefits = () => (
  <ul data-testid="auth-benefits" className="hidden min-w-0 flex-1 flex-col gap-20 pt-42 desktop:flex">
    {benefits.map(({ icon: Icon, title, text }) => (
      <li key={title} className="flex items-start gap-6">
        <span className="flex size-12 shrink-0 items-center justify-center bg-header text-brand-gold">
          <Icon size={24} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <span className="flex flex-col gap-2">
          <span className="font-heading text-card-title font-bold text-ink">{title}</span>
          <span className="text-base text-muted">{text}</span>
        </span>
      </li>
    ))}
  </ul>
);

export const AuthShell = ({
  withBenefits = false,
  hero = "join",
  children,
}: {
  withBenefits?: boolean;
  hero?: "join" | "posters";
  children: ReactNode;
}) => (
  <div data-testid="auth-shell" className="flex-1 bg-card font-body text-ink desktop:bg-transparent">
    <AuthHero withText={hero === "join"} />
    <div
      data-testid="auth-content"
      className={cn(
        "relative mx-auto w-full px-4 pb-16 desktop:pt-0 desktop:pb-24",
        hero === "posters" ? "max-w-148 pt-16 desktop:-mt-40" : "max-w-xl pt-10",
        withBenefits && "desktop:-mt-32 desktop:flex desktop:max-w-content desktop:gap-16 desktop:px-6",
        !withBenefits && hero === "join" && "desktop:-mt-24",
      )}
    >
      {withBenefits && <AuthBenefits />}
      <div data-testid="auth-card" className={cn("w-full", withBenefits && "desktop:w-109 desktop:shrink-0")}>
        {children}
      </div>
    </div>
  </div>
);
