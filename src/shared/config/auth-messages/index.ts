export const RESEND_CONFIRMATION_AFTER_SECONDS = 60;

export const INTERNAL_ERROR_MESSAGE = "Произошла ошибка. Попробуйте позже";

export const CONFIRMATION_MESSAGES = {
  sent: (email: string) =>
    `На адрес ${email} отправлено письмо. Перейдите по ссылке в письме для завершения регистрации`,
  sentWithoutEmail: "Письмо отправлено. Перейдите по ссылке в письме для завершения регистрации",
  resend: "Отправить повторно",
  confirmed: "Email подтверждён. Добро пожаловать в DejaView!",
  linkExpired: "Срок действия ссылки истёк",
  sendNewLink: "Отправить новую ссылку",
} as const;

export const LOGIN_MESSAGES = {
  loginRequired: "Введите имя пользователя или email",
  loginInvalid: "Введите корректные имя пользователя или email",
  passwordRequired: "Введите пароль",
  invalidUsernameCredentials: "Неверные имя пользователя или пароль",
  invalidEmailCredentials: "Неверные email или пароль",
  emailNotConfirmed: "Email не подтверждён. Проверьте почту или запросите новую ссылку",
  sendNewLink: CONFIRMATION_MESSAGES.sendNewLink,
  accountBlocked: "Ваша учётная запись заблокирована. Обратитесь в службу поддержки",
  locked: (minutes: number) => `Слишком много попыток входа. Повторите через ${minutes} минут`,
  captchaRequired: "Подтвердите, что вы не робот",
  captchaInvalid: "Проверка не пройдена. Попробуйте ещё раз",
  forgotPassword: "Забыли пароль?",
} as const;

export const PASSWORD_MESSAGES = {
  newPasswordRequired: "Введите новый пароль",
  tooShort: "Пароль должен содержать не менее 8 символов",
  tooLong: "Пароль должен содержать не более 128 символов",
  composition:
    "Пароль должен содержать хотя бы одну заглавную букву, одну строчную букву, одну цифру и один специальный символ",
  allRulesPassed: "Все требования к паролю выполнены",
  mismatch: "Пароли не совпадают",
  sameAsCurrent: "Новый пароль должен отличаться от текущего",
  changed: "Пароль успешно изменён",
} as const;

export const PASSWORD_CHECKLIST_LABEL = "Требования к паролю";

export const PASSWORD_RULE_LABELS = {
  length: "От 8 до 128 символов",
  letters: "Заглавная и строчная латинская буква",
  digit: "Хотя бы одна цифра",
  special: "Хотя бы один спецсимвол: ! @ # $ % и др.",
} as const;

export const OIDC_MESSAGES = {
  accountExists: ({ email, provider }: { email: string; provider: string }) =>
    `Учётная запись с email ${email} уже существует. Войдите с паролем, чтобы привязать ${provider}`,
  signInFailed: (provider: string) =>
    `Не удалось выполнить вход через ${provider}. Попробуйте снова или используйте другой способ`,
} as const;
