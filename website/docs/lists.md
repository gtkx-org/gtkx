# Lists

GTKX provides several list components for different use cases, from simple static lists to high-performance virtualized collections.

## Choosing a List Component

| Component | Use Case | Virtual Scrolling |
|-----------|----------|-------------------|
| `ListView` | Large lists (1000+ items) | Yes |
| `GridView` | Photo galleries, icon grids | Yes |
| `ColumnView` | Data tables with sorting | Yes |
| `TreeListView` | Hierarchical data, file trees | Yes |
| `GtkDropDown` | Small selection lists | No |
| `GtkListBox` | Medium lists, complex rows | No |
| `GtkFlowBox` | Tag clouds, reflowing grids | No |

## ListView

High-performance virtualized list for large datasets. Only visible items are rendered.

```tsx
import { ListView, ListItem, GtkBox, GtkLabel, GtkScrolledWindow } from "@gtkx/react";
import * as Gtk from "@gtkx/ffi/gtk";

interface Contact {
    id: string;
    name: string;
    email: string;
}

const contacts: Contact[] = [
    { id: "1", name: "Alice Johnson", email: "alice@example.com" },
    { id: "2", name: "Bob Smith", email: "bob@example.com" },
    // ... hundreds more
];

const ContactList = () => (
    <GtkScrolledWindow vexpand>
        <ListView
            renderItem={(contact: Contact | null) => (
                <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                    <GtkLabel label={contact?.name ?? ""} hexpand halign={Gtk.Align.START} />
                    <GtkLabel label={contact?.email ?? ""} cssClasses={["dim-label"]} />
                </GtkBox>
            )}
        >
            {contacts.map((contact) => (
                <ListItem key={contact.id} id={contact.id} value={contact} />
            ))}
        </ListView>
    </GtkScrolledWindow>
);
```

### Selection

```tsx
const [selected, setSelected] = useState<string[]>([]);

<ListView
    selectionMode={Gtk.SelectionMode.MULTIPLE}
    selected={selected}
    onSelectionChanged={setSelected}
    renderItem={(item) => item?.name ?? ""}
>
    {items.map((item) => (
        <ListItem key={item.id} id={item.id} value={item} />
    ))}
</ListView>
```

## GridView

Grid layout with virtual scrolling. Ideal for photo galleries and icon views.

```tsx
import { GridView, ListItem, GtkBox, GtkLabel, GtkScrolledWindow } from "@gtkx/react";
import { css } from "@gtkx/css";

interface Photo {
    id: string;
    title: string;
    color: string;
}

const photoTile = (color: string) => css`
    background: ${color};
    border-radius: 8px;
`;

const PhotoGallery = ({ photos }: { photos: Photo[] }) => (
    <GtkScrolledWindow vexpand hexpand>
        <GridView
            minColumns={2}
            maxColumns={6}
            renderItem={(photo: Photo | null) => (
                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4}>
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0} heightRequest={100} cssClasses={[photoTile(photo?.color ?? "#ccc")]} />
                    {photo?.title ?? ""}
                </GtkBox>
            )}
        >
            {photos.map((photo) => (
                <ListItem key={photo.id} id={photo.id} value={photo} />
            ))}
        </GridView>
    </GtkScrolledWindow>
);
```

## ColumnView

Data table with sortable, resizable columns.

```tsx
import { GtkColumnView, ColumnViewColumn, ListItem, GtkLabel, GtkScrolledWindow } from "@gtkx/react";
import * as Gtk from "@gtkx/ffi/gtk";
import { useState } from "react";

interface Employee {
    id: string;
    name: string;
    department: string;
    salary: number;
}

const EmployeeTable = ({ employees }: { employees: Employee[] }) => {
    const [sortColumn, setSortColumn] = useState<string | null>("name");
    const [sortOrder, setSortOrder] = useState<Gtk.SortType>(Gtk.SortType.ASCENDING);

    const handleSortChange = (column: string | null, order: Gtk.SortType) => {
        setSortColumn(column);
        setSortOrder(order);
    };

    const sortedEmployees = [...employees].sort((a, b) => {
        if (!sortColumn) return 0;
        const aVal = a[sortColumn as keyof Employee];
        const bVal = b[sortColumn as keyof Employee];
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return sortOrder === Gtk.SortType.ASCENDING ? cmp : -cmp;
    });

    return (
        <GtkScrolledWindow vexpand hexpand>
            <GtkColumnView sortColumn={sortColumn} sortOrder={sortOrder} onSortChange={handleSortChange}>
                <ColumnViewColumn
                    id="name"
                    title="Name"
                    expand
                    resizable
                    sortable
                    renderCell={(emp: Employee | null) => (
                        <GtkLabel label={emp?.name ?? ""} halign={Gtk.Align.START} />
                    )}
                />
                <ColumnViewColumn
                    id="department"
                    title="Department"
                    resizable
                    sortable
                    renderCell={(emp: Employee | null) => (
                        <GtkLabel label={emp?.department ?? ""} halign={Gtk.Align.START} />
                    )}
                />
                <ColumnViewColumn
                    id="salary"
                    title="Salary"
                    resizable
                    sortable
                    renderCell={(emp: Employee | null) => (
                        <GtkLabel label={emp ? `$${emp.salary.toLocaleString()}` : ""} halign={Gtk.Align.END} />
                    )}
                />
                {sortedEmployees.map((emp) => (
                    <ListItem key={emp.id} id={emp.id} value={emp} />
                ))}
            </GtkColumnView>
        </GtkScrolledWindow>
    );
};
```

## DropDown

Simple selection from a small list.

```tsx
import { GtkDropDown, SimpleListItem, GtkBox, GtkLabel } from "@gtkx/react";
import { useState } from "react";

const frameworks = [
    { id: "react", name: "React" },
    { id: "vue", name: "Vue" },
    { id: "angular", name: "Angular" },
    { id: "svelte", name: "Svelte" },
];

const FrameworkSelector = () => {
    const [selectedId, setSelectedId] = useState<string | null>("react");

    return (
        <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
            Framework:
            <GtkDropDown selectedId={selectedId} onSelectionChanged={setSelectedId}>
                {frameworks.map((fw) => (
                    <SimpleListItem key={fw.id} id={fw.id} value={fw.name} />
                ))}
            </GtkDropDown>
        </GtkBox>
    );
};
```

## ListBox

For medium-sized lists with complex row content.

```tsx
import { GtkListBox, GtkBox, GtkCheckButton, GtkLabel, GtkButton } from "@gtkx/react";
import * as Gtk from "@gtkx/ffi/gtk";

const TaskList = ({ tasks, onToggle, onDelete }) => (
    <GtkListBox selectionMode={Gtk.SelectionMode.NONE} cssClasses={["boxed-list"]}>
        {tasks.map((task) => (
            <GtkBox key={task.id} orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                <GtkCheckButton active={task.completed} onToggled={() => onToggle(task.id)} />
                <GtkLabel label={task.title} hexpand halign={Gtk.Align.START} />
                <GtkButton label="Delete" cssClasses={["flat"]} onClicked={() => onDelete(task.id)} />
            </GtkBox>
        ))}
    </GtkListBox>
);
```

## FlowBox

Responsive grid that reflows based on available width.

```tsx
import { GtkFlowBox, GtkLabel, GtkScrolledWindow } from "@gtkx/react";
import { css } from "@gtkx/css";
import * as Gtk from "@gtkx/ffi/gtk";

const tagStyle = css`
    background: @theme_selected_bg_color;
    color: @theme_selected_fg_color;
    padding: 4px 8px;
    border-radius: 4px;
`;

const TagCloud = ({ tags }: { tags: string[] }) => (
    <GtkScrolledWindow>
        <GtkFlowBox
            selectionMode={Gtk.SelectionMode.NONE}
            maxChildrenPerLine={8}
            minChildrenPerLine={2}
            columnSpacing={8}
            rowSpacing={8}
        >
            {tags.map((tag, i) => (
                <GtkLabel key={i} label={tag} cssClasses={[tagStyle]} />
            ))}
        </GtkFlowBox>
    </GtkScrolledWindow>
);
```

## TreeListView

Hierarchical tree display with expand/collapse functionality and virtual scrolling. Use for file browsers, settings panels, or any nested data structure.

```tsx
import { TreeListView, TreeListItem, GtkBox, GtkLabel, GtkImage, GtkScrolledWindow } from "@gtkx/react";
import * as Gtk from "@gtkx/ffi/gtk";

interface Category {
    type: "category";
    id: string;
    name: string;
    icon: string;
}

interface Setting {
    type: "setting";
    id: string;
    title: string;
}

type TreeItem = Category | Setting;

interface CategoryWithChildren extends Category {
    children: Setting[];
}

const categories: CategoryWithChildren[] = [
    {
        type: "category",
        id: "appearance",
        name: "Appearance",
        icon: "preferences-desktop-appearance-symbolic",
        children: [
            { type: "setting", id: "dark-mode", title: "Dark Mode" },
            { type: "setting", id: "animations", title: "Animations" },
        ],
    },
    {
        type: "category",
        id: "privacy",
        name: "Privacy",
        icon: "preferences-system-privacy-symbolic",
        children: [
            { type: "setting", id: "location", title: "Location Services" },
            { type: "setting", id: "camera", title: "Camera Access" },
        ],
    },
];

const SettingsTree = () => (
    <GtkScrolledWindow vexpand>
        <TreeListView
            renderItem={(item: TreeItem | null) => {
                if (!item) return <GtkLabel label="Loading..." />;

                if (item.type === "category") {
                    return (
                        <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                            <GtkImage iconName={item.icon} pixelSize={20} />
                            <GtkLabel label={item.name} cssClasses={["heading"]} />
                        </GtkBox>
                    );
                }

                return <GtkLabel label={item.title} />;
            }}
        >
            {categories.map((category) => (
                <TreeListItem key={category.id} id={category.id} value={category as TreeItem}>
                    {category.children.map((setting) => (
                        <TreeListItem
                            key={setting.id}
                            id={setting.id}
                            value={setting as TreeItem}
                            hideExpander
                        />
                    ))}
                </TreeListItem>
            ))}
        </TreeListView>
    </GtkScrolledWindow>
);
```

### Selection

```tsx
const [selected, setSelected] = useState<string[]>([]);

<TreeListView
    selectionMode={Gtk.SelectionMode.SINGLE}
    selected={selected}
    onSelectionChanged={setSelected}
    renderItem={(item, row) => (
        <GtkLabel label={item?.name ?? ""} />
    )}
>
    {items.map((item) => (
        <TreeListItem key={item.id} id={item.id} value={item}>
            {item.children?.map((child) => (
                <TreeListItem key={child.id} id={child.id} value={child} />
            ))}
        </TreeListItem>
    ))}
</TreeListView>
```

## Performance Tips

1. **Use virtualized lists** (`ListView`, `GridView`, `ColumnView`, `TreeListView`) for large datasets
2. **Wrap in ScrolledWindow** for scrolling support
3. **Memoize renderItem** with `useCallback` if it has dependencies
4. **Use stable keys** — the `id` prop should be unique and stable
5. **Avoid inline objects** in `value` prop when possible
