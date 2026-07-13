---
description: "Build the navigation sidebar as one GtkListBox of AdwActionRows, derived from props, with selection synced both ways between React and GTK."
---

# The Sidebar

The sidebar is the left pane of the adaptive `AdwNavigationSplitView`: a single scrolling list of "smart views" (All Tasks, Today, Important), then the user's colored task lists, then Trash. In GTK terms it is one `GtkListBox` wearing the `.navigation-sidebar` style class, and every row is an `AdwActionRow`. There is no per-row component and no imperative widget code in the hot path: the whole thing is derived from props, and selection is a controlled value synced in both directions between React state and the live `GtkListBox`.

Here is the entire file's import block and the shape of one row entry, straight from `components/sidebar.tsx`:

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { AdwActionRow } from "@gtkx/jsx/adw";
import { GtkBox, GtkImage, GtkLabel, GtkListBox, GtkScrolledWindow } from "@gtkx/jsx/gtk";
import { useEffect, useRef } from "react";
import type { SidebarCounts } from "../select.js";
import { listDot } from "../styles.js";
import type { Selection, TaskList } from "../types.js";

type Entry = {
    selection: Selection;
    title: string;
    icon?: string;
    color?: string;
    count: number;
};
```

Two things worth flagging for a React reader. Every widget is a named PascalCase import from `@gtkx/jsx/<lib>` (there are no lowercase intrinsics like `<div>`); `AdwActionRow` comes from the libadwaita namespace, the `Gtk*` primitives from the GTK one. And `@gtkx/gi/gtk` (imported as `Gtk`) is a separate thing from `@gtkx/jsx/gtk`: it gives you the raw GI classes and enums (`Gtk.ListBox` for the ref type, `Gtk.Align`, `Gtk.AccessibleRole`), not JSX components.

## One data model, one key function

The sidebar renders from a flat `Entry[]` built once per render. `buildEntries` stitches the three fixed smart views around the dynamic user lists and caps the list with Trash:

```tsx
const buildEntries = (lists: TaskList[], counts: SidebarCounts): Entry[] => [
    { selection: { kind: "smart", view: "all" }, title: "All Tasks", icon: "view-list-symbolic", count: counts.all },
    {
        selection: { kind: "smart", view: "today" },
        title: "Today",
        icon: "x-office-calendar-symbolic",
        count: counts.today,
    },
    {
        selection: { kind: "smart", view: "important" },
        title: "Important",
        icon: "starred-symbolic",
        count: counts.important,
    },
    ...lists.map(
        (list): Entry => ({
            selection: { kind: "list", listId: list.id },
            title: list.name,
            color: list.color,
            count: counts.lists[list.id] ?? 0,
        }),
    ),
    { selection: { kind: "smart", view: "trash" }, title: "Trash", icon: "user-trash-symbolic", count: counts.trash },
];
```

Smart entries carry an `icon` (a symbolic icon name from the system theme); user-list entries carry a `color` instead. That single `color ? ... : icon` distinction is what later decides whether a row shows a colored dot or a themed glyph.

Each `Entry` also carries a `Selection`, the discriminated union that identifies what the row points at:

```ts
export type Selection = { kind: "smart"; view: SmartView } | { kind: "list"; listId: string };
```

Because a `Selection` is a structural object, you cannot compare two of them with `===`. `keyOf` flattens one into a stable string, and it does double duty as the React `key` and as the identity used for selection matching:

```tsx
const keyOf = (selection: Selection): string =>
    selection.kind === "smart" ? `smart:${selection.view}` : `list:${selection.listId}`;
```

## The list box

The rows live in a `.navigation-sidebar` `GtkListBox` inside a vertically expanding `GtkScrolledWindow`:

```tsx
return (
    <GtkScrolledWindow vexpand>
        <GtkListBox
            ref={listRef}
            cssClasses={["navigation-sidebar"]}
            onRowSelected={(row) => {
                if (!row) return;
                const entry = entries[row.getIndex()];
                if (entry && keyOf(entry.selection) !== keyOf(selection)) onSelect(entry.selection);
            }}
        >
            {entries.map((entry) => (
                <AdwActionRow key={keyOf(entry.selection)} title={entry.title} /* prefix/suffix below */ />
            ))}
        </GtkListBox>
    </GtkScrolledWindow>
);
```

There is no `className` in gtkx; you attach style classes through `cssClasses`, which is always a `string[]`. `.navigation-sidebar` is a stock libadwaita class that restyles a `GtkListBox` into the flat, tinted sidebar look (no card borders, hover/selection styled for a nav rail). The list box uses its default single-selection behavior, which is exactly what a navigation rail wants: one active destination at a time.

Note the children are plain `AdwActionRow`s, not `GtkListBoxRow`s. When you drop non-row children into a `GtkListBox`, the reconciler wraps each one in a `GtkListBoxRow` for you, so `row.getIndex()` inside `onRowSelected` lines up with the index into `entries`.

## Rows: prefix and suffix slots

`AdwActionRow` exposes two named `ReactNode` slots, `prefix` and `suffix`, that map to libadwaita's `add_prefix`/`add_suffix`. The sidebar uses `prefix` for the leading icon-or-dot and `suffix` for the trailing count badge:

```tsx
<AdwActionRow
    key={keyOf(entry.selection)}
    title={entry.title}
    prefix={
        entry.color ? (
            <GtkBox
                valign={Gtk.Align.CENTER}
                cssClasses={[listDot(entry.color)]}
                accessibleRole={Gtk.AccessibleRole.PRESENTATION}
            />
        ) : (
            <GtkImage iconName={entry.icon} />
        )
    }
    suffix={
        entry.count > 0 ? (
            <GtkLabel
                label={String(entry.count)}
                valign={Gtk.Align.CENTER}
                cssClasses={["dimmed", "numeric"]}
            />
        ) : undefined
    }
/>
```

Passing `title` as a prop (not children) is the libadwaita convention: `AdwActionRow` is a preferences-style row where the title text is a first-class property, and gtkx surfaces it as a plain string prop.

### Colored list dots

A user list's color is rendered as a small circular `GtkBox`. GTK has no "circle" widget, so the dot is pure CSS: `listDot(color)` in `styles.ts` returns a generated class name that sizes and rounds an empty box and fills it with the list's color.

```ts
import { css } from "@gtkx/css";

export const listDot = (color: string): string => css`
    min-width: 12px;
    min-height: 12px;
    border-radius: 9999px;
    background: ${color};
`;
```

`css` from `@gtkx/css` takes a tagged template and returns a single class name string (like `gtkx-1a2b3c`), which you spread into `cssClasses`. This is GTK4 CSS, not web CSS: `min-width`/`min-height` set the box's size (an empty `GtkBox` has no intrinsic size), `border-radius: 9999px` makes it a pill/circle, and the interpolated `${color}` becomes the `background`. Because `listDot` is called with the list's color at render time, each list gets its own generated, deduplicated class.

The dot carries no information a screen reader needs to announce, so it is marked decorative with `accessibleRole={Gtk.AccessibleRole.PRESENTATION}`. That removes the empty box from the accessibility tree, leaving the row's title as the only thing announced. `valign={Gtk.Align.CENTER}` keeps the 12px dot vertically centered against the taller row.

### Count badges

The trailing number is a `GtkLabel` styled with two stock classes:

```tsx
<GtkLabel
    label={String(entry.count)}
    valign={Gtk.Align.CENTER}
    cssClasses={["dimmed", "numeric"]}
/>
```

`.numeric` switches the label to tabular (fixed-width) figures so counts stay aligned as they change. `.dimmed` de-emphasizes the text.

::: tip `.dimmed`, not `.dim-label`
libadwaita deprecated `.dim-label` in favor of `.dimmed`. Reach for `.dimmed` in new code; they achieve the same visual muting.
:::

The badge only renders when `entry.count > 0`, otherwise the `suffix` slot receives `undefined` and the row shows no trailing number. The counts come from the `sidebarCounts` selector in `select.ts`, which is a pure derivation over the task array:

```ts
export const sidebarCounts = (tasks: Task[], lists: TaskList[]): SidebarCounts => {
    const active = tasks.filter((task) => !task.deleted && !task.done);
    return {
        all: active.length,
        today: active.filter((task) => isToday(task.due)).length,
        important: active.filter((task) => task.important).length,
        trash: tasks.filter((task) => task.deleted).length,
        lists: Object.fromEntries(
            lists.map((list) => [list.id, active.filter((task) => task.listId === list.id).length]),
        ),
    };
};
```

The smart-view and per-list counts are all computed from `active` tasks (not deleted, not done), so the badge reads like a GNOME "unfinished work" indicator, not a total. Trash is the exception: it counts every deleted task regardless of done state, since that pane shows deleted items in full.

## Controlled selection, synced both ways

The sidebar owns no selection state. It receives the current `selection` and an `onSelect` callback as props:

```tsx
export const Sidebar = ({
    lists,
    counts,
    selection,
    onSelect,
}: {
    lists: TaskList[];
    counts: SidebarCounts;
    selection: Selection;
    onSelect: (selection: Selection) => void;
}) => {
    const entries = buildEntries(lists, counts);
    const activeIndex = entries.findIndex((entry) => keyOf(entry.selection) === keyOf(selection));
    const listRef = useRef<Gtk.ListBox | null>(null);
    // ...
```

A `GtkListBox` has its own native selection, so keeping it in agreement with a React prop is a two-way problem: user clicks must flow out to `onSelect`, and prop changes (for example, a keyboard shortcut jumping to Trash) must flow back into the widget. gtkx wires both directions explicitly.

**Widget to React** happens in `onRowSelected`, the JSX form of the GtkListBox `row-selected` signal. Its first argument is the newly selected `Gtk.ListBoxRow` (or `null`):

```tsx
onRowSelected={(row) => {
    if (!row) return;
    const entry = entries[row.getIndex()];
    if (entry && keyOf(entry.selection) !== keyOf(selection)) onSelect(entry.selection);
}}
```

**React to widget** happens in an effect that finds the row at the active index and selects it imperatively:

```tsx
useEffect(() => {
    const box = listRef.current;
    if (!box || activeIndex < 0) return;
    const row = box.getRowAtIndex(activeIndex);
    if (row) box.selectRow(row);
}, [activeIndex]);
```

`listRef` is a `useRef<Gtk.ListBox | null>(null)`; because `ref` on a gtkx component resolves to the live GI instance, `listRef.current` is a real `Gtk.ListBox` and you can call GTK methods on it directly (`getRowAtIndex`, `selectRow`). The effect keys off `activeIndex`, which is recomputed each render by matching `keyOf` against the incoming `selection` prop.

::: info Breaking the echo
These two directions form a loop: the effect calls `selectRow`, which makes the list box emit `row-selected`, which runs the `onRowSelected` handler. Without a guard that would fire `onSelect` right back with the value that just arrived. The guard `keyOf(entry.selection) !== keyOf(selection)` is what stops it: when the row that got selected already matches the current `selection` prop, the handler returns without calling `onSelect`. Real user clicks land on a *different* row, so `keyOf` differs and the update propagates; the programmatic echo lands on the same row, so `keyOf` matches and it is swallowed.
:::

## Next

Continue to **The Task List**.
