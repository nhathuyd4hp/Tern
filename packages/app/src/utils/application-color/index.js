// Application icons are told apart by color. The color comes from the application's path, so it is
// stable across restarts and needs nothing stored.
const APPLICATION_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export const getApplicationColor = (application) => {
  const key = String(application?.pathname || application?.name || '').toLowerCase().replaceAll('\\', '/');
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return APPLICATION_COLORS[hash % APPLICATION_COLORS.length];
};
