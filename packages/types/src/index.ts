/**
 * @vttforge/types: the TypeScript surface shared across VTTForge packages.
 *
 * Today that is the Foundry members the base factories in `@vttforge/core`
 * stand on. Core re-exports them, so importing from either package works.
 */
import { version } from '../package.json' with { type: 'json' };

export const VTTFORGE_TYPES_VERSION: string = version;

export type { ApplicationV2Members, DocumentSheetV2Members, VttforgeClass } from './foundry.js';
