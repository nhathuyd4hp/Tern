const LEGACY_PREFIX = 'bruno.';
const PREFIX = 'tern.';

// Browser storage keys used to start with "bruno."; carry the stored values over once and drop the old keys.
export const migrateLegacyLocalStorageKeys = () => {
  try {
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith(LEGACY_PREFIX)) continue;
      const renamed = PREFIX + key.slice(LEGACY_PREFIX.length);
      if (localStorage.getItem(renamed) === null) localStorage.setItem(renamed, localStorage.getItem(key));
      localStorage.removeItem(key);
    }
  } catch {
    // storage can be blocked; the app then starts with defaults
  }
};
