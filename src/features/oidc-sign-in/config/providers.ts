import { API_BASE_URL, type AuthOidcProvider } from "@/shared/api";

export const OIDC_PROVIDERS: { id: AuthOidcProvider; name: string }[] = [
  { id: "google", name: "Google" },
  { id: "yandex", name: "Яндекс" },
  { id: "vk", name: "VK" },
];

export const getOidcProviderName = (provider: unknown): string | null =>
  OIDC_PROVIDERS.find(({ id }) => id === provider)?.name ?? null;

export const getOidcStartUrl = (provider: AuthOidcProvider) => `${API_BASE_URL}/auth/oidc/${provider}/start`;
