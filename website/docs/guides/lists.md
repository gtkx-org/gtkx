# Lists & tables

GTK's list widgets (`GtkListView`, `GtkGridView`, `GtkColumnView`, `GtkDropDown`) are factory-based: the widget owns a data model and stamps out row widgets on demand. GTKX hides the factory machinery behind a declarative `items` prop — you pass plain data and a `renderItem` callback, and GTKX keeps the underlying model in sync with your React state.

## When you need a list widget

For small, static content, plain `map()` over a container is fine:

```tsx
<GtkScrolledWindow vexpand>
    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
        {notes.map((note) => (
            <GtkLabel key={note.id} label={note.title} halign={Gtk.Align.START} />
        ))}
    </GtkBox>
</GtkScrolledWindow>
```

This creates one widget per item, always. That is the right trade-off for a settings panel or a short `GtkListBox`, but it falls over with hundreds of rows. List widgets virtualize: they create widgets only for visible rows and recycle them as you scroll, so a list of 100,000 items costs about as much as a list of 30.

## The items contract

Every list widget takes the same `items` shape — an array of entries pairing a unique string `id` with an arbitrary `value`:

```tsx
const items = [
    { id: "1", value: { name: "First" } },
    { id: "2", value: { name: "Second" } },
];

<GtkListView items={items} renderItem={(item: { name: string }) => <GtkLabel label={item.name} />} />;
```

- **`id`** drives identity and reconciliation. When `items` changes, GTKX diffs the new array against the old one by id: new ids insert, missing ids remove, and reordered ids move the existing rows. Selection and tree expansion follow the id, never the array index.
- **`value`** is what `renderItem` receives. When an item keeps its id but gets a new value, the bound row re-renders in place — order, selection, and scroll position are preserved.
- **`renderItem`** returns a React element for one row. It can render any widget tree, and the result participates in React state, context, and hooks like any other component.

The entry type is exported as `ListItem` from `@gtkx/react`. Entries can also carry `children` (tree mode) or `section: true` (section mode) — covered below.

::: warning Stable ids
Generate ids from your data (a database key, a file path), never from the array index. Index-derived ids turn every insertion into a cascade of value updates and break selection across reorders.
:::

## GtkListView

The workhorse vertical list. Wrap it in a `GtkScrolledWindow`, give it an `estimatedItemHeight`, and control selection with `selected` + `onSelectionChanged`:

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel, GtkListView, GtkScrolledWindow } from "@gtkx/jsx/gtk";

<GtkScrolledWindow vexpand>
    <GtkListView
        estimatedItemHeight={48}
        selectionMode={Gtk.SelectionMode.SINGLE}
        selected={selectedId ? [selectedId] : []}
        onSelectionChanged={(ids) => setSelectedId(ids[0] ?? null)}
        items={notes.map((note) => ({ id: note.id, value: note }))}
        renderItem={(note: Note) => <GtkLabel label={note.title} halign={Gtk.Align.START} />}
    />
</GtkScrolledWindow>;
```

- **`estimatedItemHeight`** sizes placeholder cells before their React content binds, so the scrollbar is accurate from the first frame.
- **`selectionMode`** is `Gtk.SelectionMode.NONE`, `SINGLE`, `BROWSE`, or `MULTIPLE`.
- **`selected`** is a controlled array of item ids. With `MULTIPLE`, pass several ids and `onSelectionChanged` reports the full set:

```tsx
<GtkListView
    selectionMode={Gtk.SelectionMode.MULTIPLE}
    selected={["1", "3"]}
    onSelectionChanged={(ids) => setSelectedIds(ids)}
    items={items}
    renderItem={renderItem}
/>
```

## GtkGridView

Same contract, multi-column layout. `minColumns` and `maxColumns` bound how many columns the grid uses as it fills the available width:

```tsx
<GtkScrolledWindow vexpand>
    <GtkGridView
        minColumns={2}
        maxColumns={4}
        estimatedItemHeight={80}
        selectionMode={Gtk.SelectionMode.SINGLE}
        selected={selected}
        onSelectionChanged={onSelectionChanged}
        items={items}
        renderItem={(note: Note) => <NoteCard note={note} />}
    />
</GtkScrolledWindow>
```

For grids, `estimatedItemWidth` complements `estimatedItemHeight` when cells are wider than they are tall.

## GtkColumnView

Tables. The row data flows through `items` on `GtkColumnView`; each `GtkColumnViewColumn` child declares one column with its own `renderCell`. Sorting is controlled: clicking a `sortable` column header fires `onSortChanged`, and you sort the data yourself before mapping it to `items`:

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { GtkColumnView, GtkColumnViewColumn, GtkLabel, GtkScrolledWindow } from "@gtkx/jsx/gtk";
import { useMemo, useState } from "react";

interface Employee {
    id: string;
    name: string;
    salary: number;
}

function EmployeeTable({ employees }: { employees: Employee[] }) {
    const [sortColumn, setSortColumn] = useState<string | null>(null);
    const [sortOrder, setSortOrder] = useState(Gtk.SortType.ASCENDING);

    const sorted = useMemo(() => {
        if (!sortColumn) return employees;
        return [...employees].sort((a, b) => {
            const cmp = sortColumn === "name" ? a.name.localeCompare(b.name) : a.salary - b.salary;
            return sortOrder === Gtk.SortType.ASCENDING ? cmp : -cmp;
        });
    }, [employees, sortColumn, sortOrder]);

    return (
        <GtkScrolledWindow vexpand>
            <GtkColumnView
                estimatedRowHeight={48}
                sortColumn={sortColumn}
                sortOrder={sortOrder}
                onSortChanged={(column, order) => {
                    setSortColumn(column);
                    setSortOrder(order);
                }}
                items={sorted.map((emp) => ({ id: emp.id, value: emp }))}
            >
                <GtkColumnViewColumn
                    id="name"
                    title="Name"
                    expand
                    sortable
                    renderCell={(emp: Employee) => <GtkLabel label={emp.name} />}
                />
                <GtkColumnViewColumn
                    id="salary"
                    title="Salary"
                    sortable
                    renderCell={(emp: Employee) => <GtkLabel label={`$${emp.salary}`} />}
                />
            </GtkColumnView>
        </GtkScrolledWindow>
    );
}
```

Columns are regular React children: render them conditionally, reorder them, or map them from data and GTK follows. Beyond `id`, `title`, and `renderCell`, a column accepts `expand`, `resizable`, `fixedWidth`, `visible`, and a `headerMenu={<GMenu items={...} />}` for the header's context menu. Selection props (`selected`, `selectionMode`, `onSelectionChanged`) work exactly as on `GtkListView`.

## Tree lists

Hierarchies need no separate widget — give entries a `children` array and `GtkListView` becomes a tree. Each parent row gets an expander; `autoexpand` opens new rows automatically:

```tsx
interface SidebarItem {
    id: string;
    name: string;
    children?: SidebarItem[];
}

const toListItems = (items: SidebarItem[]) =>
    items.map((item) => ({
        id: item.id,
        value: item,
        hideExpander: !item.children,
        children: item.children?.map((child) => ({ id: child.id, value: child, hideExpander: true })),
    }));

<GtkListView
    autoexpand
    cssClasses={["navigation-sidebar"]}
    selectionMode={Gtk.SelectionMode.SINGLE}
    items={toListItems(sidebarData)}
    selected={selectedId ? [selectedId] : []}
    onSelectionChanged={(ids) => setSelectedId(ids[0] ?? "")}
    renderItem={(item: SidebarItem) => <GtkLabel label={item.name} />}
/>;
```

In tree mode `renderItem` receives a second argument, the row's `Gtk.TreeListRow`, for depth-aware rendering:

```tsx
renderItem={(item: SidebarItem, row) => <GtkLabel label={`${item.name} - depth: ${row?.getDepth() ?? 0}`} />}
```

Per-entry knobs control the tree chrome: `hideExpander` removes the expander arrow (use it on leaf rows), `indentForDepth` and `indentForIcon` control indentation. Selection works on the flattened visible rows, and expansion state survives re-renders and filtering as long as ids stay stable.

Entries can also be section headers: an entry with `section: true` and a `children` array groups its children under a header rendered by the `renderHeader` prop. The typing supports sections on every list variant; the example below shows them on `GtkDropDown`.

## GtkDropDown

A single-selection dropdown with the same `items` contract. Selection is a single id through `selectedId` + `onSelectionChanged`, and string values render as labels without a `renderItem`:

```tsx
const themes = [
    { id: "system", value: "System" },
    { id: "light", value: "Light" },
    { id: "dark", value: "Dark" },
];

<GtkDropDown selectedId={theme} onSelectionChanged={(id) => setTheme(id)} items={themes} />;
```

For custom rows, pass `renderItem`; `renderListItem` overrides it for the popup list only, letting the collapsed button stay compact. Section entries group the popup with headers:

```tsx
<GtkDropDown
    renderHeader={(section: string) => <GtkLabel label={section} />}
    items={[
        { id: "letters", value: "Letters", section: true, children: [{ id: "a", value: "Alpha" }] },
        { id: "numbers", value: "Numbers", section: true, children: [{ id: "1", value: "One" }] },
    ]}
/>
```

`AdwComboRow` from `@gtkx/jsx/adw` takes the same props as `GtkDropDown` and renders as a preferences-style row.

## Performance notes

- **Virtualization is the point.** `renderItem` runs only for rows GTK realizes, and row widgets are recycled as you scroll. Rendering a 100,000-item `items` array is cheap; the cost scales with visible rows, plus an O(n) diff of the entries themselves.
- **Keep ids stable.** The diff matches entries by id. Stable ids reduce a reorder to model moves and a value change to an in-place rebind; unstable ids force GTKX to tear down and rebuild rows.
- **Give an accurate `estimatedItemHeight`.** Until a row's React content binds, GTKX seeds a placeholder cell at the estimated size. Accurate estimates keep the scrollbar steady and avoid layout jumps when placeholders are replaced; on `GtkColumnView` the equivalent prop is `estimatedRowHeight`.
- **Memoize row components for hot lists.** `renderItem` closures are re-applied when they change, so a `memo`-wrapped row component avoids re-rendering every bound row on unrelated state changes.
- **For very large or externally owned data, switch to `model`.** Every list widget alternatively accepts a `Gio.ListModel` through the `model` prop instead of `items` (wrapped in a `Gtk.SingleSelection` or `Gtk.MultiSelection` for list, grid, and column views). You own the model's lifecycle and mutate it directly — no per-render diff at all. The Colors demo in `examples/gtk-demo` drives a `GtkGridView` with up to 16,777,216 items this way.

::: tip
Always place list widgets inside a `GtkScrolledWindow`. Without one, the list requests the full height of all its rows and virtualization cannot kick in.
:::
