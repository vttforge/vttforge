# Sockets

`registerSocket()` sets up the two ways a package talks to the other clients:
one-way messages, and questions for the Gamemaster's client.

```js
import { registerSocket } from '@vttforge/core';

const socket = registerSocket({
  id: 'my-module',
  kind: 'module',

  messages: {
    // Runs on every other client when a Gamemaster sends it.
    turnToPage: ({ page }) => viewer.goToPage(page),
  },

  requests: {
    // Runs on the Gamemaster's client, whoever asked.
    grantItem: async ({ actorId, itemData }) => {
      const actor = game.actors.get(actorId);
      const [item] = await actor.createEmbeddedDocuments('Item', [itemData]);
      return item.id;
    },
  },
});

await socket.emit('turnToPage', { page: 12 });
const itemId = await socket.askGm('grantItem', { actorId, itemData });
```

Call it once, from `onSetup` or `onReady`. Registering twice means every
message runs its handler twice, and Foundry will not warn you.

Add `"socket": true` to the manifest. Without it Foundry accepts the emit and
delivers nothing, silently. `registerSocket` reads the manifest and throws
[VTTF-0012](../errors/VTTF-0012) instead.

## The two directions

`emit` is one-way. A Gamemaster turns everyone's page, a client is told to
warm a cache. Nothing comes back, and nothing waits.

`askGm` is a question with an answer. A player cannot write to a world
document, so they ask the Gamemaster's client to do it and get the return
value back. It rides on Foundry's queries rather than the socket, because a
query returns a value and reports a failure. A Gamemaster calling `askGm`
runs the handler directly, with no round trip, which is why it still works in
a world where the Gamemaster is alone.

## Who may send what

A handler is a function, or an object when you need the `from` option:

```js
messages: {
  turnToPage: ({ page }) => viewer.goToPage(page),
  warmCache: { from: 'anyone', run: ({ url }) => cache(url) },
}
```

`from` defaults to `'gm'`. A message from anyone else is dropped, with no
notification: a player should learn nothing from a message that was not meant
to reach them. Use `'anyone'` only for messages that touch the receiving
client and nothing else, and treat the payload as something the sender chose.

The check reads the sender id Foundry's server appends to every relayed
message. That id comes from the authenticated session. A sender id written
into the payload proves nothing, so it is never read.

## Who receives it

```js
await socket.emit('turnToPage', { page: 12 });                  // everyone
await socket.emit('turnToPage', { page: 12 }, { to: [userId] }); // those users
await socket.emit('turnToPage', { page: 12 }, { self: false });  // not this client
```

The sender's handler runs too. Foundry never delivers a message back to
whoever sent it, so without that a Gamemaster alone in a world sees nothing
happen, and there is no way to tell that apart from a bug. `self: false` turns
it off when the sender must not act on its own message.

The sender's own id is dropped from `to` before sending, so naming yourself
does not make the handler run twice.

## What a handler is told

The second argument carries the sender:

| Field | What it is |
| --- | --- |
| `user` | The sending user, looked up from the id the server supplied |
| `userId` | That id. Empty when this client sent the message itself |
| `local` | `true` when this is the sender's own copy |

## When no Gamemaster is connected

`askGm` throws [VTTF-0013](../errors/VTTF-0013). There is nowhere for the work
to run, and a player's write would be refused. Check first when you would
rather say something than throw:

```js
if (!socket.isGmOnline()) {
  ui.notifications.warn('A Gamemaster has to be online for this.');
  return;
}
```

## Systems

The same call, with `kind: 'system'`. The only difference is the channel,
`system.<id>` instead of `module.<id>`, and which manifest carries
`"socket": true`.

## Before you reach for this

Many sockets exist only to avoid several writes in a row. `modifyBatch` sends
them in one request, all applied or none, and needs no socket at all:

```js
await foundry.documents.modifyBatch([
  { action: 'update', documentName: 'Actor', updates: [{ _id: actor.id, 'system.hp.value': 3 }] },
  { action: 'create', documentName: 'Item', data: [{ name: 'Loot', type: 'loot' }], parent: actor },
]);
```

The caller still needs permission for every operation, so a player-initiated
write still goes through `askGm`.
