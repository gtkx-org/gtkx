import { ColumnView, type ColumnViewColumn, ListView } from "@gtkx/components";
import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import { GMenu, GSimpleAction, GSimpleActionGroup } from "@gtkx/jsx/gio";
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
import { createContext, useContext, useState } from "react";
import type { Demo, DemoProviderProps } from "../types.js";
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
    schemaId: string;
    children: SchemaTreeNode[];
};

type NodeIdSource = {
    next: number;
};

type SchemaTreeItemData = {
    id: string;
    value: string;
    hideExpander?: true;
    children?: SchemaTreeItemData[];
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
    widget: Gtk.Widget;
    state: ListViewSettingsState;
};

type KeyEditContext = {
    keyInfo: KeyInfo;
    newText: string;
    widget: Gtk.Widget;
    settings: Gio.Settings;
    schema: Gio.SettingsSchema;
    setKeyInfos: ListViewSettingsState["setKeyInfos"];
};

type SettingsColumnViewProps = {
    keySearchActive: boolean;
    onSearchChanged: (entry: Gtk.SearchEntry) => void;
    onStopSearch: () => void;
    filteredKeyInfos: KeyInfo[];
    onValueEdit: (keyInfo: KeyInfo, newText: string, widget: Gtk.Widget) => void;
};

type SettingsColumnsProps = {
    columnVisibility: ColumnVisibility;
    onValueEdit: (keyInfo: KeyInfo, newText: string, widget: Gtk.Widget) => void;
};

type SettingsContextValue = {
    state: ListViewSettingsState;
    handleValueEdit: (keyInfo: KeyInfo, newText: string, widget: Gtk.Widget) => void;
};

const settingsByNode: Map<string, Gio.Settings> = new Map();
const schemaIdByNode: Map<string, string> = new Map();

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

const getSchemaTree = (() => {
    let cache: SchemaTreeNode[] | undefined;

    return (): SchemaTreeNode[] => {
        cache ??= loadSchemaTree();

        return cache;
    };
})();

const SettingsContext = createContext<SettingsContextValue | null>(null);

const listviewSettingsDemo: Demo = {
    id: "listview-settings",
    title: "Lists/Settings",
    description:
        "This demo shows a settings viewer for GSettings.\n\nIt demonstrates how to implement support for " +
        "trees with GtkListView. It also shows how to set up sorting and filtering for columns in a " +
        "GtkColumnView.\n\nIt also demonstrates different styles of list. The tree on the left uses the " +
        "­.navigation-sidebar style class, the list on the right uses the ­.data-table style class.",
    keywords: ["GtkListItemFactory", "GListModel"],
    component: ListViewSettingsDemo,
    titlebar: ListViewSettingsTitlebar,
    provider: ListViewSettingsProvider,
    sourceCode,
    defaultWidth: 640,
    defaultHeight: 480,
};

function logError(error: unknown) {
    if (error instanceof Error) {
        console.error(error.message);
    }
}

function compareSchemaIds(a: string, b: string): number {
    if (a === b) {
        return 0;
    }

    return a < b ? -1 : 1;
}

function listChildNames(settings: Gio.Settings): string[] {
    try {
        return settings.listChildren().toSorted(compareSchemaIds);
    } catch (error) {
        logError(error);

        return [];
    }
}

function buildNodeFromSettings(settings: Gio.Settings, schemaId: string, ids: NodeIdSource): SchemaTreeNode {
    const nodeId = `n${String(ids.next++)}`;
    settingsByNode.set(nodeId, settings);
    schemaIdByNode.set(nodeId, schemaId);
    const children: SchemaTreeNode[] = [];

    for (const name of listChildNames(settings)) {
        try {
            const child = settings.getChild(name);
            children.push(buildNodeFromSettings(child, `${schemaId}.${name}`, ids));
        } catch (error) {
            logError(error);
        }
    }

    return { nodeId, schemaId, children };
}

function loadSchemaTree(): SchemaTreeNode[] {
    const source = Gio.SettingsSchemaSource.getDefault();

    if (!source) {
        return [];
    }

    const [nonRelocatable] = source.listSchemas(true);
    const ids: NodeIdSource = { next: 0 };

    return nonRelocatable
        .toSorted(compareSchemaIds)
        .map((id) => buildNodeFromSettings(Gio.Settings.new(id), id, ids));
}

function lookupSchemaForNode(nodeId: string): Gio.SettingsSchema | null {
    const schemaId = schemaIdByNode.get(nodeId);

    if (schemaId === undefined) {
        return null;
    }

    return Gio.SettingsSchemaSource.getDefault()?.lookup(schemaId, true) ?? null;
}

function readKeyInfo(schema: Gio.SettingsSchema, settings: Gio.Settings, keyName: string): KeyInfo {
    try {
        const schemaKey = schema.getKey(keyName);

        return {
            name: keyName,
            value: settings.getValue(keyName).print(false),
            defaultValue: schemaKey.getDefaultValue().print(false),
            type: schemaKey.getValueType().dupString(),
            summary: schemaKey.getSummary() ?? "",
            description: schemaKey.getDescription() ?? "",
        };
    } catch (error) {
        logError(error);

        return {
            name: keyName,
            value: "<error>",
            defaultValue: "",
            type: "",
            summary: "",
            description: "",
        };
    }
}

function loadKeysForNode(nodeId: string): KeyInfo[] {
    const settings = settingsByNode.get(nodeId);
    const schema = lookupSchemaForNode(nodeId);

    if (!settings || !schema) {
        return [];
    }

    return schema.listKeys().map((keyName) => readKeyInfo(schema, settings, keyName));
}

function schemaNodeToItem(node: SchemaTreeNode): SchemaTreeItemData {
    if (node.children.length === 0) {
        return { id: node.nodeId, value: node.schemaId, hideExpander: true };
    }

    return {
        id: node.nodeId,
        value: node.schemaId,
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
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [keyInfos, setKeyInfos] = useState<KeyInfo[]>([]);
    const [keySearchActive, setKeySearchActive] = useState(false);
    const [keySearchText, setKeySearchText] = useState("");

    const handleSchemaSelected = (ids: string[]) => {
        const nodeId = ids[0];

        if (!nodeId) {
            return;
        }

        setSelectedNodeId(nodeId);
        setKeyInfos(loadKeysForNode(nodeId));
    };

    const handleKeySearchChanged = (entry: Gtk.SearchEntry) => {
        setKeySearchText(entry.getText());
    };

    const handleStopSearch = () => {
        setKeySearchActive(false);
        setKeySearchText("");
    };

    return {
        selectedNodeId,
        setKeyInfos,
        keySearchActive,
        setKeySearchActive,
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

    if (!schemaKey.rangeCheck(variant)) {
        widget.errorBell();

        return;
    }

    settings.setValue(keyInfo.name, variant);
    setKeyInfos((previous) => nextKeyInfos(previous, keyInfo.name, variant.print(false)));
}

function commitKeyInfoEdit({ keyInfo, newText, widget, state }: CommitKeyInfoEditArgs) {
    const { selectedNodeId, setKeyInfos } = state;

    if (!selectedNodeId) {
        return;
    }

    const settings = settingsByNode.get(selectedNodeId);
    const schema = lookupSchemaForNode(selectedNodeId);

    if (!settings || !schema) {
        return;
    }

    try {
        writeKeyValue({ keyInfo, newText, widget, settings, schema, setKeyInfos });
    } catch (error) {
        logError(error);
        widget.errorBell();
    }
}

function collectSchemaExpandableIds(nodes: SchemaTreeItemData[]): string[] {
    const ids: string[] = [];

    for (const node of nodes) {
        if (node.children && node.children.length > 0) {
            ids.push(node.id, ...collectSchemaExpandableIds(node.children));
        }
    }

    return ids;
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
        sortable: spec.isSortable,
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
                    onChanged={(label: Gtk.EditableLabel) => {
                        onValueEdit(item, label.getText(), label);
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

const SchemaSidebar = ({ onSelectionChanged }: { onSelectionChanged: (ids: string[]) => void }) => {
    const items = getSchemaTree().map((node) => schemaNodeToItem(node));

    return (
        <GtkScrolledWindow>
            <ListView
                name="sidebar"
                tabBehavior={Gtk.ListTabBehavior.ITEM}
                selectionMode={Gtk.SelectionMode.BROWSE}
                onSelectionChanged={onSelectionChanged}
                cssClasses={["navigation-sidebar"]}
                expandedIds={collectSchemaExpandableIds(items)}
                renderItem={renderSchemaItem}
                items={items}
            />
        </GtkScrolledWindow>
    );
};

const SettingsColumnView = ({
    keySearchActive,
    onSearchChanged,
    onStopSearch,
    filteredKeyInfos,
    onValueEdit,
}: SettingsColumnViewProps) => {
    const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>(INITIAL_COLUMN_VISIBILITY);

    const toggleColumn = (id: ToggleableColumnId) => {
        setColumnVisibility((previous) => ({ ...previous, [id]: !previous[id] }));
    };

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkSearchBar name="search-bar" searchModeEnabled={keySearchActive}>
                <GtkSearchEntry name="search-entry" onSearchChanged={onSearchChanged} onStopSearch={onStopSearch} />
            </GtkSearchBar>
            <GtkScrolledWindow hexpand vexpand>
                <ColumnView
                    name="column-view"
                    tabBehavior={Gtk.ListTabBehavior.CELL}
                    cssClasses={["data-table"]}
                    items={filteredKeyInfos.map((keyInfo) => ({ id: keyInfo.name, value: keyInfo }))}
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

    const handleValueEdit = (keyInfo: KeyInfo, newText: string, widget: Gtk.Widget) => {
        commitKeyInfoEdit({ keyInfo, newText, widget, state });
    };

    const value = {
        state,
        handleValueEdit,
    };

    return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

function ListViewSettingsTitlebar() {
    const { state } = useSettingsContext();

    return (
        <GtkHeaderBar
            end={(
                <GtkToggleButton
                    name="search-toggle"
                    iconName="system-search-symbolic"
                    active={state.keySearchActive}
                    onToggled={(btn) => {
                        state.setKeySearchActive(btn.getActive());
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
            startChild={<SchemaSidebar onSelectionChanged={state.handleSchemaSelected} />}
            endChild={(
                <SettingsColumnView
                    keySearchActive={state.keySearchActive}
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
