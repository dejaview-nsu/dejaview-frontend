export type MockStorage = {
  get: (key: string) => string | null;
  set: (key: string, value: string) => void;
  remove: (key: string) => void;
};

export const MOCK_STORAGE_KEYS = {
  session: "dejaview:mocks:session",
  searchScenario: "dejaview:mocks:search",
} as const;

export const createMockStorage = (resolveStorage: () => Storage | null | undefined): MockStorage => {
  const memory = new Map<string, string>();

  const attempt = (action: (storage: Storage) => void): boolean => {
    try {
      const storage = resolveStorage();

      if (!storage) {
        return false;
      }

      action(storage);

      return true;
    } catch {
      return false;
    }
  };

  return {
    get: (key) => {
      let value: string | null = null;

      return attempt((storage) => (value = storage.getItem(key))) ? value : (memory.get(key) ?? null);
    },
    set: (key, value) => {
      if (!attempt((storage) => storage.setItem(key, value))) {
        memory.set(key, value);
      }
    },
    remove: (key) => {
      memory.delete(key);
      attempt((storage) => storage.removeItem(key));
    },
  };
};
