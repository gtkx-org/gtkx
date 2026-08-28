---
title: "Upgrading to 2.0"
description: "What GTKX 2.0 removes, how the 1.6 deprecation warnings tell you which of it reaches your project, and how to clear each one before you upgrade."
---

# Upgrading to 2.0

GTKX 2.0 removes what 1.x deprecated and adds nothing. It is the last 1.x release minus the deprecated paths, so there is no new API to learn and no behavior to discover — every change it makes was already available behind a flag or already marked `@deprecated` in your editor. New work resumes at 2.1.

That gives the upgrade a single property worth planning around: **clear every deprecation on 1.6 and moving to 2.0 changes nothing.** There are two lists to clear, and they are found in different ways: the future flags, which the CLI prints on every run, and the deprecated symbols, which your editor strikes through. Clear both on 1.6 and 2.0 is a version bump.

## The two kinds of deprecation

**Deprecated symbols** are the ordinary kind. An old name and a new name coexist, the old one carries a `@deprecated` tag, your editor strikes it through on hover, and 2.0 deletes it. You find them by reading the tooltip.

**Future flags** are the other kind. They change the type of a symbol that keeps its name, so there is no old name to tag and nothing for an editor to strike through. That is why 1.6 warns about them from the CLI instead: without the warning, 2.0 would change what your code returns with no prior signal.

## Start here: read the warning

Run any command that loads your configuration — `gtkx build`, `gtkx dev`, `gtkx codegen`. If flags are unset, one block prints on stderr:

```
[gtkx] warn 2 of 5 future flags are unset. Their behavior becomes the default in GTKX 2.0.

  [gtkx-v2-byte-arrays]       future: { v2ByteArrays: true }
    Byte sequences come back as number[]. In 2.0 they come back as Uint8Array.

  [gtkx-v2-inout-returns]     future: { v2InoutReturns: true }
    Inout records repeat in the return value. In 2.0 the repeated entry is dropped.

  Set one flag at a time and run tsc: every affected call site is a type error.
  Guide    https://gtkx.dev/guide/upgrading-to-2
  Silence  deprecations: { silence: ["gtkx-v2-byte-arrays"] }
```

Each line is one flag you have not adopted. A project that prints nothing has nothing to do here.

## Adopt one flag at a time

Every flag is caught statically, so you never have to guess what it touches. Set one in `gtkx.config.ts`, run `tsc`, and fix what it reports:

```ts
export default defineConfig({
    applicationId: "com.example.Tasks",
    future: { v2ByteArrays: true },
});
```

Flipping a flag changes every affected call site at once — there is no partial adoption within a single flag. What you control is the order and the pace: five independent flags, one per sitting, is the shape this is built for.

Setting a flag never changes behavior for anyone else and never changes the shape of your build output. It only moves your project onto the 2.0 semantics ahead of time.

### `v2ByteArrays`

GIR byte sequences become `Uint8Array` instead of `number[]`. Parameters accept both either way, so passing values *in* never breaks; what changes is what comes *back*. `tsc` flags the array methods a `Uint8Array` does not have, such as `.push` and `.concat`.

Two call sites change silently rather than failing to compile, because both accept anything: `Array.isArray(result)` flips from `true` to `false`, and `JSON.stringify(result)` writes `{"0":72,"1":105}` where it used to write `[72,105]`. Grep for those two on byte-sequence results before you flip the flag.

### `v2ValueReturns`

Bindings that return a `GValue` hand back what it holds, typed `unknown`. Assert the type you asked for at the call site: `(await clipboard.readValueAsync(Gio.File, 0, null)) as Gio.File`. `tsc` flags every return site, since `unknown` cannot be used without an assertion.

### `v2FinishResults`

Promisified async methods drop the leading success boolean, which was always `true` on the pairs this covers. `const [, contents] = await file.loadContentsAsync(null)` becomes `const [contents] = ...`, and a call left with one out parameter resolves to that value directly.

### `v2InoutReturns`

An inout record or boxed parameter stops repeating in the return value. It was always the same object you already passed in, mutated in place. `Gsk.Path.getNext(point)` returns `boolean` rather than `[boolean, PathPoint]`.

### `v2ResourceImports`

The `#data/` import map is replaced by relative, query-suffixed imports. Remove `"imports": { "#data/*": "./data/*" }` from `package.json`, then rewrite each import:

```ts
// Before
import logoUri from "#data/logo.png";
import schema from "#data/com.example.Tasks.gschema.xml";

// After, from src/app.tsx
import logoPath from "../data/logo.png?resource";
import schema from "../data/com.example.Tasks.gschema.xml";
```

Assets take a query suffix; settings schemas do not, and stay query-free relative imports that carry their
generated types. This is the only flag whose migration the compiler cannot do for you, because the change is
in the specifier rather than the type. The build fails on every specifier that still needs attention, one at a
time.

The [configuration guide](/guide/configuration-and-codegen#future-flags) documents each flag in full, including the `?icon` and `?url` forms.

## Clear the deprecated symbols

These carry a `@deprecated` tag, so your editor strikes them through on hover. TypeScript has no compiler
diagnostic for deprecated usage, so there is no `tsc` flag that lists them — the editor, or a search for the
names below, is how you find them.

The generated store also carries thousands of *upstream* GObject deprecations, which 2.0 does not touch:
`Adw.Leaflet`, `Gtk.Dialog`, and the rest are GNOME's own deprecations and keep working. GTKX's own are the
ones whose tag ends in **`Removed in v2`**. Searching the store for that phrase gives the exact inventory.

| Deprecated | Since | Replacement |
| --- | --- | --- |
| `addEventListener` / `removeEventListener` on any GObject | 1.2 | `on` / `off` |
| `Gdk.RGBA.create(css)` | 1.3 | `new RGBA()` then `parse`, checking what `parse` returns, or `new RGBA({ red, green, blue, alpha })` |
| `Graphene.Point.create(x, y)` | 1.3 | `new Point({ x, y })` |
| `Graphene.Rect.create(x, y, width, height)` | 1.3 | `new Rect()` then `init(x, y, width, height)` |
| `Graphene.Size.create(width, height)` | 1.3 | `new Size({ width, height })` |
| `GObject.buildValue(gtype, populate)` | 1.3 | Pass the value itself, or `new Value()` and `init` |
| The `@gtkx/gi/cairo` subpath | 1.3 | Import from `@gtkx/cairo` |
| The `*ConstructorProps` type aliases in `@gtkx/cairo` | 1.3 | None — the stub constructors they described are gone |

`Gdk.RGBA.create` is the one worth reading twice: it swallows a color string GDK cannot parse and leaves you
with transparent black. Its replacement makes you check.

## Silencing, and what it does not do

A flag you have read and decided to defer can be silenced by its id so it stops printing:

```ts
export default defineConfig({
    applicationId: "com.example.Tasks",
    deprecations: { silence: ["gtkx-v2-inout-returns"] },
});
```

Silencing is an acknowledgement, not a migration. The behavior still changes in 2.0, and a silenced project gets the same breakage an unwarned one would. Use it to keep the block readable while you work through the other flags, not as a way to close the ticket.

## What 2.0 does not do

2.0 ships no new features, no new bindings, and no new configuration. It removes the deprecated paths listed above, deletes the `future` block, and makes the opted-in behavior the only behavior. Anything held back during the freeze ships in 2.1.

The `deprecations` block stays: it is the mechanism, not one of the corrections. Its `silence` list only accepts ids the CLI currently reports, so an entry naming a flag 2.0 removed becomes a configuration error, and the fix is to delete the line.

## Next

- [Configuration and Codegen](/guide/configuration-and-codegen#future-flags): what each flag changes, in detail.
- The [API reference](/reference/) documents every package.
