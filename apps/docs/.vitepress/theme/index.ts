/**
 * The docs theme: VitePress's default, wearing Forge.
 *
 * Nothing is replaced, only re-coloured. `forge.css` is imported after the
 * default theme's own styles so its variable mapping wins the cascade.
 */
import DefaultTheme from 'vitepress/theme';
import './forge.css';

export default DefaultTheme;
