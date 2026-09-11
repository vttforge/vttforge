# Dialogs

`promptFields()` shows a dialog built from a list of fields and resolves to their values, or `null` when the player closes it.

```ts twoslash
import { promptFields } from '@vttforge/core';

const answer = await promptFields(
  [
    { name: 'name', type: 'text', label: 'MY_SYSTEM.Name', value: 'Rope', required: true },
    { name: 'quantity', type: 'number', label: 'MY_SYSTEM.Quantity', value: 1, min: 1 },
    { name: 'kind', type: 'select', label: 'MY_SYSTEM.Kind', options: { stowed: 'Stowed', equipped: 'Equipped' } },
    { name: 'magic', type: 'checkbox', label: 'MY_SYSTEM.Magic' },
  ],
  { title: 'MY_SYSTEM.NewGear', ok: 'MY_SYSTEM.Create' },
);

if (answer) {
  answer.quantity;
  //     ^?
}
```

The result is typed from the fields: a `number` field comes back as a `number`, a `checkbox` as a `boolean`, the rest as `string`. Foundry's form reader does the casting from the input type. The first field has the focus when the dialog opens.

Every field is a form group made with Foundry's own input helpers, so it looks like the rest of the interface and works in both themes. Labels, hints, select option labels, the title and the button label may be localization keys or plain text.

## Field types

| Type | Options | Value |
| --- | --- | --- |
| `text` | `value`, `placeholder`, `required` | `string` |
| `textarea` | `value`, `placeholder`, `rows` | `string` |
| `number` | `value`, `min`, `max`, `step` (default `1`, `'any'` for decimals) | `number` |
| `checkbox` | `value` | `boolean` |
| `select` | `value`, `options` as `{ value: label }` or a list of `{ value, label, group? }`, `blank` | `string` |

Every field takes `name`, `label` and an optional `hint`. Two fields with the same name are refused, since the result has one key per name.

## Dialog options

| Option | What it does |
| --- | --- |
| `title` | Window title |
| `ok` | Label of the confirm button. Default: Foundry's |
| `icon` | Icon class of the confirm button |
| `content` | HTML shown above the fields, cleaned with `foundry.utils.cleanHTML` first |
| `modal` | Block the rest of the interface until answered |
| `rejectClose` | Reject instead of resolving `null` when the dialog is dismissed |

## A custom dialog

`promptFieldGroup(field)` returns the form group for one field, for a `DialogV2` you configure yourself: extra buttons, your own content around the inputs, a different callback.
