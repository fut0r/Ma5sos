/*
 * Inlined into the <head> of every page by vite.config.js. It runs before the
 * first paint, so a page never flashes the wrong theme. Plain script, not a
 * module: keep it small and free of imports.
 */
(function () {
  var root = document.documentElement;

  // Theme: the visitor's saved choice if there is one, otherwise the device's
  // light/dark setting. src/lib/theme.js takes over once the page is running.
  var theme = null;
  try {
    theme = localStorage.getItem('ma5sos-theme') || localStorage.getItem('mazom-theme');
  } catch (error) {
    /* storage unavailable: fall through to the device setting */
  }
  if (theme !== 'light' && theme !== 'dark') {
    theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  root.dataset.theme = theme;

  // Scroll reveal: only where it can work, and never against the visitor's
  // reduced-motion setting. See src/lib/motion.js.
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if ('IntersectionObserver' in window && !calm) root.classList.add('reveal-ready');
})();
