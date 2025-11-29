---
sidebar_position: 4
---

# Working with Lists

This guide covers how to display and manage lists of data in GTKX applications.

## List Components

GTKX provides several components for displaying lists:

| Component | Use Case |
|-----------|----------|
| `ListBox` | Simple selectable lists |
| `ListView` | Large virtualized lists |
| `DropDown` | Dropdown selection |

## ListBox

For simple lists where you control the content:

```tsx
import * as Gtk from "@gtkx/ffi/gtk";

<ListBox selectionMode={Gtk.SelectionMode.SINGLE}>
  <ListBoxRow>
    <Label.Root label="Item 1" />
  </ListBoxRow>
  <ListBoxRow>
    <Label.Root label="Item 2" />
  </ListBoxRow>
</ListBox>
```

### Selection Modes

```tsx
import * as Gtk from "@gtkx/ffi/gtk";

<ListBox selectionMode={Gtk.SelectionMode.NONE} />     // No selection
<ListBox selectionMode={Gtk.SelectionMode.SINGLE} />   // Single selection
<ListBox selectionMode={Gtk.SelectionMode.MULTIPLE} /> // Multiple selection
```

### Dynamic Lists

Generate rows from data using map:

```tsx
const items = [
  { id: 1, name: "Apple" },
  { id: 2, name: "Banana" },
  { id: 3, name: "Cherry" },
];

<ListBox selectionMode={Gtk.SelectionMode.SINGLE}>
  {items.map(item => (
    <ListBoxRow key={item.id}>
      <Label.Root label={item.name} marginStart={10} />
    </ListBoxRow>
  ))}
</ListBox>
```

## ListView

For large lists with virtualization. ListView uses an item factory pattern for performance:

```tsx
import * as Gtk from "@gtkx/ffi/gtk";

const [items, setItems] = useState([
  { id: 1, text: "Task 1" },
  { id: 2, text: "Task 2" },
  { id: 3, text: "Task 3" },
]);

<ScrolledWindow vexpand hexpand>
  <ListView.Root
    vexpand
    renderItem={(item: { id: number; text: string } | null) => {
      const box = new Gtk.Box();
      const label = new Gtk.Label();
      label.setLabel(item?.text ?? "");
      box.append(label);
      box.setMarginStart(10);
      box.setMarginEnd(10);
      return box;
    }}
  >
    {items.map(item => (
      <ListView.Item item={item} key={item.id} />
    ))}
  </ListView.Root>
</ScrolledWindow>
```

The `renderItem` function:
- Receives the item data (typed as `T`, or null during initialization)
- Must return a `Gtk.Widget` instance
- Is called for each visible item
- Uses imperative widget construction via the FFI

## DropDown

For dropdown selection with typed items:

```tsx
type Option = { id: number; label: string };

const options: Option[] = [
  { id: 1, label: "Option 1" },
  { id: 2, label: "Option 2" },
  { id: 3, label: "Option 3" },
];

const [selected, setSelected] = useState<Option | null>(null);

<DropDown.Root
  hexpand
  itemLabel={(item: Option) => item.label}
  onSelectionChanged={(item: Option) => setSelected(item)}
>
  {options.map(option => (
    <DropDown.Item key={option.id} item={option} />
  ))}
</DropDown.Root>
```

### Props

- `itemLabel`: Function to convert item to display string
- `onSelectionChanged`: Called when selection changes with the selected item

## Adding and Removing Items

Use React state to manage list data:

```tsx
const [items, setItems] = useState([
  { id: 1, text: "Item 1" },
]);

const addItem = () => {
  setItems(prev => [
    ...prev,
    { id: Date.now(), text: `Item ${prev.length + 1}` }
  ]);
};

const removeItem = (id: number) => {
  setItems(prev => prev.filter(item => item.id !== id));
};
```

## Scrolling

Wrap lists in ScrolledWindow for scrollable content:

```tsx
<ScrolledWindow vexpand hexpand minContentHeight={200}>
  <ListBox>
    {/* Items */}
  </ListBox>
</ScrolledWindow>
```

## Best Practices

### Always Use Keys

Provide unique `key` props when mapping arrays:

```tsx
{items.map(item => (
  <ListBoxRow key={item.id}>  {/* Use a stable unique ID */}
    <Label.Root label={item.name} />
  </ListBoxRow>
))}
```

### Choose the Right Component

- **ListBox**: Small to medium lists, rich row content, selection handling
- **ListView**: Large lists (100+ items), virtualization needed, simple item rendering

### Handle Empty States

```tsx
{items.length === 0 ? (
  <Label.Root label="No items" cssClasses={["dim-label"]} />
) : (
  <ListBox>
    {items.map(item => /* ... */)}
  </ListBox>
)}
```
