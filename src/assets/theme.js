// Load synchronously in <head> so a saved preference applies before styles paint.
(() => {
  const key = 'kubarr-website-theme';
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const valid = value => ['light', 'dark', 'system'].includes(value);
  const read = () => {
    try { const value = localStorage.getItem(key); return valid(value) ? value : 'system'; }
    catch { return 'system'; }
  };
  let preference = read();
  const apply = () => {
    const dark = preference === 'dark' || (preference === 'system' && media.matches);
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]').content = dark ? '#111827' : '#f9fafb';
    const select = document.querySelector('[data-theme-select]');
    if (select) select.value = preference;
  };
  window.kubarrTheme = {
    get: () => preference,
    set: value => {
      if (!valid(value)) return;
      preference = value;
      try { localStorage.setItem(key, value); } catch { /* private browsing */ }
      apply();
    },
  };
  media.addEventListener('change', apply);
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) { preference = read(); apply(); }
  });
  apply();
})();
