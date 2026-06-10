import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import { GMenu, GMenuItem, GSimpleAction, GSimpleActionGroup } from "@gtkx/jsx/gio";
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
import { GtkColumnView, GtkColumnViewColumn, GtkListView } from "@gtkx/react";

import { createContext, useContext, useState } from "react";
import type { Demo, DemoProviderProps } from "../types.js";
import sourceCode from "./listview-settings.tsx?raw";

interface KeyInfo {
    name: string;
    value: string;
    defaultValue: string;
    type: string;
    summary: string;
    description: string;
}

interface SchemaTreeNode {
    nodeId: string;
    schemaId: string;
    children: SchemaTreeNode[];
}

let nodeIdCounter = 0;
const settingsMap = new Map<string, Gio.Settings>();
const schemaIdByNode = new Map<string, string>();

function buildNodeFromSettings(settings: Gio.Settings, schemaId: string): SchemaTreeNode {
    const nodeId = `n${nodeIdCounter++}`;
    settingsMap.set(nodeId, settings);
    schemaIdByNode.set(nodeId, schemaId);

    let childNames: string[];
    try {
        childNames = settings.listChildren().sort();
    } catch (e) {
        if (e instanceof Error) console.error(e.message);
        childNames = [];
    }

    const children: SchemaTreeNode[] = [];
    for (const name of childNames) {
        try {
            const child = settings.getChild(name);
            children.push(buildNodeFromSettings(child, `${schemaId}.${name}`));
        } catch (e) {
            if (e instanceof Error) console.error(e.message);
        }
    }

    return { nodeId, schemaId, children };
}

function loadSchemaTree(): SchemaTreeNode[] {
    const source = Gio.SettingsSchemaSource.getDefault();
    if (!source) return [];

    const [nonRelocatable] = source.listSchemas(true) as [string[], string[]];

    return nonRelocatable.sort().map((id) => {
        const settings = Gio.Settings.new(id);
        return buildNodeFromSettings(settings, id);
    });
}

let cachedSchemaTree: SchemaTreeNode[] | undefined;
function getSchemaTree() {
    if (!cachedSchemaTree) {
        cachedSchemaTree = loadSchemaTree();
    }
    return cachedSchemaTree;
}

function loadKeysForNode(nodeId: string): KeyInfo[] {
    const settings = settingsMap.get(nodeId);
    const schemaId = schemaIdByNode.get(nodeId);
    if (!settings || !schemaId) return [];

    const source = Gio.SettingsSchemaSource.getDefault();
    if (!source) return [];

    const schema = source.lookup(schemaId, true);
    if (!schema) return [];

    const keys = schema.listKeys();
    const result: KeyInfo[] = [];

    for (const keyName of keys) {
        try {
            const schemaKey = schema.getKey(keyName);
            const value = settings.getValue(keyName);
            const defaultValue = schemaKey.getDefaultValue();
            const valueType = schemaKey.getValueType();

            result.push({
                name: keyName,
                value: value.print(false) ?? "",
                defaultValue: defaultValue.print(false) ?? "",
                type: valueType.dupString() ?? "",
                summary: schemaKey.getSummary() ?? "",
                description: schemaKey.getDescription() ?? "",
            });
        } catch (e) {
            if (e instanceof Error) console.error(e.message);
            result.push({
                name: keyName,
                value: "<error>",
                defaultValue: "",
                type: "",
                summary: "",
                description: "",
            });
        }
    }

    return result;
}

interface SchemaTreeItemData {
    id: string;
    value: string;
    hideExpander?: true;
    children?: SchemaTreeItemData[];
}

function schemaNodeToItem(node: SchemaTreeNode): SchemaTreeItemData {
    if (node.children.length === 0) {
        return { id: node.nodeId, value: node.schemaId, hideExpander: true };
    }
    return {
        id: node.nodeId,
        value: node.schemaId,
        children: node.children.map(schemaNodeToItem),
    };
}

function useListViewSettingsState() {
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [keyInfos, setKeyInfos] = useState<KeyInfo[]>([]);
    const [keySearchActive, setKeySearchActive] = useState(false);
    const [keySearchText, setKeySearchText] = useState("");

    const handleSchemaSelected = (ids: string[]) => {
        const nodeId = ids[0];
        if (!nodeId) return;
        setSelectedNodeId(nodeId);
        setKeyInfos(loadKeysForNode(nodeId));
    };

    const filteredKeyInfos = (() => {
        if (!keySearchText) return keyInfos;
        const lower = keySearchText.toLowerCase();
        return keyInfos.filter((k) => k.name.toLowerCase().includes(lower));
    })();

    const handleKeySearchChanged = (entry: Gtk.SearchEntry) => setKeySearchText(entry.getText());

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
        filteredKeyInfos,
        handleKeySearchChanged,
        handleStopSearch,
    };
}

type ListViewSettingsState = ReturnType<typeof useListViewSettingsState>;

type ToggleableColumnId = "type" | "default" | "summary" | "description";

interface ToggleableColumnSpec {
    id: ToggleableColumnId;
    menuLabel: string;
    action: string;
}

const TOGGLEABLE_COLUMNS: readonly ToggleableColumnSpec[] = [
    { id: "type", menuLabel: "Type", action: "show-type" },
    { id: "default", menuLabel: "Default value", action: "show-default" },
    { id: "summary", menuLabel: "Summary", action: "show-summary" },
    { id: "description", menuLabel: "Description", action: "show-description" },
];

type ColumnVisibility = Record<ToggleableColumnId, boolean>;

const INITIAL_COLUMN_VISIBILITY: ColumnVisibility = {
    type: true,
    default: true,
    summary: false,
    description: false,
};

const columnVisibilityMenu = (
    <GMenu>
        <GMenuItem section>
            <GMenu>
                {TOGGLEABLE_COLUMNS.map((column) => (
                    <GMenuItem key={column.id} label={column.menuLabel} action={`columnview.${column.action}`} />
                ))}
            </GMenu>
        </GMenuItem>
    </GMenu>
);

interface CommitKeyInfoEditArgs {
    keyInfo: KeyInfo;
    newText: string;
    widget: Gtk.Widget;
    state: ListViewSettingsState;
}

const commitKeyInfoEdit = ({ keyInfo, newText, widget, state }: CommitKeyInfoEditArgs) => {
    const { selectedNodeId, setKeyInfos } = state;
    if (!selectedNodeId) return;
    const settings = settingsMap.get(selectedNodeId);
    const schemaId = schemaIdByNode.get(selectedNodeId);
    if (!settings || !schemaId) return;

    try {
        const source = Gio.SettingsSchemaSource.getDefault();
        if (!source) return;
        const schema = source.lookup(schemaId, true);
        if (!schema) return;

        const variantType = GLib.VariantType.new(keyInfo.type);
        const variant = GLib.variantParse(variantType, newText, null, null);
        if (!variant) return;

        const schemaKey = schema.getKey(keyInfo.name);
        if (!schemaKey.rangeCheck(variant)) {
            widget.errorBell();
            return;
        }
        settings.setValue(keyInfo.name, variant);
        setKeyInfos((prev) =>
            prev.map((k) => (k.name === keyInfo.name ? { ...k, value: variant.print(false) ?? "" } : k)),
        );
    } catch (e) {
        if (e instanceof Error) console.error(e.message);
        widget.errorBell();
    }
};

const SchemaSidebar = ({ onSelectionChanged }: { onSelectionChanged: (ids: string[]) => void }) => (
    <GtkScrolledWindow>
        <GtkListView
            name="sidebar"
            tabBehavior={Gtk.ListTabBehavior.ITEM}
            selectionMode={Gtk.SelectionMode.BROWSE}
            onSelectionChanged={onSelectionChanged}
            cssClasses={["navigation-sidebar"]}
            autoexpand
            renderItem={(schemaId: string) => <GtkLabel label={schemaId} xalign={0} />}
            items={getSchemaTree().map(schemaNodeToItem)}
        />
    </GtkScrolledWindow>
);

interface SettingsColumnViewProps {
    keySearchActive: boolean;
    onSearchChanged: (entry: Gtk.SearchEntry) => void;
    onStopSearch: () => void;
    filteredKeyInfos: KeyInfo[];
    onValueEdit: (keyInfo: KeyInfo, newText: string, widget: Gtk.Widget) => void;
}

const SettingsColumnView = ({
    keySearchActive,
    onSearchChanged,
    onStopSearch,
    filteredKeyInfos,
    onValueEdit,
}: SettingsColumnViewProps) => {
    const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>(INITIAL_COLUMN_VISIBILITY);
    const toggleColumn = (id: ToggleableColumnId) => setColumnVisibility((prev) => ({ ...prev, [id]: !prev[id] }));

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkSearchBar name="search-bar" searchModeEnabled={keySearchActive}>
                <GtkSearchEntry name="search-entry" onSearchChanged={onSearchChanged} onStopSearch={onStopSearch} />
            </GtkSearchBar>
            <GtkScrolledWindow hexpand vexpand>
                <GtkColumnView
                    name="column-view"
                    tabBehavior={Gtk.ListTabBehavior.CELL}
                    cssClasses={["data-table"]}
                    items={filteredKeyInfos.map((k) => ({ id: k.name, value: k }))}
                >
                    <GtkColumnViewColumn
                        id="name"
                        title="Name"
                        renderCell={(item: KeyInfo) => <GtkLabel label={item.name} xalign={0} />}
                    />
                    <GtkColumnViewColumn
                        id="value"
                        title="Value"
                        resizable
                        renderCell={(item: KeyInfo) => (
                            <GtkEditableLabel
                                text={item.value}
                                onChanged={(label: Gtk.EditableLabel) => onValueEdit(item, label.getText(), label)}
                            />
                        )}
                    />
                    <GtkColumnViewColumn
                        id="type"
                        title="Type"
                        resizable
                        sortable
                        visible={columnVisibility.type}
                        headerMenu={columnVisibilityMenu}
                        renderCell={(item: KeyInfo) => <GtkLabel label={item.type} xalign={0} />}
                    />
                    <GtkColumnViewColumn
                        id="default"
                        title="Default"
                        resizable
                        expand
                        visible={columnVisibility.default}
                        headerMenu={columnVisibilityMenu}
                        renderCell={(item: KeyInfo) => <GtkLabel label={item.defaultValue} xalign={0} />}
                    />
                    <GtkColumnViewColumn
                        id="summary"
                        title="Summary"
                        resizable
                        expand
                        visible={columnVisibility.summary}
                        headerMenu={columnVisibilityMenu}
                        renderCell={(item: KeyInfo) => <GtkLabel label={item.summary} xalign={0} wrap />}
                    />
                    <GtkColumnViewColumn
                        id="description"
                        title="Description"
                        resizable
                        expand
                        visible={columnVisibility.description}
                        headerMenu={columnVisibilityMenu}
                        renderCell={(item: KeyInfo) => <GtkLabel label={item.description} xalign={0} wrap />}
                    />
                    <GSimpleActionGroup prefix="columnview">
                        {TOGGLEABLE_COLUMNS.map((column) => (
                            <GSimpleAction
                                key={column.id}
                                name={column.action}
                                state={GLib.Variant.newBoolean(columnVisibility[column.id])}
                                onActivate={() => toggleColumn(column.id)}
                            />
                        ))}
                    </GSimpleActionGroup>
                </GtkColumnView>
            </GtkScrolledWindow>
        </GtkBox>
    );
};

interface SettingsContextValue {
    state: ListViewSettingsState;
    handleValueEdit: (keyInfo: KeyInfo, newText: string, widget: Gtk.Widget) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

const useSettingsContext = (): SettingsContextValue => {
    const ctx = useContext(SettingsContext);
    if (!ctx) throw new Error("SettingsContext is missing");
    return ctx;
};

const ListViewSettingsProvider = ({ children }: DemoProviderProps) => {
    const state = useListViewSettingsState();

    const handleValueEdit = (keyInfo: KeyInfo, newText: string, widget: Gtk.Widget) =>
        commitKeyInfoEdit({ keyInfo, newText, widget, state });

    const value = {
        state,
        handleValueEdit,
    };

    return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

const ListViewSettingsTitlebar = () => {
    const { state } = useSettingsContext();
    return (
        <GtkHeaderBar
            packEnd={
                <GtkToggleButton
                    name="search-toggle"
                    iconName="system-search-symbolic"
                    active={state.keySearchActive}
                    onToggled={(btn) => {
                        state.setKeySearchActive(btn.getActive());
                        state.setKeySearchText("");
                    }}
                />
            }
        />
    );
};

const ListViewSettingsDemo = () => {
    const { state, handleValueEdit } = useSettingsContext();
    return (
        <GtkPaned
            name="paned"
            position={300}
            hexpand
            vexpand
            startChild={<SchemaSidebar onSelectionChanged={state.handleSchemaSelected} />}
            endChild={
                <SettingsColumnView
                    keySearchActive={state.keySearchActive}
                    onSearchChanged={state.handleKeySearchChanged}
                    onStopSearch={state.handleStopSearch}
                    filteredKeyInfos={state.filteredKeyInfos}
                    onValueEdit={handleValueEdit}
                />
            }
        />
    );
};

export const listviewSettingsDemo: Demo = {
    id: "listview-settings",
    title: "Lists/Settings",
    description:
        "This demo shows a settings viewer for GSettings.\n\nIt demonstrates how to implement support for trees with GtkListView. It also shows how to set up sorting and filtering for columns in a GtkColumnView.\n\nIt also demonstrates different styles of list. The tree on the left uses the ­.navigation-sidebar style class, the list on the right uses the ­.data-table style class.",
    keywords: ["GtkListItemFactory", "GListModel"],
    component: ListViewSettingsDemo,
    titlebar: ListViewSettingsTitlebar,
    provider: ListViewSettingsProvider,
    sourceCode,
    defaultWidth: 640,
    defaultHeight: 480,
};
