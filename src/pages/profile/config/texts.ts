import { type ListTypePath } from "@/shared/api";
import { INTERNAL_ERROR_MESSAGE } from "@/shared/config/auth-messages";

import { type ProfileTab } from "../lib/tab";

export const PROFILE_TEXTS = {
  loadingProfile: "Загружаем профиль",
  profileFailed: INTERNAL_ERROR_MESSAGE,
  retry: "Повторить",
  retryProfile: "Повторить загрузку профиля",
  avatarAlt: (username: string) => `Фото профиля ${username}`,
  registeredAt: "Дата регистрации",
  birthYear: "Год рождения",
  statsLabel: "Статистика",
  stats: {
    watched: "Просмотрено",
    ratings: "Оценок",
    averageRating: "Средняя оценка",
    reviews: "Отзывов",
  },
  noRatings: "Оценок пока нет",
  tabsLabel: "Разделы профиля",
  tabs: {
    want_to_watch: "Хочу посмотреть",
    watched: "Просмотрено",
    ratings: "Мои оценки",
    reviews: "Мои отзывы",
    security: "Безопасность",
  } satisfies Record<ProfileTab, string>,
  loadingList: "Загружаем список",
  listFailed: INTERNAL_ERROR_MESSAGE,
  retryList: "Повторить загрузку списка",
  emptyTitle: "Список пуст",
  emptyHint: {
    want_to_watch: "Добавляй фильмы кнопкой «Хочу посмотреть» на странице фильма",
    watched: "Добавляй фильмы кнопкой «Просмотрено» на странице фильма",
  } satisfies Record<ListTypePath, string>,
  findMovie: "Найти фильм",
  remove: "Удалить",
  removeLabel: (title: string) => `Удалить «${title}» из списка`,
  removeFailed: INTERNAL_ERROR_MESSAGE,
  comingSoonTitle: "Скоро будет готово",
  comingSoonHint: {
    ratings: "Оценки появятся в следующем обновлении",
    reviews: "Отзывы появятся в следующем обновлении",
  },
  comingSoon: "Скоро будет готово",
  securityTitle: "Безопасность",
  editName: "Изменить имя",
  changePhoto: "Изменить фото",
  deletePhoto: "Удалить фото",
  signOut: "Выйти из профиля",
  deleteProfile: "Удалить профиль",
  signOutDialog: {
    title: "Выход из профиля",
    text: "Вы уверены, что хотите выйти из профиля?",
    cancel: "Нет",
    confirm: "Да, выйти",
    close: "Закрыть окно выхода",
    failed: INTERNAL_ERROR_MESSAGE,
  },
} as const;
