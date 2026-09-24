import { ColumnView, type ColumnViewColumn, type ListItem, ListView } from "@gtkx/components";
import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { GMenu, GSettings, GSimpleAction, GSimpleActionGroup } from "@gtkx/jsx/gio";
import {
    GtkBox,
    GtkEditableLabel,
    GtkHeaderBar,
    GtkLabel,
    GtkPaned,
    GtkScrolledWindow,
    GtkSearchBar,
    GtkSearchEntry,
    GtkToggleButton,
} from "@gtkx/jsx/gtk";
import { createPortal, rootElement } from "@gtkx/react";
import { createContext, useCallback, useContext, useState } from "react";
import type { Demo, DemoProviderProps } from "../types.js";
import { collectExpandableIds } from "../../collect-expandable-ids.js";
import sourceCode from "./listview-settings.tsx?raw";

type KeyInfo = {
    name: string;
    value: string;
    defaultValue: string;
    type: string;
    summary: string;
    description: string;
};

type SchemaTreeNode = {
    nodeId: string;
    settings: Gio.Settings;
    schema: Gio.SettingsSchema;
    children: SchemaTreeNode[];
};

type ListViewSettingsState = ReturnType<typeof useListViewSettingsState>;
type ToggleableColumnId = "type" | "default" | "summary" | "description";

type ToggleableColumnSpec = {
    id: ToggleableColumnId;
    menuLabel: string;
    action: string;
};

type ColumnVisibility = Record<ToggleableColumnId, boolean>;

type KeyInfoColumnSpec = {
    id: ToggleableColumnId;
    title: string;
    isSortable: boolean;
    isExpanding: boolean;
    shouldWrap: boolean;
    getText: (keyInfo: KeyInfo) => string;
};

type CommitKeyInfoEditArgs = {
    keyInfo: KeyInfo;
    newText: string;
    widget: Gtk.EditableLabel;
    state: ListViewSettingsState;
};

type KeyEditContext = {
    keyInfo: KeyInfo;
    newText: string;
    widget: Gtk.EditableLabel;
    settings: Gio.Settings;
    schema: Gio.SettingsSchema;
    setKeyInfos: ListViewSettingsState["setKeyInfos"];
};

type SettingsColumnViewProps = {
    isKeySearchActive: boolean;
    keySearchText: string;
    onSearchChanged: (entry: Gtk.SearchEntry) => void;
    onStopSearch: () => void;
    filteredKeyInfos: KeyInfo[];
    onValueEdit: (keyInfo: KeyInfo, newText: string, widget: Gtk.EditableLabel) => void;
};

type SettingsColumnsProps = {
    columnVisibility: ColumnVisibility;
    onValueEdit: (keyInfo: KeyInfo, newText: string, widget: Gtk.EditableLabel) => void;
};

type SettingsContextValue = {
    state: ListViewSettingsState;
    handleValueEdit: (keyInfo: KeyInfo, newText: string, widget: Gtk.EditableLabel) => void;
};

const TOGGLEABLE_COLUMNS: ToggleableColumnSpec[] = [
    { id: "type", menuLabel: "Type", action: "show-type" },
    { id: "default", menuLabel: "Default value", action: "show-default" },
    { id: "summary", menuLabel: "Summary", action: "show-summary" },
    { id: "description", menuLabel: "Description", action: "show-description" },
];

const INITIAL_COLUMN_VISIBILITY: ColumnVisibility = {
    type: true,
    default: true,
    summary: false,
    description: false,
};

const KEY_INFO_COLUMNS: KeyInfoColumnSpec[] = [
    {
        id: "type",
        title: "Type",
        isSortable: true,
        isExpanding: false,
        shouldWrap: false,
        getText: (keyInfo) => keyInfo.type,
    },
    {
        id: "default",
        title: "Default",
        isSortable: false,
        isExpanding: true,
        shouldWrap: false,
        getText: (keyInfo) => keyInfo.defaultValue,
    },
    {
        id: "summary",
        title: "Summary",
        isSortable: false,
        isExpanding: true,
        shouldWrap: true,
        getText: (keyInfo) => keyInfo.summary,
    },
    {
        id: "description",
        title: "Description",
        isSortable: false,
        isExpanding: true,
        shouldWrap: true,
        getText: (keyInfo) => keyInfo.description,
    },
];

const columnVisibilityMenu = (
    <GMenu
        items={[
            {
                section: TOGGLEABLE_COLUMNS.map((column) => ({
                    label: column.menuLabel,
                    action: `columnview.${column.action}`,
                })),
            },
        ]}
    />
);

const SettingsContext = createContext<SettingsContextValue | null>(null);

const listviewSettingsDemo: Demo = {
    id: "listview-settings",
    title: "Lists/Settings",
    description:
        "This demo shows a settings viewer for GSettings.\n\nIt demonstrates how to implement support for " +
        "trees with GtkListView. It also shows how to set up sorting and filtering for columns in a " +
        "GtkColumnView.\n\nIt also demonstrates different styles of list. The tree on the left uses the " +
        ".navigation-sidebar style class, the list on the right uses the .data-table style class.",
    keywords: ["GtkListItemFactory", "GListModel"],
    component: ListViewSettingsDemo,
    titlebar: ListViewSettingsTitlebar,
    provider: ListViewSettingsProvider,
    sourceCode,
    defaultWidth: 640,
    defaultHeight: 480,
};

function compareSchemaIds(a: string, b: string): number {
    if (a === b) {
        return 0;
    }

    return a < b ? -1 : 1;
}

function buildNodeFromSettings(settings: Gio.Settings, nodeId: string): SchemaTreeNode {
    const schema = GObject.getProperty(settings, "settingsSchema") as Gio.SettingsSchema;
    const children = settings.listChildren().toSorted(compareSchemaIds).map((name) =>
        buildNodeFromSettings(settings.getChild(name), `${nodeId}/${name}`),
    );

    return { nodeId, settings, schema, children };
}

function SchemaSettings({ schemaId, onLoaded }: {
    schemaId: string;
    onLoaded: (node: SchemaTreeNode) => void;
}) {
    const handleRef = useCallback((settings: Gio.Settings | null) => {
        if (settings) {
            onLoaded(buildNodeFromSettings(settings, schemaId));
        }
    }, [schemaId, onLoaded]);

    return createPortal(<GSettings schemaId={schemaId} ref={handleRef} />, rootElement);
}

function readKeyInfo(schema: Gio.SettingsSchema, settings: Gio.Settings, keyName: string): KeyInfo {
    const schemaKey = schema.getKey(keyName);

    return {
        name: keyName,
        value: settings.getValue(keyName).print(false),
        defaultValue: schemaKey.getDefaultValue().print(false),
        type: schemaKey.getValueType().dupString(),
        summary: schemaKey.getSummary() ?? "",
        description: schemaKey.getDescription() ?? "",
    };
}

function findSchemaNode(nodes: SchemaTreeNode[], nodeId: string): SchemaTreeNode | undefined {
    for (const node of nodes) {
        if (node.nodeId === nodeId) {
            return node;
        }

        const child = findSchemaNode(node.children, nodeId);

        if (child) {
            return child;
        }
    }

    return undefined;
}

function schemaNodeToItem(node: SchemaTreeNode): ListItem<string> {
    if (node.children.length === 0) {
        return { id: node.nodeId, value: node.nodeId, shouldHideExpander: true };
    }

    return {
        id: node.nodeId,
        value: node.nodeId,
        children: node.children.map((child) => schemaNodeToItem(child)),
    };
}

function filterKeyInfos(keyInfos: KeyInfo[], searchText: string): KeyInfo[] {
    if (!searchText) {
        return keyInfos;
    }

    const lower = searchText.toLowerCase();

    return keyInfos.filter((keyInfo) => keyInfo.name.toLowerCase().includes(lower));
}

function useListViewSettingsState() {
    const [schemaIds] = useState(() =>
        Gio.SettingsSchemaSource.getDefault()?.listSchemas(true)[0].toSorted(compareSchemaIds) ?? [],
    );
    const [schemaTree, setSchemaTree] = useState<SchemaTreeNode[]>([]);
    const [selectedNode, setSelectedNode] = useState<SchemaTreeNode | null>(null);
    const handleSchemaLoaded = useCallback((node: SchemaTreeNode) => {
        setSchemaTree((previous) => [...previous.filter((item) => item.nodeId !== node.nodeId), node]
            .toSorted((a, b) => compareSchemaIds(a.nodeId, b.nodeId)));
    }, []);
    const [keyInfos, setKeyInfos] = useState<KeyInfo[]>([]);
    const [isKeySearchActive, setIsKeySearchActive] = useState(false);
    const [keySearchText, setKeySearchText] = useState("");

    const handleSchemaSelected = (ids: string[]) => {
        const nodeId = ids[0];

        if (!nodeId) {
            return;
        }

        const node = findSchemaNode(schemaTree, nodeId);

        if (node) {
            setSelectedNode(node);
            setKeyInfos(node.schema.listKeys().map((key) => readKeyInfo(node.schema, node.settings, key)));
        }
    };

    const handleKeySearchChanged = (entry: Gtk.SearchEntry) => {
        setKeySearchText(entry.getText());
    };

    const handleStopSearch = () => {
        setIsKeySearchActive(false);
        setKeySearchText("");
    };

    return {
        schemaIds,
        schemaTree,
        handleSchemaLoaded,
        selectedNode,
        setKeyInfos,
        isKeySearchActive,
        keySearchText,
        setIsKeySearchActive,
        setKeySearchText,
        handleSchemaSelected,
        filteredKeyInfos: filterKeyInfos(keyInfos, keySearchText),
        handleKeySearchChanged,
        handleStopSearch,
    };
}

function nextKeyInfos(keyInfos: KeyInfo[], name: string, value: string): KeyInfo[] {
    return keyInfos.map((keyInfo) => (keyInfo.name === name ? { ...keyInfo, value } : keyInfo));
}

function writeKeyValue(context: KeyEditContext) {
    const { keyInfo, newText, widget, settings, schema, setKeyInfos } = context;
    const variantType = GLib.VariantType.new(keyInfo.type);
    const variant = GLib.Variant.parse(variantType, newText, null, null);
    const schemaKey = schema.getKey(keyInfo.name);

    if (!schemaKey.rangeCheck(variant) || !settings.setValue(keyInfo.name, variant)) {
        widget.setText(keyInfo.value);
        widget.errorBell();

        return;
    }

    setKeyInfos((previous) => nextKeyInfos(previous, keyInfo.name, variant.print(false)));
}

function commitKeyInfoEdit({ keyInfo, newText, widget, state }: CommitKeyInfoEditArgs) {
    const { selectedNode, setKeyInfos } = state;

    if (!selectedNode || newText === keyInfo.value) {
        return;
    }

    const { settings, schema } = selectedNode;

    try {
        writeKeyValue({ keyInfo, newText, widget, settings, schema, setKeyInfos });
    } catch {
        widget.setText(keyInfo.value);
        widget.errorBell();
    }
}

const renderKeyInfoCell =
    (getText: (keyInfo: KeyInfo) => string, shouldWrap = false) =>
        ({ item }: { item: KeyInfo }) => (
            <GtkLabel xalign={0} wrap={shouldWrap}>
                {getText(item)}
            </GtkLabel>
        );

function toggleableColumn(spec: KeyInfoColumnSpec, columnVisibility: ColumnVisibility): ColumnViewColumn<KeyInfo> {
    return {
        id: spec.id,
        title: spec.title,
        resizable: true,
        isSortable: spec.isSortable,
        expand: spec.isExpanding,
        visible: columnVisibility[spec.id],
        headerMenu: columnVisibilityMenu,
        renderCell: renderKeyInfoCell(spec.getText, spec.shouldWrap),
    };
}

function renderSettingsColumns({ columnVisibility, onValueEdit }: SettingsColumnsProps): ColumnViewColumn<KeyInfo>[] {
    return [
        { id: "name", title: "Name", renderCell: renderKeyInfoCell((keyInfo) => keyInfo.name) },
        {
            id: "value",
            title: "Value",
            resizable: true,
            renderCell: ({ item }: { item: KeyInfo }) => (
                <GtkEditableLabel
                    text={item.value}
                    accessibleLabel={`Value for ${item.name}`}
                    onNotifyEditing={(isEditing, label) => {
                        if (isEditing === false) {
                            onValueEdit(item, label.getText(), label);
                        }
                    }}
                />
            ),
        },
        ...KEY_INFO_COLUMNS.map((spec) => toggleableColumn(spec, columnVisibility)),
    ];
}

const renderColumnVisibilityActions = (
    columnVisibility: ColumnVisibility,
    toggleColumn: (id: ToggleableColumnId) => void,
) => (
    <GSimpleActionGroup
        prefix="columnview"
        actions={TOGGLEABLE_COLUMNS.map((column) => (
            <GSimpleAction
                key={column.id}
                name={column.action}
                state={GLib.Variant.newBoolean(columnVisibility[column.id])}
                onActivate={() => {
                    toggleColumn(column.id);
                }}
            />
        ))}
    />
);

function renderSchemaItem({ item: schemaId }: { item: string }) {
    return <GtkLabel xalign={0}>{schemaId}</GtkLabel>;
}

const SchemaSidebar = ({ schemaTree, onSelectionChanged }: {
    schemaTree: SchemaTreeNode[];
    onSelectionChanged: (ids: string[]) => void;
}) => {
    const items = schemaTree.map((node) => schemaNodeToItem(node));
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [collapsedIds, setCollapsedIds] = useState<string[]>([]);
    const expandableIds = collectExpandableIds(items);

    return (
        <GtkScrolledWindow>
            <ListView
                name="sidebar"
                tabBehavior={Gtk.ListTabBehavior.ITEM}
                selectionMode={Gtk.SelectionMode.BROWSE}
                selectedIds={selectedIds}
                onSelectionChanged={(ids: string[]) => {
                    setSelectedIds(ids);
                    onSelectionChanged(ids);
                }}
                cssClasses={["navigation-sidebar"]}
                expandedIds={expandableIds.filter((id) => !collapsedIds.includes(id))}
                onExpandedChange={(ids) => {
                    setCollapsedIds(expandableIds.filter((id) => !ids.includes(id)));
                }}
                renderItem={renderSchemaItem}
                items={items}
            />
        </GtkScrolledWindow>
    );
};

const SettingsColumnView = ({
    isKeySearchActive,
    keySearchText,
    onSearchChanged,
    onStopSearch,
    filteredKeyInfos,
    onValueEdit,
}: SettingsColumnViewProps) => {
    const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>(INITIAL_COLUMN_VISIBILITY);
    const [sortColumn, setSortColumn] = useState<string | null>(null);
    const [sortOrder, setSortOrder] = useState(Gtk.SortType.ASCENDING);
    const sortedKeyInfos = sortColumn === "type"
        ? filteredKeyInfos.toSorted((a, b) => a.type.localeCompare(b.type) *
            (sortOrder === Gtk.SortType.ASCENDING ? 1 : -1))
        : filteredKeyInfos;

    const toggleColumn = (id: ToggleableColumnId) => {
        setColumnVisibility((previous) => ({ ...previous, [id]: !previous[id] }));
    };

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkSearchBar name="search-bar" searchModeEnabled={isKeySearchActive}>
                <GtkSearchEntry
                    name="search-entry"
                    accessibleLabel="Search keys"
                    text={keySearchText}
                    onSearchChanged={onSearchChanged}
                    onStopSearch={onStopSearch}
                />
            </GtkSearchBar>
            <GtkScrolledWindow hexpand vexpand>
                <ColumnView
                    name="column-view"
                    tabBehavior={Gtk.ListTabBehavior.CELL}
                    selectionMode={Gtk.SelectionMode.NONE}
                    cssClasses={["data-table"]}
                    sortColumn={sortColumn}
                    sortOrder={sortOrder}
                    onSortChanged={(column, order) => {
                        setSortColumn(column);
                        setSortOrder(order);
                    }}
                    items={sortedKeyInfos.map((keyInfo) => ({ id: keyInfo.name, value: keyInfo }))}
                    actionGroups={renderColumnVisibilityActions(columnVisibility, toggleColumn)}
                    columns={renderSettingsColumns({ columnVisibility, onValueEdit })}
                />
            </GtkScrolledWindow>
        </GtkBox>
    );
};

function useSettingsContext(): SettingsContextValue {
    const ctx = useContext(SettingsContext);

    if (!ctx) {
        throw new Error("SettingsContext is missing");
    }

    return ctx;
}

function ListViewSettingsProvider({ children }: DemoProviderProps) {
    const state = useListViewSettingsState();

    const handleValueEdit = (keyInfo: KeyInfo, newText: string, widget: Gtk.EditableLabel) => {
        commitKeyInfoEdit({ keyInfo, newText, widget, state });
    };

    const value = {
        state,
        handleValueEdit,
    };

    return (
        <SettingsContext.Provider value={value}>
            {state.schemaIds.map((schemaId) => (
                <SchemaSettings key={schemaId} schemaId={schemaId} onLoaded={state.handleSchemaLoaded} />
            ))}
            {children}
        </SettingsContext.Provider>
    );
}

function ListViewSettingsTitlebar() {
    const { state } = useSettingsContext();

    return (
        <GtkHeaderBar
            end={(
                <GtkToggleButton
                    name="search-toggle"
                    iconName="system-search-symbolic"
                    accessibleLabel="Search keys"
                    active={state.isKeySearchActive}
                    onToggled={(btn) => {
                        state.setIsKeySearchActive(btn.getActive());
                        state.setKeySearchText("");
                    }}
                />
            )}
        />
    );
}

function ListViewSettingsDemo() {
    const { state, handleValueEdit } = useSettingsContext();

    return (
        <GtkPaned
            name="paned"
            position={300}
            hexpand
            vexpand
            startChild={(
                <SchemaSidebar schemaTree={state.schemaTree} onSelectionChanged={state.handleSchemaSelected} />
            )}
            endChild={(
                <SettingsColumnView
                    isKeySearchActive={state.isKeySearchActive}
                    keySearchText={state.keySearchText}
                    onSearchChanged={state.handleKeySearchChanged}
                    onStopSearch={state.handleStopSearch}
                    filteredKeyInfos={state.filteredKeyInfos}
                    onValueEdit={handleValueEdit}
                />
            )}
        />
    );
}

export { listviewSettingsDemo };
