import { describe, expect, it } from "vitest";

import {
  checkPassword,
  emptyRegisterValues,
  findFirstInvalidField,
  getRegisterServerMessage,
  passwordRules,
  toRegisterField,
  toRegisterRequest,
  validateBirthYear,
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
  validateRegisterForm,
  validateUsername,
} from "@/features/register";

import { ApiError } from "@/shared/api";
import {
  CONFIRMATION_MESSAGES,
  LOGIN_MESSAGES,
  OIDC_MESSAGES,
  RESEND_CONFIRMATION_AFTER_SECONDS,
} from "@/shared/config/auth-messages";

const message = (error: { message: string | null } | null) => error?.message;

const rule = (id: string) => passwordRules.find((item) => item.id === id)!;

const ruleState = (password: string, id: string) => checkPassword(password).find((item) => item.id === id)?.state;

describe("username", () => {
  it.each([
    ["", "Введите имя пользователя"],
    ["a", "Введите не менее 3 символов"],
    ["an", "Введите не менее 3 символов"],
    ["a!", "Введите не менее 3 символов"],
    ["a".repeat(31), "Имя пользователя должно содержать не более 30 символов"],
    ["anna k", "Имя пользователя может содержать только латинские буквы, цифры и нижнее подчёркивание"],
    ["анна", "Имя пользователя может содержать только латинские буквы, цифры и нижнее подчёркивание"],
    ["anna-k", "Имя пользователя может содержать только латинские буквы, цифры и нижнее подчёркивание"],
  ])("%j shows the first matching message", (value, expected) => {
    expect(message(validateUsername(value))).toBe(expected);
  });

  it.each(["ann", "anna_k", "Movie_Fan_42", "a".repeat(30)])("%j is accepted", (value) => {
    expect(validateUsername(value)).toBeNull();
  });
});

describe("email", () => {
  it.each([
    ["", "Введите email"],
    ["   ", "Введите email"],
    ["ann@mail", "Введите корректный email"],
    ["anna.mail.ru", "Введите корректный email"],
    [`anna@${["b", "c", "d", "e"].map((char) => char.repeat(61)).join(".")}.ru`, "Введите корректный email"],
  ])("%j shows the first matching message", (value, expected) => {
    expect(message(validateEmail(value))).toBe(expected);
  });

  it("valid email is accepted", () => {
    expect(validateEmail("anna@mail.ru")).toBeNull();
  });
});

describe("birth year", () => {
  it.each([
    ["", "Укажите год рождения"],
    ["19a0", "Введите год рождения в формате YYYY"],
    ["203", "Введите год рождения в формате YYYY"],
    ["20030", "Введите год рождения в формате YYYY"],
    ["1899", "Введите корректный год рождения"],
    ["0999", "Введите корректный год рождения"],
    ["2027", "Год рождения не может быть больше текущего года"],
  ])("%j shows the first matching message", (value, expected) => {
    expect(message(validateBirthYear(value, 2026))).toBe(expected);
  });

  it.each(["1900", "2003", "2026"])("%j is accepted", (value) => {
    expect(validateBirthYear(value, 2026)).toBeNull();
  });
});

describe("password rules", () => {
  it("length rule accepts 8 to 128 characters", () => {
    expect(rule("length").test("a".repeat(7))).toBe(false);
    expect(rule("length").test("a".repeat(8))).toBe(true);
    expect(rule("length").test("a".repeat(128))).toBe(true);
    expect(rule("length").test("a".repeat(129))).toBe(false);
  });

  it.each(["A", "B", "M", "Q", "Z"])("uppercase rule passes for %j", (letter) => {
    expect(rule("uppercase").test(`kino#2026${letter}`)).toBe(true);
  });

  it.each(["А", "Б", "Ж", "Я", "Ё", "a", "z", "1", "#"])("uppercase rule fails for %j", (character) => {
    expect(rule("uppercase").test(`kino#2026${character}`)).toBe(false);
  });

  it.each(["a", "b", "m", "q", "z"])("lowercase rule passes for %j", (letter) => {
    expect(rule("lowercase").test(`KINO#2026${letter}`)).toBe(true);
  });

  it.each(["а", "б", "ж", "я", "ё", "A", "Z", "1", "#"])("lowercase rule fails for %j", (character) => {
    expect(rule("lowercase").test(`KINO#2026${character}`)).toBe(false);
  });

  it.each(["0", "5", "9"])("digit rule passes for %j", (digit) => {
    expect(rule("digit").test(`Kino#${digit}`)).toBe(true);
  });

  it.each(["Kino#kino", "Kino#٣"])("digit rule fails for %j", (value) => {
    expect(rule("digit").test(value)).toBe(false);
  });

  it.each(["!", "@", "#", "$", "%", "_"])("special rule passes for %j", (character) => {
    expect(rule("special").test(`Kino2026${character}`)).toBe(true);
  });

  it("special rule fails for latin letters and digits only", () => {
    expect(rule("special").test("Kino2026")).toBe(false);
  });

  it("repeated checks give the same result", () => {
    const uppercase = rule("uppercase");

    expect([1, 2, 3, 4].map(() => uppercase.test("kinoA"))).toEqual([true, true, true, true]);
    expect([1, 2, 3, 4].map(() => uppercase.test("kino"))).toEqual([false, false, false, false]);
  });
});

describe("password checklist", () => {
  it("is neutral while the password is empty", () => {
    expect(checkPassword("").map(({ state }) => state)).toEqual([
      "neutral",
      "neutral",
      "neutral",
      "neutral",
      "neutral",
    ]);
  });

  it("lists the five rules in order", () => {
    expect(checkPassword("").map(({ label }) => label)).toEqual([
      "Длина от 8 до 128 символов",
      "Заглавная латинская буква",
      "Строчная латинская буква",
      "Хотя бы одна цифра",
      "Хотя бы один спецсимвол: ! @ # $ % и др.",
    ]);
  });

  it.each([
    ["length", "Kino#20", "Kino#2026"],
    ["uppercase", "kino#2026", "Kino#2026"],
    ["lowercase", "KINO#2026", "KINo#2026"],
    ["digit", "Kino#kino", "Kino#kin0"],
    ["special", "Kino2026", "Kino#2026"],
  ])("%s shows a cross for %j and a check for %j", (id, failing, passing) => {
    expect(ruleState(failing, id)).toBe("failed");
    expect(ruleState(passing, id)).toBe("passed");
  });

  it("uppercase check appears with a latin capital and disappears after deleting it", () => {
    expect(ruleState("kino", "uppercase")).toBe("failed");
    expect(ruleState("kinoЖ", "uppercase")).toBe("failed");
    expect(ruleState("kinoЖK", "uppercase")).toBe("passed");
    expect(ruleState("kinoЖ", "uppercase")).toBe("failed");
  });

  it("lowercase check appears with a latin small letter and disappears after deleting it", () => {
    expect(ruleState("KINO", "lowercase")).toBe("failed");
    expect(ruleState("KINOж", "lowercase")).toBe("failed");
    expect(ruleState("KINOжk", "lowercase")).toBe("passed");
    expect(ruleState("KINOж", "lowercase")).toBe("failed");
  });
});

describe("password field", () => {
  it("empty password shows «Введите пароль»", () => {
    expect(validatePassword("")).toEqual({ message: "Введите пароль" });
  });

  it.each([
    ["short", "Ab1#"],
    ["no uppercase", "kino#2026"],
    ["no lowercase", "KINO#2026"],
    ["no digit", "Kino#kino"],
    ["no special character", "Kino2026"],
    ["longer than 128", `Kino#2026${"a".repeat(120)}`],
  ])("%s is invalid without a message", (_name, value) => {
    expect(validatePassword(value)).toEqual({ message: null });
  });

  it("valid password is accepted", () => {
    expect(validatePassword("Kino#2026")).toBeNull();
  });

  it("confirmation must match the password", () => {
    expect(message(validatePasswordConfirmation("Kino#202", "Kino#2026"))).toBe("Пароли не совпадают");
    expect(message(validatePasswordConfirmation("", "Kino#2026"))).toBe("Пароли не совпадают");
    expect(validatePasswordConfirmation("Kino#2026", "Kino#2026")).toBeNull();
  });
});

describe("form", () => {
  it("empty form reports every field and the username comes first", () => {
    const errors = validateRegisterForm(emptyRegisterValues);

    expect(errors).toEqual({
      username: { message: "Введите имя пользователя" },
      email: { message: "Введите email" },
      birthYear: { message: "Укажите год рождения" },
      password: { message: "Введите пароль" },
      passwordConfirmation: null,
    });
    expect(findFirstInvalidField(errors)).toBe("username");
  });

  it("first invalid field follows the form order", () => {
    const errors = validateRegisterForm({
      username: "anna_k",
      email: "anna@mail.ru",
      birthYear: "18",
      password: "Kino",
      passwordConfirmation: "",
    });

    expect(findFirstInvalidField(errors)).toBe("birthYear");
  });

  it("request body uses the contract field names without the confirmation", () => {
    expect(
      toRegisterRequest({
        username: "anna_k",
        email: " anna@mail.ru ",
        birthYear: "2003",
        password: "Kino#2026",
        passwordConfirmation: "Kino#2026",
      }),
    ).toEqual({ username: "anna_k", email: "anna@mail.ru", birth_year: 2003, password: "Kino#2026" });
  });

  it("server fields map to form fields", () => {
    expect(toRegisterField("birth_year")).toBe("birthYear");
    expect(toRegisterField("email")).toBe("email");
    expect(toRegisterField(null)).toBeNull();
    expect(toRegisterField("unknown")).toBeNull();
  });
});

describe("server messages", () => {
  const error = (status: number, code: string, text: string) =>
    new ApiError({ status, code, message: text, field: null });

  it.each([
    [409, "AUTH_EMAIL_TAKEN", "Пользователь с таким email уже существует"],
    [409, "AUTH_USERNAME_TAKEN", "Это имя пользователя уже занято"],
    [500, "INTERNAL_ERROR", "Произошла ошибка. Попробуйте позже"],
  ])("%i %s always shows the table text", (status, code, text) => {
    expect(getRegisterServerMessage(error(status, code, "server text"))).toBe(text);
  });

  it.each([
    [400, "AUTH_VALIDATION_ERROR"],
    [400, "AUTH_BIRTH_YEAR_INVALID"],
    [429, "RATE_LIMITED"],
  ])("%i %s shows the server message", (status, code) => {
    expect(getRegisterServerMessage(error(status, code, "server text"))).toBe("server text");
  });
});

describe("texts for the other parts", () => {
  it("keeps the exact table texts", () => {
    expect(CONFIRMATION_MESSAGES.sent("anna@mail.ru")).toBe(
      "На адрес anna@mail.ru отправлено письмо. Перейдите по ссылке в письме для завершения регистрации",
    );
    expect(CONFIRMATION_MESSAGES.resend).toBe("Отправить повторно");
    expect(RESEND_CONFIRMATION_AFTER_SECONDS).toBe(60);
    expect(CONFIRMATION_MESSAGES.confirmed).toBe("Email подтверждён. Добро пожаловать в DejaView!");
    expect(CONFIRMATION_MESSAGES.linkExpired).toBe("Срок действия ссылки истёк");
    expect(CONFIRMATION_MESSAGES.sendNewLink).toBe("Отправить новую ссылку");
    expect(LOGIN_MESSAGES.emailNotConfirmed).toBe("Email не подтверждён. Проверьте почту или запросите новую ссылку");
    expect(LOGIN_MESSAGES.sendNewLink).toBe("Отправить новую ссылку");
    expect(OIDC_MESSAGES.accountExists({ email: "anna@mail.ru", provider: "Google" })).toBe(
      "Учётная запись с email anna@mail.ru уже существует. Войдите с паролем, чтобы привязать Google",
    );
    expect(OIDC_MESSAGES.signInFailed("Яндекс")).toBe(
      "Не удалось выполнить вход через Яндекс. Попробуйте снова или используйте другой способ",
    );
  });
});
