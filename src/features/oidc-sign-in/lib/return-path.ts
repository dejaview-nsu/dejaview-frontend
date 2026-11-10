export type OidcOrigin = "login" | "register";

const RETURN_PATH_KEY = "dejaview:oidc-return-path";
const ORIGIN_KEY = "dejaview:oidc-origin";

const save = (key: string, value: string) => {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    return;
  }
};

const take = (key: string): string | null => {
  try {
    const value = sessionStorage.getItem(key);

    sessionStorage.removeItem(key);

    return value;
  } catch {
    return null;
  }
};

export const saveOidcReturnPath = (path: string) => save(RETURN_PATH_KEY, path);

export const takeOidcReturnPath = (): string | null => take(RETURN_PATH_KEY);

export const saveOidcOrigin = (origin: OidcOrigin) => save(ORIGIN_KEY, origin);

export const takeOidcOrigin = (): OidcOrigin => (take(ORIGIN_KEY) === "login" ? "login" : "register");
