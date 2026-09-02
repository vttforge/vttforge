/**
 * NoteData — the `note` Item sub-type this module adds to any system.
 *
 * The schema is a function handed to the factory. It has to be a function
 * because `fields()` reads a Foundry global that does not exist when this
 * module is first evaluated.
 */
import { BaseTypeDataModel, fields } from '@vttforge/core';

const defineNoteSchema = () => {
  const f = fields();
  return {
    body: new f.HTMLField(),
    pinned: new f.BooleanField({ required: true, nullable: false, initial: false }),
  };
};

export class NoteData extends BaseTypeDataModel(defineNoteSchema) {}
