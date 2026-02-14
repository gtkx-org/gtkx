import { createRef } from "@gtkx/ffi";
import * as Gio from "@gtkx/ffi/gio";
import * as GLib from "@gtkx/ffi/glib";
import * as Gtk from "@gtkx/ffi/gtk";
import {
    GtkBox,
    GtkColumnView,
    GtkEditableLabel,
    GtkHeaderBar,
    GtkLabel,
    GtkListView,
    GtkPaned,
    GtkScrolledWindow,
    GtkSearchBar,
    GtkSearchEntry,
    GtkToggleButton,
    x,
} from "@gtkx/react";
import type { ReactNode } from "react";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Demo } from "../types.js";
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
    } catch {
        childNames = [];
    }

    const children: SchemaTreeNode[] = [];
    for (const name of childNames) {
        try {
            const child = settings.getChild(name);
            children.push(buildNodeFromSettings(child, `${schemaId}.${name}`));
        } catch {}
    }

    return { nodeId, schemaId, children };
}

function loadSchemaTree(): SchemaTreeNode[] {
    const source = Gio.SettingsSchemaSource.getDefault();
    if (!source) return [];

    const nonRelocatable = createRef<string[]>([]);
    const relocatable = createRef<string[]>([]);
    source.listSchemas(true, nonRelocatable, relocatable);

    return nonRelocatable.value.sort().map((id) => {
        const settings = new Gio.Settings(id);
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
                value: value.print(false),
                defaultValue: defaultValue.print(false),
                type: valueType.dupString(),
                summary: schemaKey.getSummary() ?? "",
                description: schemaKey.getDescription() ?? "",
            });
        } catch {
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

function renderSchemaNode(node: SchemaTreeNode): ReactNode {
    if (node.children.length === 0) {
        return <x.ListItem key={node.nodeId} id={node.nodeId} value={node.schemaId} hideExpander />;
    }
    return (
        <x.ListItem key={node.nodeId} id={node.nodeId} value={node.schemaId}>
            {node.children.map(renderSchemaNode)}
        </x.ListItem>
    );
}

const ListViewSettingsDemo = () => {
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [keyInfos, setKeyInfos] = useState<KeyInfo[]>([]);
    const [keySearchActive, setKeySearchActive] = useState(false);
    const [keySearchText, setKeySearchText] = useState("");

    const handleSchemaSelected = useCallback((ids: string[]) => {
        const nodeId = ids[0];
        if (!nodeId) return;
        setSelectedNodeId(nodeId);
        setKeyInfos(loadKeysForNode(nodeId));
    }, []);

    const filteredKeyInfos = useMemo(() => {
        if (!keySearchText) return keyInfos;
        const lower = keySearchText.toLowerCase();
        return keyInfos.filter((k) => k.name.toLowerCase().includes(lower));
    }, [keyInfos, keySearchText]);

    const handleKeySearchChanged = useCallback((entry: Gtk.SearchEntry) => {
        setKeySearchText(entry.getText());
    }, []);

    const handleStopSearch = useCallback(() => {
        setKeySearchActive(false);
        setKeySearchText("");
    }, []);

    const columnViewRef = useRef<Gtk.ColumnView | null>(null);

    useLayoutEffect(() => {
        const cv = columnViewRef.current;
        if (!cv) return;

        const columnsList = cv.getColumns();
        const nColumns = columnsList.getNItems();

        const columnsByTitle = new Map<string, Gtk.ColumnViewColumn>();
        for (let i = 0; i < nColumns; i++) {
            const col = columnsList.getObject(i);
            if (col instanceof Gtk.ColumnViewColumn) {
                const title = col.getTitle();
                if (title) columnsByTitle.set(title, col);
            }
        }

        const typeCol = columnsByTitle.get("Type");
        const defaultCol = columnsByTitle.get("Default");
        const summaryCol = columnsByTitle.get("Summary");
        const descriptionCol = columnsByTitle.get("Description");

        if (!typeCol || !defaultCol || !summaryCol || !descriptionCol) return;

        const section = new Gio.Menu();
        section.append("Type", "columnview.show-type");
        section.append("Default value", "columnview.show-default");
        section.append("Summary", "columnview.show-summary");
        section.append("Description", "columnview.show-description");

        const menu = new Gio.Menu();
        menu.appendSection(section);

        const actionGroup = new Gio.SimpleActionGroup();
        actionGroup.addAction(new Gio.PropertyAction("show-type", typeCol, "visible"));
        actionGroup.addAction(new Gio.PropertyAction("show-default", defaultCol, "visible"));
        actionGroup.addAction(new Gio.PropertyAction("show-summary", summaryCol, "visible"));
        actionGroup.addAction(new Gio.PropertyAction("show-description", descriptionCol, "visible"));

        cv.insertActionGroup("columnview", actionGroup);

        for (let i = 0; i < nColumns; i++) {
            const col = columnsList.getObject(i);
            if (col instanceof Gtk.ColumnViewColumn) {
                col.setHeaderMenu(menu);
            }
        }

        return () => {
            cv.insertActionGroup("columnview", null);
        };
    }, []);

    const handleValueEdit = useCallback(
        (keyInfo: KeyInfo, newText: string, widget: Gtk.Widget) => {
            if (!selectedNodeId) return;
            const settings = settingsMap.get(selectedNodeId);
            const schemaId = schemaIdByNode.get(selectedNodeId);
            if (!settings || !schemaId) return;

            try {
                const source = Gio.SettingsSchemaSource.getDefault();
                if (!source) return;
                const schema = source.lookup(schemaId, true);
                if (!schema) return;

                const variantType = new GLib.VariantType(keyInfo.type);
                const variant = GLib.variantParse(newText, variantType);
                if (variant) {
                    const schemaKey = schema.getKey(keyInfo.name);
                    if (!schemaKey.rangeCheck(variant)) {
                        widget.errorBell();
                        return;
                    }
                    settings.setValue(keyInfo.name, variant);
                    setKeyInfos((prev) =>
                        prev.map((k) => (k.name === keyInfo.name ? { ...k, value: variant.print(false) } : k)),
                    );
                }
            } catch {
                widget.errorBell();
            }
        },
        [selectedNodeId],
    );

    return (
        <>
            <x.Slot for="GtkWindow" id="titlebar">
                <GtkHeaderBar>
                    <x.ContainerSlot for={GtkHeaderBar} id="packEnd">
                        <GtkToggleButton
                            iconName="system-search-symbolic"
                            active={keySearchActive}
                            onToggled={(btn) => {
                                setKeySearchActive(btn.getActive());
                                setKeySearchText("");
                            }}
                        />
                    </x.ContainerSlot>
                </GtkHeaderBar>
            </x.Slot>
            <GtkPaned position={300} hexpand vexpand>
                <x.Slot for={GtkPaned} id="startChild">
                    <GtkScrolledWindow>
                        <GtkListView
                            tabBehavior={Gtk.ListTabBehavior.ITEM}
                            selectionMode={Gtk.SelectionMode.BROWSE}
                            onSelectionChanged={handleSchemaSelected}
                            cssClasses={["navigation-sidebar"]}
                            renderItem={(schemaId: string | null) => <GtkLabel label={schemaId ?? ""} xalign={0} />}
                        >
                            {getSchemaTree().map(renderSchemaNode)}
                        </GtkListView>
                    </GtkScrolledWindow>
                </x.Slot>
                <x.Slot for={GtkPaned} id="endChild">
                    <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                        <GtkSearchBar searchModeEnabled={keySearchActive}>
                            <GtkSearchEntry onSearchChanged={handleKeySearchChanged} onStopSearch={handleStopSearch} />
                        </GtkSearchBar>
                        <GtkScrolledWindow hexpand vexpand>
                            <GtkColumnView
                                ref={columnViewRef}
                                tabBehavior={Gtk.ListTabBehavior.CELL}
                                cssClasses={["data-table"]}
                            >
                                <x.ColumnViewColumn
                                    id="name"
                                    title="Name"
                                    sortable
                                    renderCell={(item: KeyInfo | null) => (
                                        <GtkLabel label={item?.name ?? ""} xalign={0} />
                                    )}
                                />
                                <x.ColumnViewColumn
                                    id="value"
                                    title="Value"
                                    resizable
                                    renderCell={(item: KeyInfo | null) => (
                                        <GtkEditableLabel
                                            text={item?.value ?? ""}
                                            onChanged={(label: Gtk.EditableLabel) => {
                                                if (item) handleValueEdit(item, label.getText(), label);
                                            }}
                                        />
                                    )}
                                />
                                <x.ColumnViewColumn
                                    id="type"
                                    title="Type"
                                    resizable
                                    sortable
                                    renderCell={(item: KeyInfo | null) => (
                                        <GtkLabel label={item?.type ?? ""} xalign={0} />
                                    )}
                                />
                                <x.ColumnViewColumn
                                    id="default"
                                    title="Default"
                                    resizable
                                    expand
                                    renderCell={(item: KeyInfo | null) => (
                                        <GtkLabel label={item?.defaultValue ?? ""} xalign={0} />
                                    )}
                                />
                                <x.ColumnViewColumn
                                    id="summary"
                                    title="Summary"
                                    resizable
                                    visible={false}
                                    expand
                                    renderCell={(item: KeyInfo | null) => (
                                        <GtkLabel label={item?.summary ?? ""} xalign={0} wrap />
                                    )}
                                />
                                <x.ColumnViewColumn
                                    id="description"
                                    title="Description"
                                    resizable
                                    visible={false}
                                    expand
                                    renderCell={(item: KeyInfo | null) => (
                                        <GtkLabel label={item?.description ?? ""} xalign={0} wrap />
                                    )}
                                />
                                {filteredKeyInfos.map((k) => (
                                    <x.ListItem key={k.name} id={k.name} value={k} />
                                ))}
                            </GtkColumnView>
                        </GtkScrolledWindow>
                    </GtkBox>
                </x.Slot>
            </GtkPaned>
        </>
    );
};

export const listviewSettingsDemo: Demo = {
    id: "listview-settings",
    title: "Lists/Settings",
    description:
        "A GSettings browser that enumerates all system schemas and displays their keys, values, types, and descriptions",
    keywords: ["listview", "settings", "GSettings", "GtkColumnView", "search", "schema", "paned", "browser"],
    component: ListViewSettingsDemo,
    sourceCode,
    defaultWidth: 640,
    defaultHeight: 480,
};
