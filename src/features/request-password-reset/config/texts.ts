export const RESEND_AFTER_SECONDS = 60;

export const REQUEST_PASSWORD_RESET_TEXTS = {
  title: "Восстановление пароля",
  subtitle: "Укажи имя пользователя или email — пришлём ссылку для смены пароля",
  formLabel: "Восстановление пароля",
  loginLabel: "Имя пользователя или Email",
  loginPlaceholder: "anna_k или anna@mail.ru",
  submit: "Восстановить пароль",
  submitting: "Отправляем…",
  backToLogin: "Вернуться ко входу",
  sentTitle: "Проверь почту",
  sentHintBefore: "Открой письмо от ",
  sentHintBrand: "DejaView",
  sentHintAfter: " и перейди по ссылке в нём, чтобы задать новый пароль",
  sent: "Если учётная запись с таким email существует, мы отправили ссылку для восстановления пароля. Проверьте почту",
  sentNote: "Ссылка действует 1 час. Если запросишь ещё раз, предыдущая ссылка перестанет работать",
  resend: "Запросить ссылку ещё раз",
  resendCountdown: (countdown: string) => `Можно запросить ещё раз через ${countdown}`,
} as const;
