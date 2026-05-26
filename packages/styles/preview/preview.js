/**
 * Storybook-lite theme toggle for the @vttforge/styles preview page.
 * Cycles dark → light → foundry → auto and persists to localStorage.
 */

const KEY = 'vttf-theme';
const ORDER = ['dark', 'light', 'foundry', 'auto'];

function apply(theme) {
  if (theme === 'dark') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
  const label = document.querySelector('[data-theme-label]');
  if (label) label.textContent = theme;
}

function init() {
  const saved = localStorage.getItem(KEY);
  apply(saved && ORDER.includes(saved) ? saved : 'dark');

  document.querySelector('[data-theme-toggle]')?.addEventListener('click', () => {
    const current = localStorage.getItem(KEY) ?? 'dark';
    const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
    localStorage.setItem(KEY, next);
    apply(next);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
