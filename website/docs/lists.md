---
sidebar_position: 2
sidebar_label: Lists & Tables
---

# Lists & Tables

GTKX provides virtualized list components that efficiently render large datasets. These use GTK's native list infrastructure with a declarative JSX-based rendering approach.

## ListView

`ListView` renders a scrollable, virtualized list of items:

```tsx
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkListView, GtkLabel, GtkScrolledWindow } from "@gtkx/react";

interface User {
  id: string;
  name: string;
  email: string;
}

const users: User[] = [
  { id: "1", name: "Alice", email: "alice@example.com" },
  { id: "2", name: "Bob", email: "bob@example.com" },
  // ... hundreds more
];

const UserList = () => (
  <GtkScrolledWindow vexpand>
    <GtkListView.Root
      renderItem={(user: User | null) => (
        <GtkLabel label={user?.name ?? ""} halign={Gtk.Align.START} />
      )}
    >
      {users.map((user) => (
        <GtkListView.Item key={user.id} id={user.id} item={user} />
      ))}
    </GtkListView.Root>
  </GtkScrolledWindow>
);
```

### How It Works

1. **`GtkListView.Root`** creates a `GtkListView` with a `SignalListItemFactory`
2. **`GtkListView.Item`** registers each data item with the internal model
3. **`renderItem`** is called with the item during bind to render the content
4. Items outside the viewport are not rendered (virtualization)

### renderItem Signature

```typescript
type RenderItemFn<T> = (item: T | null) => ReactElement;
```

- **`item`**: The data item to render, or `null` during setup (for loading/placeholder state)

## GridView

`GridView` renders items in a grid layout with automatic wrapping:

```tsx
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkGridView, GtkLabel, GtkScrolledWindow } from "@gtkx/react";

interface Photo {
  id: string;
  title: string;
  emoji: string;
}

const photos: Photo[] = [
  { id: "1", title: "Sunset", emoji: "🌅" },
  { id: "2", title: "Mountains", emoji: "🏔️" },
  // ...
];

const PhotoGrid = () => (
  <GtkScrolledWindow vexpand>
    <GtkGridView.Root
      renderItem={(photo: Photo | null) => (
        <GtkLabel
          label={photo ? `${photo.emoji}\n${photo.title}` : ""}
          cssClasses={["title-1"]}
        />
      )}
    >
      {photos.map((photo) => (
        <GtkGridView.Item key={photo.id} id={photo.id} item={photo} />
      ))}
    </GtkGridView.Root>
  </GtkScrolledWindow>
);
```

## ColumnView (Tables)

For tabular data with multiple columns, use `ColumnView`. Each column has its own `renderCell` function:

```tsx
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkColumnView, GtkLabel, GtkScrolledWindow } from "@gtkx/react";

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
}

const products: Product[] = [
  { id: "1", name: "Widget", price: 9.99, stock: 100 },
  { id: "2", name: "Gadget", price: 19.99, stock: 50 },
];

const ProductTable = () => (
  <GtkScrolledWindow vexpand>
    <GtkColumnView.Root>
      <GtkColumnView.Column
        title="Name"
        expand
        renderCell={(product: Product | null) => (
          <GtkLabel label={product?.name ?? ""} halign={Gtk.Align.START} />
        )}
      />
      <GtkColumnView.Column
        title="Price"
        fixedWidth={100}
        renderCell={(product: Product | null) => (
          <GtkLabel label={product ? `$${product.price.toFixed(2)}` : ""} />
        )}
      />
      <GtkColumnView.Column
        title="Stock"
        fixedWidth={80}
        renderCell={(product: Product | null) => (
          <GtkLabel label={product?.stock.toString() ?? ""} />
        )}
      />
      {products.map((product) => (
        <GtkColumnView.Item key={product.id} id={product.id} item={product} />
      ))}
    </GtkColumnView.Root>
  </GtkScrolledWindow>
);
```

### ColumnView.Root Sorting Props

ColumnView supports sortable columns. When the user clicks a column header, the table is sorted by that column:

```tsx
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkColumnView, GtkLabel, GtkScrolledWindow } from "@gtkx/react";
import { useMemo, useState } from "react";

interface Product {
  id: string;
  name: string;
  price: number;
}

const products: Product[] = [
  { id: "1", name: "Widget", price: 9.99 },
  { id: "2", name: "Gadget", price: 19.99 },
];

type ColumnId = "name" | "price";

const sortFn = (a: Product, b: Product, columnId: ColumnId): number => {
  if (columnId === "name") return a.name.localeCompare(b.name);
  if (columnId === "price") return a.price - b.price;
  return 0;
};

const SortableTable = () => {
  const [sortColumn, setSortColumn] = useState<ColumnId | null>("name");
  const [sortOrder, setSortOrder] = useState<Gtk.SortType>(
    Gtk.SortType.ASCENDING
  );

  const sortedProducts = useMemo(() => {
    if (!sortColumn) return products;
    const sorted = [...products].sort((a, b) => sortFn(a, b, sortColumn));
    return sortOrder === Gtk.SortType.DESCENDING ? sorted.reverse() : sorted;
  }, [sortColumn, sortOrder]);

  return (
    <GtkScrolledWindow vexpand>
      <GtkColumnView.Root<Product, ColumnId>
        sortColumn={sortColumn}
        sortOrder={sortOrder}
        onSortChange={(column, order) => {
          setSortColumn(column);
          setSortOrder(order);
        }}
      >
        <GtkColumnView.Column<Product>
          id="name"
          title="Name"
          expand
          renderCell={(product) => <GtkLabel label={product?.name ?? ""} />}
        />
        <GtkColumnView.Column<Product>
          id="price"
          title="Price"
          fixedWidth={100}
          renderCell={(product) => (
            <GtkLabel label={product ? `$${product.price}` : ""} />
          )}
        />
        {sortedProducts.map((product) => (
          <GtkColumnView.Item key={product.id} id={product.id} item={product} />
        ))}
      </GtkColumnView.Root>
    </GtkScrolledWindow>
  );
};
```

**Note:** GtkColumnView doesn't sort items internally. You must sort your data before rendering based on `sortColumn` and `sortOrder`. The `onSortChange` callback notifies you when the user clicks a column header.

| Prop           | Type                                                    | Description                                    |
| -------------- | ------------------------------------------------------- | ---------------------------------------------- |
| `sortColumn`   | `string \| null`                                        | The column id currently sorted by (controlled) |
| `sortOrder`    | `Gtk.SortType`                                          | `ASCENDING` or `DESCENDING`                    |
| `onSortChange` | `(column: string \| null, order: Gtk.SortType) => void` | Called when user clicks column headers         |

### GtkColumnView.Column Props

| Prop         | Type                                | Description                                    |
| ------------ | ----------------------------------- | ---------------------------------------------- |
| `id`         | `string`                            | Column identifier (required for sorting)       |
| `title`      | `string`                            | Column header text                             |
| `renderCell` | `(item: T \| null) => ReactElement` | Renders the cell content                       |
| `expand`     | `boolean`                           | Whether the column should expand to fill space |
| `resizable`  | `boolean`                           | Whether the column can be resized              |
| `fixedWidth` | `number`                            | Fixed width in pixels                          |

## DropDown

`DropDown` creates a selection dropdown using simple id/label pairs:

```tsx
import { GtkDropDown, GtkLabel } from "@gtkx/react";
import { useState } from "react";

interface Country {
  id: string;
  name: string;
  capital: string;
}

const countries: Country[] = [
  { id: "us", name: "United States", capital: "Washington D.C." },
  { id: "uk", name: "United Kingdom", capital: "London" },
  { id: "jp", name: "Japan", capital: "Tokyo" },
];

const CountrySelector = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = countries.find((c) => c.id === selectedId);

  return (
    <>
      <GtkDropDown.Root
        selectedId={selectedId ?? undefined}
        onSelectionChanged={(id) => setSelectedId(id)}
      >
        {countries.map((country) => (
          <GtkDropDown.Item key={country.id} id={country.id} label={country.name} />
        ))}
      </GtkDropDown.Root>

      {selected && <GtkLabel label={`Capital: ${selected.capital}`} />}
    </>
  );
};
```

### GtkDropDown.Root Props

| Prop                 | Type                 | Description                                       |
| -------------------- | -------------------- | ------------------------------------------------- |
| `selectedId`         | `string`             | ID of the initially selected item                 |
| `onSelectionChanged` | `(id: string) => void` | Called when selection changes with the item's ID |

### GtkDropDown.Item Props

| Prop    | Type     | Description                           |
| ------- | -------- | ------------------------------------- |
| `id`    | `string` | Unique identifier for this item       |
| `label` | `string` | Display text shown in the dropdown    |

## Dynamic Updates

List items respond to React state changes:

```tsx
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkListView, GtkBox, GtkButton, GtkLabel, GtkScrolledWindow } from "@gtkx/react";
import { useState } from "react";

interface User {
  id: string;
  name: string;
}

const UserListWithRemove = () => {
  const [users, setUsers] = useState<User[]>([
    { id: "1", name: "Alice" },
    { id: "2", name: "Bob" },
  ]);

  const removeUser = (id: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
  };

  return (
    <GtkScrolledWindow vexpand>
      <GtkListView.Root
        renderItem={(user: User | null) => (
          <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={8}>
            <GtkLabel label={user?.name ?? ""} hexpand />
            <GtkButton
              label="Remove"
              onClicked={() => user && removeUser(user.id)}
            />
          </GtkBox>
        )}
      >
        {users.map((user) => (
          <GtkListView.Item key={user.id} id={user.id} item={user} />
        ))}
      </GtkListView.Root>
    </GtkScrolledWindow>
  );
};
```

## When to Use Lists vs Array Mapping

**Use `GtkListView`/`GtkGridView` when:**

- Rendering many items (100+)
- Items have uniform height/size
- You need virtualization for performance

**Use standard array mapping when:**

- Rendering few items (fewer than 50)
- Items have varying sizes
- You need complex conditional rendering per item

```tsx
// Standard React pattern - fine for small lists
<GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4}>
  {items.map(item => (
    <GtkLabel key={item.id} label={item.name} />
  ))}
</GtkBox>

// GTKX GtkListView - better for large lists
<GtkScrolledWindow vexpand>
  <GtkListView.Root
    renderItem={(item: Item | null) => (
      <GtkLabel label={item?.name ?? ""} />
    )}
  >
    {items.map(item => (
      <GtkListView.Item key={item.id} id={item.id} item={item} />
    ))}
  </GtkListView.Root>
</GtkScrolledWindow>
```
