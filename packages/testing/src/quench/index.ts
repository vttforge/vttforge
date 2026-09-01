/**
 * `@vttforge/testing/quench` — the half that runs inside Foundry.
 *
 * For what a mock cannot answer: a sheet that really draws, a socket with two
 * clients, a document that round-trips through the database.
 */
export { type BatchOptions, type QuenchContext, registerBatch } from './register-batch.js';
