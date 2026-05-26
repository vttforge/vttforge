#!/usr/bin/env node
/**
 * Thin runner for the @vttforge/styles token build.
 * Reads sd.config.mjs and emits dist/tokens.css.
 */

import StyleDictionary from 'style-dictionary';
import config from './sd.config.mjs';

const sd = new StyleDictionary(config);
await sd.hasInitialized;
await sd.buildAllPlatforms();
