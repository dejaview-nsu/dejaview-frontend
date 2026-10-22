import { describe, expect, it } from "vitest";

import { checkPassword, passwordRules, validatePassword } from "@/features/register";

import { zAuthPassword } from "@/shared/api";

const special = passwordRules.find(({ id }) => id === "special")!;

const specialState = (password: string) => checkPassword(password).find(({ id }) => id === "special")?.state;

describe("special character rule", () => {
  it.each(["А", "Б", "Ж", "Я", "Ё", "а", "б", "ж", "я", "ё", "A", "Z", "a", "z", "0", "9"])(
    "letter or digit %j is not a special character",
    (character) => {
      expect(special.test(`Kino2026${character}`)).toBe(false);
    },
  );

  it.each([" ", "\t", " "])("whitespace %j is not a special character", (character) => {
    expect(special.test(`Kino2026${character}`)).toBe(false);
  });

  it.each(["!", "@", "#", "$", "%", "^", "&", "*", "-", "_", ".", ",", "?", "(", ")", "+", "=", "/", "~"])(
    "ASCII sign %j is a special character",
    (character) => {
      expect(special.test(`Kino2026${character}`)).toBe(true);
    },
  );

  it.each(["«", "»", "—", "№", "…", ";", ":", '"', "'"])("punctuation %j is a special character", (character) => {
    expect(special.test(`Kino2026${character}`)).toBe(true);
  });

  it("the checklist item follows the same rule", () => {
    expect(specialState("Kinoжё")).toBe("failed");
    expect(specialState("Kino Ё")).toBe("failed");
    expect(specialState("Kino!")).toBe("passed");
  });
});

describe("password validation with the special character rule", () => {
  it("«Abcdefg1» without a special character is rejected", () => {
    expect(validatePassword("Abcdefg1")).toEqual({ message: null });
  });

  it("«Abcdefgа1» with a Cyrillic letter is rejected", () => {
    expect(validatePassword("Abcdefgа1")).toEqual({ message: null });
  });

  it("«Abcdefg 1» with a space is rejected", () => {
    expect(validatePassword("Abcdefg 1")).toEqual({ message: null });
  });

  it("«Abcdefg1!» is accepted", () => {
    expect(validatePassword("Abcdefg1!")).toBeNull();
  });

  it("the contract schema still accepts a Cyrillic letter or a space as the special character", () => {
    expect(zAuthPassword.safeParse("Abcdefgа1").success).toBe(true);
    expect(zAuthPassword.safeParse("Abcdefg 1").success).toBe(true);
  });
});
