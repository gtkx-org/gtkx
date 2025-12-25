---
sidebar_position: 7
---

# Lists

GTKX provides virtualized list components for efficiently rendering large datasets using GTK's native list infrastructure.

## ListView

Render a scrollable, virtualized list:

```tsx
import { ListView, ListItem, GtkLabel, GtkScrolledWindow } from '@gtkx/react';
import * as Gtk from '@gtkx/ffi/gtk';

interface User {
    id: string;
    name: string;
    email: string;
}

const users: User[] = [
    { id: '1', name: 'Alice', email: 'alice@example.com' },
    { id: '2', name: 'Bob', email: 'bob@example.com' },
];

function UserList() {
    return (
        <GtkScrolledWindow vexpand>
            <ListView<User>
                renderItem={(user) => (
                    <GtkLabel
                        label={user?.name ?? ''}
                        halign={Gtk.Align.START}
                    />
                )}
            >
                {users.map(user => (
                    <ListItem key={user.id} id={user.id} value={user} />
                ))}
            </ListView>
        </GtkScrolledWindow>
    );
}
```

### How It Works

1. **ListView** creates a `GtkListView` with a signal list item factory
2. **ListItem** registers data items with the internal model (virtual node)
3. **renderItem** is called during the bind phase to render each visible item
4. Items outside the viewport are not rendered (virtualization)

### renderItem Signature

```typescript
renderItem: (item: T | null) => ReactElement
```

The function receives:
- `null` during the setup phase (create placeholder)
- The actual item during the bind phase

Always handle the `null` case:

```tsx
renderItem={(user) => (
    <GtkLabel label={user?.name ?? ''} />
)}
```

## GridView

Render items in a wrapping grid:

```tsx
import { GridView, ListItem, GtkLabel, GtkScrolledWindow } from '@gtkx/react';

interface Photo {
    id: string;
    title: string;
    thumbnail: string;
}

function PhotoGrid({ photos }: { photos: Photo[] }) {
    return (
        <GtkScrolledWindow vexpand>
            <GridView<Photo>
                renderItem={(photo) => (
                    <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                        <GtkPicture filename={photo?.thumbnail ?? ''} />
                        <GtkLabel label={photo?.title ?? ''} />
                    </GtkBox>
                )}
            >
                {photos.map(photo => (
                    <ListItem key={photo.id} id={photo.id} value={photo} />
                ))}
            </GridView>
        </GtkScrolledWindow>
    );
}
```

## ColumnView

Render tabular data with multiple columns:

```tsx
import {
    GtkColumnView,
    ColumnViewColumn,
    ListItem,
    GtkLabel,
    GtkScrolledWindow
} from '@gtkx/react';
import * as Gtk from '@gtkx/ffi/gtk';

interface Product {
    id: string;
    name: string;
    price: number;
    stock: number;
}

function ProductTable({ products }: { products: Product[] }) {
    return (
        <GtkScrolledWindow vexpand>
            <GtkColumnView>
                <ColumnViewColumn<Product>
                    title="Name"
                    id="name"
                    expand
                    renderCell={(product) => (
                        <GtkLabel
                            label={product?.name ?? ''}
                            halign={Gtk.Align.START}
                        />
                    )}
                />
                <ColumnViewColumn<Product>
                    title="Price"
                    id="price"
                    fixedWidth={100}
                    renderCell={(product) => (
                        <GtkLabel
                            label={product ? `$${product.price.toFixed(2)}` : ''}
                        />
                    )}
                />
                <ColumnViewColumn<Product>
                    title="Stock"
                    id="stock"
                    fixedWidth={80}
                    renderCell={(product) => (
                        <GtkLabel label={product?.stock.toString() ?? ''} />
                    )}
                />
                {products.map(product => (
                    <ListItem key={product.id} id={product.id} value={product} />
                ))}
            </GtkColumnView>
        </GtkScrolledWindow>
    );
}
```

### Column Props

| Prop | Type | Description |
|------|------|-------------|
| `id` | `string` | Column identifier (required for sorting) |
| `title` | `string` | Column header text |
| `renderCell` | `(item: T \| null) => ReactElement` | Renders cell content |
| `expand` | `boolean` | Column expands to fill space |
| `resizable` | `boolean` | Column can be resized |
| `fixedWidth` | `number` | Fixed width in pixels |
| `sortable` | `boolean` | Column header is clickable for sorting |

### Sorting

ColumnView supports user-initiated sorting. You must sort the data yourself based on the sort state:

```tsx
import { useState, useMemo } from 'react';
import * as Gtk from '@gtkx/ffi/gtk';

function SortableTable({ products }: { products: Product[] }) {
    const [sortColumn, setSortColumn] = useState<string | null>('name');
    const [sortOrder, setSortOrder] = useState(Gtk.SortType.ASCENDING);

    const sorted = useMemo(() => {
        if (!sortColumn) return products;

        const compare = (a: Product, b: Product) => {
            if (sortColumn === 'name') return a.name.localeCompare(b.name);
            if (sortColumn === 'price') return a.price - b.price;
            if (sortColumn === 'stock') return a.stock - b.stock;
            return 0;
        };

        const result = [...products].sort(compare);
        return sortOrder === Gtk.SortType.DESCENDING ? result.reverse() : result;
    }, [products, sortColumn, sortOrder]);

    return (
        <GtkColumnView
            sortColumn={sortColumn}
            sortOrder={sortOrder}
            onSortChange={(column, order) => {
                setSortColumn(column);
                setSortOrder(order);
            }}
        >
            <ColumnViewColumn<Product>
                id="name"
                title="Name"
                sortable
                expand
                renderCell={(p) => <GtkLabel label={p?.name ?? ''} />}
            />
            <ColumnViewColumn<Product>
                id="price"
                title="Price"
                sortable
                fixedWidth={100}
                renderCell={(p) => <GtkLabel label={p ? `$${p.price}` : ''} />}
            />
            {sorted.map(p => (
                <ListItem key={p.id} id={p.id} value={p} />
            ))}
        </GtkColumnView>
    );
}
```

## Selection

Handle selection with `selectedId` and `onSelectionChanged`:

```tsx
const [selected, setSelected] = useState<string | null>(null);

<ListView<User>
    selectedId={selected}
    onSelectionChanged={(id) => setSelected(id)}
    renderItem={(user) => <GtkLabel label={user?.name ?? ''} />}
>
    {users.map(u => <ListItem key={u.id} id={u.id} value={u} />)}
</ListView>
```

### Multi-Selection

Enable multiple selection with `selectionMode`:

```tsx
const [selected, setSelected] = useState<string[]>([]);

<ListView<User>
    selectionMode={Gtk.SelectionMode.MULTIPLE}
    selected={selected}
    onSelectionChanged={(ids) => setSelected(ids)}
    renderItem={(user) => <GtkLabel label={user?.name ?? ''} />}
>
    {users.map(u => <ListItem key={u.id} id={u.id} value={u} />)}
</ListView>
```

## DropDown

For simple string-based selection, use `GtkDropDown` with `SimpleListItem`:

```tsx
import { GtkDropDown, SimpleListItem } from '@gtkx/react';
import { useState } from 'react';

const countries = [
    { id: 'us', name: 'United States' },
    { id: 'uk', name: 'United Kingdom' },
    { id: 'jp', name: 'Japan' },
];

function CountryPicker() {
    const [selected, setSelected] = useState<string>('us');

    return (
        <GtkDropDown
            selectedId={selected}
            onSelectionChanged={setSelected}
        >
            {countries.map(c => (
                <SimpleListItem key={c.id} id={c.id} value={c.name} />
            ))}
        </GtkDropDown>
    );
}
```

### SimpleListItem vs ListItem

| Component | Use Case | Value Type |
|-----------|----------|------------|
| `ListItem` | ListView, GridView, ColumnView | Any object |
| `SimpleListItem` | DropDown, ComboRow | String (display text) |

## ListItem Props

| Prop | Type | Description |
|------|------|-------------|
| `id` | `string` | Unique identifier for selection |
| `value` | `T` | Data object passed to renderItem |
| `key` | `string` | React key (typically same as id) |

## Dynamic Updates

Lists respond to React state changes. Add, remove, or modify items:

```tsx
const [users, setUsers] = useState<User[]>(initialUsers);

const addUser = (user: User) => {
    setUsers(prev => [...prev, user]);
};

const removeUser = (id: string) => {
    setUsers(prev => prev.filter(u => u.id !== id));
};

<ListView<User>
    renderItem={(user) => (
        <GtkBox orientation={Gtk.Orientation.HORIZONTAL}>
            <GtkLabel label={user?.name ?? ''} hexpand />
            <GtkButton
                iconName="user-trash-symbolic"
                onClicked={() => user && removeUser(user.id)}
            />
        </GtkBox>
    )}
>
    {users.map(u => <ListItem key={u.id} id={u.id} value={u} />)}
</ListView>
```

## When to Use Lists

**Use ListView/GridView when:**
- Rendering many items (100+)
- Items have uniform height/size
- You need virtualization for performance

**Use standard array mapping when:**
- Rendering few items (fewer than 50)
- Items have varying sizes
- Complex conditional rendering per item

```tsx
// Standard React - fine for small lists
<GtkBox orientation={Gtk.Orientation.VERTICAL}>
    {items.map(item => (
        <GtkLabel key={item.id} label={item.name} />
    ))}
</GtkBox>

// ListView - better for large lists
<GtkScrolledWindow>
    <ListView<Item>
        renderItem={(item) => <GtkLabel label={item?.name ?? ''} />}
    >
        {items.map(item => (
            <ListItem key={item.id} id={item.id} value={item} />
        ))}
    </ListView>
</GtkScrolledWindow>
```

## FlowBox

For non-virtualized grids where items can have varying sizes:

```tsx
import { GtkFlowBox, GtkFlowBoxChild, GtkLabel } from '@gtkx/react';

<GtkFlowBox
    selectionMode={Gtk.SelectionMode.SINGLE}
    maxChildrenPerLine={4}
    minChildrenPerLine={2}
>
    {tags.map(tag => (
        <GtkFlowBoxChild key={tag.id}>
            <GtkLabel label={tag.name} cssClasses={['tag']} />
        </GtkFlowBoxChild>
    ))}
</GtkFlowBox>
```

FlowBox doesn't virtualize, so use it for smaller collections where items need to wrap naturally.
