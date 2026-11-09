import { describe, expect, it } from "vitest";

import {
  announcePasswordRules,
  checkPasswordRules,
  countPasswordLength,
  describePasswordViolations,
  NEW_PASSWORD_RULES,
  validateNewPassword,
  validatePasswordConfirmation,
} from "@/shared/lib/password";

const TOO_SHORT = "Пароль должен содержать не менее 8 символов";
const TOO_LONG = "Пароль должен содержать не более 128 символов";
const COMPOSITION =
  "Пароль должен содержать хотя бы одну заглавную букву, одну строчную букву, одну цифру и один специальный символ";

const withLength = (length: number) => `Aa1!${"x".repeat(length - 4)}`;

const states = (value: string, showFailures = true) =>
  Object.fromEntries(
    checkPasswordRules(NEW_PASSWORD_RULES, value, { showFailures }).map(({ id, state }) => [id, state]),
  );

describe("password length", () => {
  it.each([
    [7, false],
    [8, true],
    [128, true],
    [129, false],
  ])("%i characters: valid %s", (length, valid) => {
    expect(validateNewPassword(withLength(length))).toEqual(valid ? null : { message: null });
    expect(states(withLength(length)).length).toBe(valid ? "passed" : "failed");
  });

  it("7 characters are reported as too short, 129 as too long", () => {
    expect(describePasswordViolations(withLength(7))).toEqual([TOO_SHORT]);
    expect(describePasswordViolations(withLength(129))).toEqual([TOO_LONG]);
  });

  it("counts code points like the backend: an emoji is one character", () => {
    expect(countPasswordLength("😀")).toBe(1);
    expect(validateNewPassword("Aa1!😀😀😀")).toEqual({ message: null });
    expect(validateNewPassword("Aa1!😀😀😀😀")).toBeNull();
    expect(validateNewPassword(`Aa1!${"😀".repeat(124)}`)).toBeNull();
    expect(validateNewPassword(`Aa1!${"😀".repeat(125)}`)).toEqual({ message: null });
  });

  it("Cyrillic letters count towards the length", () => {
    expect(validateNewPassword("Aa1!жжжж")).toBeNull();
  });
});

describe("password composition", () => {
  it.each([
    ["no uppercase", "aa1!aaaa", "letters"],
    ["no lowercase", "AA1!AAAA", "letters"],
    ["no digit", "Aa!aaaaa", "digit"],
    ["no special character", "Aa1aaaaa", "special"],
  ])("%s fails its rule and gives the composition message", (_, value, rule) => {
    expect(states(value)[rule]).toBe("failed");
    expect(describePasswordViolations(value)).toEqual([COMPOSITION]);
    expect(validateNewPassword(value)).toEqual({ message: null });
  });

  it.each(["Ж", "ё", " ", "\t"])("%j is not a latin letter or a special character", (character) => {
    expect(states(`Aa1aaaa${character}`).special).toBe("failed");
  });

  it("Cyrillic capitals and lowercase do not replace latin letters", () => {
    expect(states("ЖЖжж1!aa").letters).toBe("failed");
  });

  it.each(["!", "@", "#", "$", "%", "-", "_", "«", "№", "😀"])("%j is a special character", (character) => {
    expect(states(`Aa1aaaa${character}`).special).toBe("passed");
  });
});

describe("checklist states", () => {
  it("every item is neutral before input", () => {
    expect(states("")).toEqual({ length: "neutral", letters: "neutral", digit: "neutral", special: "neutral" });
  });

  it("met items are green while typing, unmet stay neutral until failures are shown", () => {
    expect(states("Aa", false)).toEqual({ length: "neutral", letters: "passed", digit: "neutral", special: "neutral" });
    expect(states("Aa", true)).toEqual({ length: "failed", letters: "passed", digit: "failed", special: "failed" });
  });

  it("uses the mockup labels in order", () => {
    expect(NEW_PASSWORD_RULES.map(({ label }) => label)).toEqual([
      "От 8 до 128 символов",
      "Заглавная и строчная латинская буква",
      "Хотя бы одна цифра",
      "Хотя бы один спецсимвол: ! @ # $ % и др.",
    ]);
  });
});

describe("password messages", () => {
  it("an empty password asks for a new password under the field", () => {
    expect(validateNewPassword("")).toEqual({ message: "Введите новый пароль" });
  });

  it("the confirmation must match", () => {
    expect(validatePasswordConfirmation("Kino#2026", "Kino#2026")).toBeNull();
    expect(validatePasswordConfirmation("Kino#2027", "Kino#2026")).toEqual({ message: "Пароли не совпадают" });
  });

  it("announcements use the texts of the requirements", () => {
    expect(announcePasswordRules("")).toBe("Введите новый пароль");
    expect(announcePasswordRules("abc")).toBe(`${TOO_SHORT}. ${COMPOSITION}`);
    expect(announcePasswordRules("Kino#2026")).toBe("Все требования к паролю выполнены");
  });
});
