import { moduleSubType } from '@vttforge/core';

export const MODULE_ID = 'vttforge-example-module';

/**
 * The key Foundry files the `note` sub-type under: `vttforge-example-module.note`.
 *
 * A module's sub-types are namespaced by Foundry. Use this constant wherever
 * the type is named — `item.type === NOTE_TYPE`, `types: [NOTE_TYPE]` — and
 * the prefix cannot be forgotten.
 */
export const NOTE_TYPE = moduleSubType(MODULE_ID, 'note');
