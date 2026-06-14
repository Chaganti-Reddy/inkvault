// Light/dark theme, remembered in localStorage. Defaults to the OS preference.
const KEY = 'inkvault.theme';

export function getTheme() {
  const saved = localStorage.getItem(KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function setTheme(theme) {
  localStorage.setItem(KEY, theme);
  applyTheme(theme);
}

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
}
