import { PASSWORD_MESSAGES, PASSWORD_RULE_LABELS } from "../../config/auth-messages";

export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_MAX_LENGTH = 128;

export type PasswordRuleState = "neutral" | "passed" | "failed";

export type PasswordRule = { id: string; label: string; test: (value: string) => boolean };

export type PasswordCheck = { id: string; label: string; state: PasswordRuleState };

export type PasswordFieldError = { message: string | null };

export const countPasswordLength = (value: string) => Array.from(value).length;

const hasUppercase = (value: string) => /[A-Z]/.test(value);

const hasLowercase = (value: string) => /[a-z]/.test(value);

export const passwordTests = {
  length: (value: string) => {
    const length = countPasswordLength(value);

    return length >= PASSWORD_MIN_LENGTH && length <= PASSWORD_MAX_LENGTH;
  },
  uppercase: hasUppercase,
  lowercase: hasLowercase,
  letters: (value: string) => hasUppercase(value) && hasLowercase(value),
  digit: (value: string) => /[0-9]/.test(value),
  special: (value: string) => /[^\p{L}\p{N}\s]/u.test(value),
};

export const NEW_PASSWORD_RULES: PasswordRule[] = [
  { id: "length", label: PASSWORD_RULE_LABELS.length, test: passwordTests.length },
  { id: "letters", label: PASSWORD_RULE_LABELS.letters, test: passwordTests.letters },
  { id: "digit", label: PASSWORD_RULE_LABELS.digit, test: passwordTests.digit },
  { id: "special", label: PASSWORD_RULE_LABELS.special, test: passwordTests.special },
];

export const checkPasswordRules = (
  rules: readonly PasswordRule[],
  value: string,
  { showFailures }: { showFailures: boolean },
): PasswordCheck[] =>
  rules.map(({ id, label, test }) => ({
    id,
    label,
    state: value.length === 0 ? "neutral" : test(value) ? "passed" : showFailures ? "failed" : "neutral",
  }));

export const describePasswordViolations = (value: string): string[] => {
  const length = countPasswordLength(value);
  const composed = passwordTests.letters(value) && passwordTests.digit(value) && passwordTests.special(value);

  return [
    length < PASSWORD_MIN_LENGTH ? PASSWORD_MESSAGES.tooShort : null,
    length > PASSWORD_MAX_LENGTH ? PASSWORD_MESSAGES.tooLong : null,
    composed ? null : PASSWORD_MESSAGES.composition,
  ].filter((message) => message !== null);
};

export const validateNewPassword = (value: string): PasswordFieldError | null => {
  if (value.length === 0) return { message: PASSWORD_MESSAGES.newPasswordRequired };

  return describePasswordViolations(value).length > 0 ? { message: null } : null;
};

export const validatePasswordConfirmation = (value: string, password: string): PasswordFieldError | null =>
  value === password ? null : { message: PASSWORD_MESSAGES.mismatch };

export const announcePasswordRules = (value: string): string => {
  if (value.length === 0) return PASSWORD_MESSAGES.newPasswordRequired;

  const violations = describePasswordViolations(value);

  return violations.length > 0 ? violations.join(". ") : PASSWORD_MESSAGES.allRulesPassed;
};
