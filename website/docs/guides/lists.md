---
sidebar_position: 2
---

# Lists and Data Binding

GTKX provides virtualized list components that efficiently render large datasets. Unlike React's standard array mapping, these use GTK's native list infrastructure with factory-based rendering.

## ListView

`ListView` renders a scrollable, virtualized list of items:

```tsx
import { ListView, Label } from "@gtkx/react";

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
  <ListView.Root renderItem={(user: User) => (
    <Label.Root label={user.name} />
  )}>
    {users.map(user => (
      <ListView.Item key={user.id} item={user} />
    ))}
  </ListView.Root>
);
```

### How It Works

1. **`ListView.Root`** creates a `GtkListView` with a `SignalListItemFactory`
2. **`ListView.Item`** registers each data item with the internal model
3. **`renderItem`** is called by GTK's factory system to render visible items
4. Items outside the viewport are not rendered (virtualization)

### Key Props

| Prop | Type | Description |
|------|------|-------------|
| `renderItem` | `(item: T) => ReactElement` | Required. Returns the widget to display for each item |

## GridView

`GridView` renders items in a grid layout with automatic wrapping:

```tsx
import { GridView, Box, Label, Image } from "@gtkx/react";
import { Orientation } from "@gtkx/ffi/gtk";

interface Photo {
  id: string;
  title: string;
  thumbnail: string;
}

const PhotoGrid = ({ photos }: { photos: Photo[] }) => (
  <GridView.Root renderItem={(photo: Photo) => (
    <Box orientation={Orientation.VERTICAL} spacing={4}>
      <Image.Root file={photo.thumbnail} />
      <Label.Root label={photo.title} />
    </Box>
  )}>
    {photos.map(photo => (
      <GridView.Item key={photo.id} item={photo} />
    ))}
  </GridView.Root>
);
```

## DropDown

`DropDown` creates a selection dropdown with custom item rendering:

```tsx
import { DropDown, Label } from "@gtkx/react";
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
  const [selected, setSelected] = useState<Country | null>(null);

  return (
    <>
      <DropDown.Root
        itemLabel={(country: Country) => country.name}
        onSelectionChanged={(country: Country) => setSelected(country)}
      >
        {countries.map(country => (
          <DropDown.Item key={country.id} item={country} />
        ))}
      </DropDown.Root>

      {selected && (
        <Label.Root label={`Capital: ${selected.capital}`} />
      )}
    </>
  );
};
```

### DropDown Props

| Prop | Type | Description |
|------|------|-------------|
| `itemLabel` | `(item: T) => string` | Required. Returns the display text for each item |
| `onSelectionChanged` | `(item: T, index: number) => void` | Called when selection changes |

## Dynamic Updates

List items respond to React state changes:

```tsx
const [users, setUsers] = useState<User[]>([]);

const addUser = (user: User) => {
  setUsers(prev => [...prev, user]);
};

const removeUser = (id: string) => {
  setUsers(prev => prev.filter(u => u.id !== id));
};

// Items automatically update in the list
<ListView.Root renderItem={(user: User) => (
  <Box orientation={Orientation.HORIZONTAL} spacing={8}>
    <Label.Root label={user.name} hexpand />
    <Button label="Remove" onClicked={() => removeUser(user.id)} />
  </Box>
)}>
  {users.map(user => (
    <ListView.Item key={user.id} item={user} />
  ))}
</ListView.Root>
```

## When to Use Lists vs Array Mapping

**Use `ListView`/`GridView` when:**
- Rendering many items (100+)
- Items have uniform height/size
- You need virtualization for performance

**Use standard array mapping when:**
- Rendering few items (fewer than 50)
- Items have varying sizes
- You need complex conditional rendering per item

```tsx
// Standard React pattern - fine for small lists
<Box orientation={Orientation.VERTICAL}>
  {items.map(item => (
    <Label.Root key={item.id} label={item.name} />
  ))}
</Box>

// GTKX ListView - better for large lists
<ListView.Root renderItem={(item) => <Label.Root label={item.name} />}>
  {items.map(item => (
    <ListView.Item key={item.id} item={item} />
  ))}
</ListView.Root>
```

## ColumnView (Tables)

For tabular data with multiple columns, use `ColumnView`:

```tsx
import { ColumnView, Label } from "@gtkx/react";

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
}

const ProductTable = ({ products }: { products: Product[] }) => (
  <ColumnView.Root renderItem={(product: Product) => (
    // This renders the row content
    <Label.Root label={product.name} />
  )}>
    {products.map(product => (
      <ColumnView.Item key={product.id} item={product} />
    ))}
  </ColumnView.Root>
);
```
