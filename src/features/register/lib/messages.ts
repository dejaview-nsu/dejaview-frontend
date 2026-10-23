export const REGISTER_MESSAGES = {
  usernameRequired: "Введите имя пользователя",
  usernameTooShort: "Введите не менее 3 символов",
  usernameTooLong: "Имя пользователя должно содержать не более 30 символов",
  usernameInvalid: "Имя пользователя может содержать только латинские буквы, цифры и нижнее подчёркивание",
  emailRequired: "Введите email",
  emailInvalid: "Введите корректный email",
  birthYearRequired: "Укажите год рождения",
  birthYearFormat: "Введите год рождения в формате YYYY",
  birthYearTooEarly: "Введите корректный год рождения",
  birthYearInFuture: "Год рождения не может быть больше текущего года",
  passwordRequired: "Введите пароль",
  passwordMismatch: "Пароли не совпадают",
} as const;

export const REGISTER_SERVER_MESSAGES: Partial<Record<string, string>> = {
  AUTH_EMAIL_TAKEN: "Пользователь с таким email уже существует",
  AUTH_USERNAME_TAKEN: "Это имя пользователя уже занято",
  INTERNAL_ERROR: "Произошла ошибка. Попробуйте позже",
};
