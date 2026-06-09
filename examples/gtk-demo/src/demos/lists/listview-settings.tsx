import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import {
    GtkBox,
    GtkColumnView,
    GtkColumnViewColumn,
    GtkEditableLabel,
    GtkHeaderBar,
    GtkLabel,
    GtkListView,
    GtkPaned,
    GtkScrolledWindow,
    GtkSearchBar,
    GtkSearchEntry,
    GtkToggleButton,
} from "@gtkx/react";

import { createContext, useContext, useRef, useState } from "react";
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

const collectColumnsByTitle = (cv: Gtk.ColumnView): Map<string, Gtk.ColumnViewColumn> => {
    const columnsList = cv.getColumns();
    const nColumns = columnsList.getNItems();
    const map = new Map<string, Gtk.ColumnViewColumn>();
    for (let i = 0; i < nColumns; i++) {
        const col = columnsList.getItem(i);
        if (col instanceof Gtk.ColumnViewColumn) {
            const title = col.getTitle();
            if (title) map.set(title, col);
        }
    }
    return map;
};

const buildColumnVisibilityMenu = () => {
    const section = new Gio.Menu();
    section.append("Type", "columnview.show-type");
    section.append("Default value", "columnview.show-default");
    section.append("Summary", "columnview.show-summary");
    section.append("Description", "columnview.show-description");
    const menu = new Gio.Menu();
    menu.appendSection(null, section);
    return menu;
};

const buildColumnActionGroup = (cols: {
    typeCol: Gtk.ColumnViewColumn;
    defaultCol: Gtk.ColumnViewColumn;
    summaryCol: Gtk.ColumnViewColumn;
    descriptionCol: Gtk.ColumnViewColumn;
}) => {
    const actionGroup = new Gio.SimpleActionGroup();
    actionGroup.addAction(Gio.PropertyAction.new("show-type", cols.typeCol, "visible"));
    actionGroup.addAction(Gio.PropertyAction.new("show-default", cols.defaultCol, "visible"));
    actionGroup.addAction(Gio.PropertyAction.new("show-summary", cols.summaryCol, "visible"));
    actionGroup.addAction(Gio.PropertyAction.new("show-description", cols.descriptionCol, "visible"));
    return actionGroup;
};

const installVisibilityMenu = (cv: Gtk.ColumnView): (() => void) | null => {
    const columnsByTitle = collectColumnsByTitle(cv);
    const typeCol = columnsByTitle.get("Type");
    const defaultCol = columnsByTitle.get("Default");
    const summaryCol = columnsByTitle.get("Summary");
    const descriptionCol = columnsByTitle.get("Description");

    if (!typeCol || !defaultCol || !summaryCol || !descriptionCol) return null;

    const menu = buildColumnVisibilityMenu();
    const actionGroup = buildColumnActionGroup({ typeCol, defaultCol, summaryCol, descriptionCol });
    cv.insertActionGroup("columnview", actionGroup);

    for (const col of [typeCol, defaultCol, summaryCol, descriptionCol]) {
        col.setHeaderMenu(menu);
    }

    return () => cv.insertActionGroup("columnview", null);
};

function useColumnViewVisibilityMenuRef(
    forwardRef: React.RefObject<Gtk.ColumnView | null>,
): (cv: Gtk.ColumnView | null) => void {
    const teardownRef = useRef<(() => void) | null>(null);
    const columnsListenerRef = useRef<{ list: Gio.ListModel; callback: () => void } | null>(null);

    const detachColumnsListener = () => {
        const listener = columnsListenerRef.current;
        if (listener) {
            listener.list.off("items-changed", listener.callback);
            columnsListenerRef.current = null;
        }
    };

    return (cv: Gtk.ColumnView | null) => {
        forwardRef.current = cv;
        teardownRef.current?.();
        teardownRef.current = null;
        detachColumnsListener();

        if (!cv) return;

        const tryInstall = () => {
            const teardown = installVisibilityMenu(cv);
            if (teardown) {
                teardownRef.current = teardown;
                detachColumnsListener();
            }
        };

        tryInstall();
        if (teardownRef.current) return;

        const columnsList = cv.getColumns();
        columnsList.on("items-changed", tryInstall);
        columnsListenerRef.current = { list: columnsList, callback: tryInstall };
    };
}

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
    columnViewRef: (cv: Gtk.ColumnView | null) => void;
    keySearchActive: boolean;
    onSearchChanged: (entry: Gtk.SearchEntry) => void;
    onStopSearch: () => void;
    filteredKeyInfos: KeyInfo[];
    onValueEdit: (keyInfo: KeyInfo, newText: string, widget: Gtk.Widget) => void;
}

const SettingsColumnView = ({
    columnViewRef,
    keySearchActive,
    onSearchChanged,
    onStopSearch,
    filteredKeyInfos,
    onValueEdit,
}: SettingsColumnViewProps) => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL}>
        <GtkSearchBar name="search-bar" searchModeEnabled={keySearchActive}>
            <GtkSearchEntry name="search-entry" onSearchChanged={onSearchChanged} onStopSearch={onStopSearch} />
        </GtkSearchBar>
        <GtkScrolledWindow hexpand vexpand>
            <GtkColumnView
                name="column-view"
                ref={columnViewRef}
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
                    renderCell={(item: KeyInfo) => <GtkLabel label={item.type} xalign={0} />}
                />
                <GtkColumnViewColumn
                    id="default"
                    title="Default"
                    resizable
                    expand
                    renderCell={(item: KeyInfo) => <GtkLabel label={item.defaultValue} xalign={0} />}
                />
                <GtkColumnViewColumn
                    id="summary"
                    title="Summary"
                    resizable
                    visible={false}
                    expand
                    renderCell={(item: KeyInfo) => <GtkLabel label={item.summary} xalign={0} wrap />}
                />
                <GtkColumnViewColumn
                    id="description"
                    title="Description"
                    resizable
                    visible={false}
                    expand
                    renderCell={(item: KeyInfo) => <GtkLabel label={item.description} xalign={0} wrap />}
                />
            </GtkColumnView>
        </GtkScrolledWindow>
    </GtkBox>
);

interface SettingsContextValue {
    state: ListViewSettingsState;
    columnViewRef: (cv: Gtk.ColumnView | null) => void;
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
    const columnViewRef = useRef<Gtk.ColumnView | null>(null);
    const columnViewCallbackRef = useColumnViewVisibilityMenuRef(columnViewRef);

    const handleValueEdit = (keyInfo: KeyInfo, newText: string, widget: Gtk.Widget) =>
        commitKeyInfoEdit({ keyInfo, newText, widget, state });

    const value = {
        state,
        columnViewRef: columnViewCallbackRef,
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
    const { state, columnViewRef, handleValueEdit } = useSettingsContext();
    return (
        <GtkPaned
            name="paned"
            position={300}
            hexpand
            vexpand
            startChild={<SchemaSidebar onSelectionChanged={state.handleSchemaSelected} />}
            endChild={
                <SettingsColumnView
                    columnViewRef={columnViewRef}
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
