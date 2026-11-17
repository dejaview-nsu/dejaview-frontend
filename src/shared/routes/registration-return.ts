import { type QueryValue } from "@effector/router";

import { parseReturnPath } from "./login-redirect";

const REGISTRATION_RETURN_KEY = "dejaview:registration-return-path";
const RETURN_LIFETIME = 24 * 60 * 60 * 1000;

export const saveRegistrationReturnPath = (value: QueryValue | undefined) => {
  try {
    if (typeof value !== "string" || parseReturnPath(value).path === "/") {
      sessionStorage.removeItem(REGISTRATION_RETURN_KEY);

      return;
    }

    sessionStorage.setItem(
      REGISTRATION_RETURN_KEY,
      JSON.stringify({ path: value, expiresAt: Date.now() + RETURN_LIFETIME }),
    );
  } catch {
    return;
  }
};

export const takeRegistrationReturnPath = (): string | null => {
  try {
    const raw = sessionStorage.getItem(REGISTRATION_RETURN_KEY);

    sessionStorage.removeItem(REGISTRATION_RETURN_KEY);

    const value = JSON.parse(raw ?? "null") as unknown;

    if (typeof value !== "object" || value === null) return null;

    const record = value as { path?: unknown; expiresAt?: unknown };

    if (
      typeof record.path === "string" &&
      parseReturnPath(record.path).path !== "/" &&
      typeof record.expiresAt === "number" &&
      record.expiresAt > Date.now() &&
      record.expiresAt <= Date.now() + RETURN_LIFETIME
    ) {
      return record.path;
    }
  } catch {
    return null;
  }

  return null;
};
