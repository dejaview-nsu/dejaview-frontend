const RETURN_PATH_KEY = "dejaview:oidc-return-path";

export const saveOidcReturnPath = (path: string) => {
  try {
    sessionStorage.setItem(RETURN_PATH_KEY, path);
  } catch {
    return;
  }
};

export const takeOidcReturnPath = (): string | null => {
  try {
    const path = sessionStorage.getItem(RETURN_PATH_KEY);

    sessionStorage.removeItem(RETURN_PATH_KEY);

    return path;
  } catch {
    return null;
  }
};
