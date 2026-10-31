import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'ma5sos-theme';
const LEGACY_STORAGE_KEY = 'mazom-theme';
const BROWSER_BAR = { dark: '#0b0d0c', light: '#f7f4ee' };
const SWITCH_MS = 320;

const systemPrefersLight = () => window.matchMedia('(prefers-color-scheme: light)');

function savedTheme() {
  try {
    const value = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null; // storage can be blocked, e.g. in private mode
  }
}

/*
 * The theme lives on <html data-theme>; index.html sets it before first paint.
 * Until the visitor picks one with the switch, it follows the device's own
 * light/dark setting, including when that setting changes while the page is open.
 */
export function useTheme() {
  const [theme, setTheme] = useState(() =>
    document.documentElement.dataset.theme === 'light' ? 'light' : 'dark',
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BROWSER_BAR[theme]);
  }, [theme]);

  useEffect(() => {
    const media = systemPrefersLight();
    const followSystem = (event) => {
      if (!savedTheme()) setTheme(event.matches ? 'light' : 'dark');
    };
    media.addEventListener('change', followSystem);
    return () => media.removeEventListener('change', followSystem);
  }, []);

  const toggle = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';

    // Lets colours ease across for the length of the switch; see base.css.
    const root = document.documentElement;
    root.classList.add('theme-switching');
    window.setTimeout(() => root.classList.remove('theme-switching'), SWITCH_MS);

    try {
      localStorage.setItem(STORAGE_KEY, next);
      localStorage.setItem(LEGACY_STORAGE_KEY, next);
    } catch {
      // Without storage the choice simply lasts for this visit.
    }
    setTheme(next);
  }, [theme]);

  return [theme, toggle];
}
