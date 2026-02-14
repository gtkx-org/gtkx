import * as Gtk from "@gtkx/ffi/gtk";
import {
    AdwPreferencesGroup,
    GtkBox,
    GtkColumnView,
    GtkDropDown,
    GtkFrame,
    GtkGridView,
    GtkLabel,
    GtkListView,
    GtkScrolledWindow,
    x,
} from "@gtkx/react";
import { type ReactNode, useCallback, useMemo, useState } from "react";

type Person = {
    name: string;
    email: string;
    role: string;
    salary: number;
};

type SortColumn = "name" | "email" | "role" | "salary" | null;

type FileItem = {
    name: string;
    isFolder: boolean;
};

const people: Person[] = [
    { name: "Alice Johnson", email: "alice@example.com", role: "Developer", salary: 95000 },
    { name: "Bob Smith", email: "bob@example.com", role: "Designer", salary: 85000 },
    { name: "Charlie Brown", email: "charlie@example.com", role: "Manager", salary: 120000 },
    { name: "Diana Ross", email: "diana@example.com", role: "Developer", salary: 92000 },
    { name: "Eve Wilson", email: "eve@example.com", role: "QA Engineer", salary: 78000 },
    { name: "Frank Miller", email: "frank@example.com", role: "Developer", salary: 105000 },
    { name: "Grace Lee", email: "grace@example.com", role: "Designer", salary: 88000 },
    { name: "Henry Chen", email: "henry@example.com", role: "Manager", salary: 115000 },
];

const files: FileItem[] = [
    { name: "Documents", isFolder: true },
    { name: "Pictures", isFolder: true },
    { name: "readme.txt", isFolder: false },
    { name: "report.pdf", isFolder: false },
    { name: "notes.md", isFolder: false },
];

const ColumnMenu = ({
    column,
    onSort,
    children,
}: {
    column: SortColumn;
    onSort: (column: string | null, order: Gtk.SortType) => void;
    children?: ReactNode;
}) => (
    <>
        <x.MenuSection>
            <x.MenuItem
                id="sort-asc"
                label="Sort Ascending"
                onActivate={() => onSort(column, Gtk.SortType.ASCENDING)}
            />
            <x.MenuItem
                id="sort-desc"
                label="Sort Descending"
                onActivate={() => onSort(column, Gtk.SortType.DESCENDING)}
            />
            <x.MenuItem id="sort-clear" label="Clear Sort" onActivate={() => onSort(null, Gtk.SortType.ASCENDING)} />
        </x.MenuSection>
        {children}
    </>
);

export const ListDemo = () => {
    const [sortColumn, setSortColumn] = useState<SortColumn>(null);
    const [sortOrder, setSortOrder] = useState<Gtk.SortType>(Gtk.SortType.ASCENDING);
    const [hiddenColumns, setHiddenColumns] = useState<Set<SortColumn>>(new Set());

    const handleSortChange = useCallback((column: string | null, order: Gtk.SortType) => {
        setSortColumn(column as SortColumn);
        setSortOrder(order);
    }, []);

    const sortedPeople = useMemo(() => {
        if (!sortColumn) return people;

        return [...people].sort((a, b) => {
            let comparison = 0;
            switch (sortColumn) {
                case "name":
                    comparison = a.name.localeCompare(b.name);
                    break;
                case "email":
                    comparison = a.email.localeCompare(b.email);
                    break;
                case "role":
                    comparison = a.role.localeCompare(b.role);
                    break;
                case "salary":
                    comparison = a.salary - b.salary;
                    break;
            }
            return sortOrder === Gtk.SortType.ASCENDING ? comparison : -comparison;
        });
    }, [sortColumn, sortOrder]);

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={24}
            marginTop={24}
            marginBottom={24}
            marginStart={24}
            marginEnd={24}
        >
            <GtkLabel label="List Components" cssClasses={["title-1"]} halign={Gtk.Align.START} />

            <AdwPreferencesGroup title="x.ListItem" description="String-based items for DropDown and simple lists">
                <GtkFrame marginTop={12}>
                    <GtkBox
                        orientation={Gtk.Orientation.VERTICAL}
                        spacing={12}
                        marginTop={12}
                        marginBottom={12}
                        marginStart={12}
                        marginEnd={12}
                    >
                        <GtkLabel label="Select a fruit:" halign={Gtk.Align.START} />
                        <GtkDropDown>
                            <x.ListItem id="apple" value="Apple" />
                            <x.ListItem id="banana" value="Banana" />
                            <x.ListItem id="cherry" value="Cherry" />
                            <x.ListItem id="date" value="Date" />
                            <x.ListItem id="elderberry" value="Elderberry" />
                        </GtkDropDown>
                    </GtkBox>
                </GtkFrame>
            </AdwPreferencesGroup>

            <AdwPreferencesGroup title="GtkListView" description="Virtualized list with custom item rendering">
                <GtkFrame marginTop={12}>
                    <GtkScrolledWindow heightRequest={280} hscrollbarPolicy={Gtk.PolicyType.NEVER}>
                        <GtkListView
                            estimatedItemHeight={48}
                            renderItem={(item: FileItem | null) => (
                                <GtkBox spacing={12} marginTop={8} marginBottom={8} marginStart={8} marginEnd={8}>
                                    <GtkLabel label={item?.isFolder ? "folder-symbolic" : "text-x-generic-symbolic"} />
                                    <GtkLabel label={item?.name ?? ""} hexpand halign={Gtk.Align.START} />
                                </GtkBox>
                            )}
                        >
                            {files.map((file) => (
                                <x.ListItem key={file.name} id={file.name} value={file} />
                            ))}
                        </GtkListView>
                    </GtkScrolledWindow>
                </GtkFrame>
            </AdwPreferencesGroup>

            <AdwPreferencesGroup title="GtkGridView" description="Virtualized grid with custom item rendering">
                <GtkFrame marginTop={12}>
                    <GtkScrolledWindow heightRequest={280} hscrollbarPolicy={Gtk.PolicyType.NEVER}>
                        <GtkGridView
                            estimatedItemHeight={80}
                            renderItem={(item: FileItem | null) => (
                                <GtkBox
                                    orientation={Gtk.Orientation.VERTICAL}
                                    spacing={6}
                                    marginTop={12}
                                    marginBottom={12}
                                    marginStart={12}
                                    marginEnd={12}
                                    halign={Gtk.Align.CENTER}
                                >
                                    <GtkLabel
                                        label={item ? (item.isFolder ? "folder" : "file") : ""}
                                        cssClasses={["title-3"]}
                                    />
                                    <GtkLabel label={item?.name ?? ""} ellipsize={3} maxWidthChars={12} />
                                </GtkBox>
                            )}
                        >
                            {files.map((file) => (
                                <x.ListItem key={file.name} id={file.name} value={file} />
                            ))}
                        </GtkGridView>
                    </GtkScrolledWindow>
                </GtkFrame>
            </AdwPreferencesGroup>

            <AdwPreferencesGroup
                title="GtkListView (Tree)"
                description="Hierarchical tree with expand/collapse using nested ListItems"
            >
                <GtkFrame marginTop={12}>
                    <GtkScrolledWindow heightRequest={320} hscrollbarPolicy={Gtk.PolicyType.NEVER}>
                        <GtkListView
                            estimatedItemHeight={32}
                            autoexpand
                            renderItem={(item: { name: string } | null) => (
                                <GtkLabel
                                    label={item?.name ?? ""}
                                    halign={Gtk.Align.START}
                                    marginTop={4}
                                    marginBottom={4}
                                />
                            )}
                        >
                            <x.ListItem id="src" value={{ name: "src" }}>
                                <x.ListItem id="components" value={{ name: "components" }}>
                                    <x.ListItem id="button" value={{ name: "Button.tsx" }} />
                                    <x.ListItem id="input" value={{ name: "Input.tsx" }} />
                                    <x.ListItem id="modal" value={{ name: "Modal.tsx" }} />
                                </x.ListItem>
                                <x.ListItem id="utils" value={{ name: "utils" }}>
                                    <x.ListItem id="helpers" value={{ name: "helpers.ts" }} />
                                    <x.ListItem id="constants" value={{ name: "constants.ts" }} />
                                </x.ListItem>
                                <x.ListItem id="app" value={{ name: "App.tsx" }} />
                                <x.ListItem id="index" value={{ name: "index.tsx" }} />
                            </x.ListItem>
                            <x.ListItem id="public" value={{ name: "public" }}>
                                <x.ListItem id="favicon" value={{ name: "favicon.ico" }} />
                                <x.ListItem id="index-html" value={{ name: "index.html" }} />
                            </x.ListItem>
                            <x.ListItem id="package" value={{ name: "package.json" }} />
                            <x.ListItem id="readme" value={{ name: "README.md" }} />
                        </GtkListView>
                    </GtkScrolledWindow>
                </GtkFrame>
            </AdwPreferencesGroup>

            <AdwPreferencesGroup
                title="x.ColumnViewColumn"
                description="Table columns with header menus, sorting, and hide/show (right-click header)"
            >
                <GtkFrame marginTop={12}>
                    <GtkScrolledWindow heightRequest={350} hscrollbarPolicy={Gtk.PolicyType.NEVER}>
                        <GtkColumnView
                            estimatedRowHeight={48}
                            sortColumn={sortColumn}
                            sortOrder={sortOrder}
                            onSortChanged={handleSortChange}
                        >
                            <x.ColumnViewColumn
                                id="name"
                                title="Name"
                                expand
                                sortable
                                renderCell={(item: Person | null) => (
                                    <GtkLabel
                                        label={item?.name ?? ""}
                                        halign={Gtk.Align.START}
                                        marginTop={8}
                                        marginBottom={8}
                                        marginStart={8}
                                        marginEnd={8}
                                    />
                                )}
                            >
                                <ColumnMenu column="name" onSort={handleSortChange} />
                            </x.ColumnViewColumn>
                            {!hiddenColumns.has("role") && (
                                <x.ColumnViewColumn
                                    id="role"
                                    title="Role"
                                    fixedWidth={100}
                                    sortable
                                    renderCell={(item: Person | null) => (
                                        <GtkLabel
                                            label={item?.role ?? ""}
                                            halign={Gtk.Align.START}
                                            marginTop={8}
                                            marginBottom={8}
                                            marginStart={8}
                                            marginEnd={8}
                                        />
                                    )}
                                >
                                    <ColumnMenu column="role" onSort={handleSortChange}>
                                        <x.MenuSection>
                                            <x.MenuItem
                                                id="hide"
                                                label="Hide Column"
                                                onActivate={() => setHiddenColumns((s) => new Set(s).add("role"))}
                                            />
                                        </x.MenuSection>
                                    </ColumnMenu>
                                </x.ColumnViewColumn>
                            )}
                            {!hiddenColumns.has("salary") && (
                                <x.ColumnViewColumn
                                    id="salary"
                                    title="Salary"
                                    fixedWidth={100}
                                    sortable
                                    renderCell={(item: Person | null) => (
                                        <GtkLabel
                                            label={item ? `$${item.salary.toLocaleString()}` : ""}
                                            halign={Gtk.Align.END}
                                            marginTop={8}
                                            marginBottom={8}
                                            marginStart={8}
                                            marginEnd={8}
                                        />
                                    )}
                                >
                                    <ColumnMenu column="salary" onSort={handleSortChange}>
                                        <x.MenuSection>
                                            <x.MenuItem
                                                id="hide"
                                                label="Hide Column"
                                                onActivate={() => setHiddenColumns((s) => new Set(s).add("salary"))}
                                            />
                                        </x.MenuSection>
                                    </ColumnMenu>
                                </x.ColumnViewColumn>
                            )}
                            {sortedPeople.map((person) => (
                                <x.ListItem key={person.email} id={person.email} value={person} />
                            ))}
                        </GtkColumnView>
                    </GtkScrolledWindow>
                </GtkFrame>
                <GtkLabel
                    label={`Sorting: ${sortColumn ? `${sortColumn} (${sortOrder === Gtk.SortType.ASCENDING ? "asc" : "desc"})` : "none"}${hiddenColumns.size > 0 ? ` · Hidden: ${[...hiddenColumns].join(", ")}` : ""}`}
                    cssClasses={["dim-label", "monospace"]}
                    marginTop={8}
                />
            </AdwPreferencesGroup>
        </GtkBox>
    );
};
