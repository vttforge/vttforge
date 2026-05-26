/**
 * Landing page interaction:
 *   - Theme toggle: cycles dark → light → auto, persists to localStorage.
 *   - Install command copy button.
 *
 * No framework, no bundler magic — Vite serves this directly.
 */

const THEME_KEY = 'vttf-theme';
const ORDER = ['dark', 'light', 'auto'];

function applyTheme(theme) {
  if (theme === 'dark') {
    document.body.removeAttribute('data-theme');
  } else {
    document.body.setAttribute('data-theme', theme);
  }
  document.querySelectorAll('.tt-icon').forEach((el) => {
    el.hidden = el.dataset.state !== theme;
  });
  const label = document.querySelector('.tt-label');
  if (label) label.textContent = theme;
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  applyTheme(saved && ORDER.includes(saved) ? saved : 'dark');

  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const current = localStorage.getItem(THEME_KEY) ?? 'dark';
    const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  });
}

function initCopy() {
  const btn = document.getElementById('copy-btn');
  const target = document.getElementById('install-text');
  if (!btn || !target) return;

  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(target.textContent.trim());
      const lbl = btn.querySelector('.lbl');
      if (lbl) lbl.textContent = 'copied';
      btn.classList.add('copied');
      setTimeout(() => {
        if (lbl) lbl.textContent = 'copy';
        btn.classList.remove('copied');
      }, 1600);
    } catch (err) {
      console.error('clipboard write failed', err);
    }
  });
}

function init() {
  initTheme();
  initCopy();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
