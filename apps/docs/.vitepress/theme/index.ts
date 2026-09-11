/**
 * The docs theme: VitePress's default, wearing Forge.
 *
 * Nothing is replaced, only re-coloured. `forge.css` is imported after the
 * default theme's own styles so its variable mapping wins the cascade.
 *
 * `TwoslashFloatingVue` mounts the hover panels the twoslash blocks render
 * into. Without it those blocks are plain code with dead markup in them.
 * `VersionSwitcher` is the navigation entry that moves between the version
 * at the root and the frozen copies under `archive/`.
 */
import TwoslashFloatingVue from '@shikijs/vitepress-twoslash/client';
import '@shikijs/vitepress-twoslash/style.css';
import VersionSwitcher from '@viteplus/versions/components/version-switcher.component.vue';
import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import './forge.css';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.use(TwoslashFloatingVue);
    app.component('VersionSwitcher', VersionSwitcher);
  },
} satisfies Theme;
