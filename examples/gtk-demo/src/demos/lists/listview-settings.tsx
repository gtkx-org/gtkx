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

interface SchemaGroup {
    prefix: string;
    schemas: { id: string; shortName: string }[];
}

function loadSchemaList(): string[] {
    const source = Gio.SettingsSchemaSource.getDefault();
    if (!source) return [];

    const nonRelocatable = createRef<string[]>([]);
    const relocatable = createRef<string[]>([]);
    source.listSchemas(true, nonRelocatable, relocatable);
    return nonRelocatable.value.sort();
}

function groupSchemas(schemaIds: string[]): SchemaGroup[] {
    const groups = new Map<string, { id: string; shortName: string }[]>();

    for (const id of schemaIds) {
        const parts = id.split(".");
        const shortName = parts[parts.length - 1] ?? id;
        const prefix = parts.slice(0, -1).join(".");

        const existing = groups.get(prefix);
        if (existing) existing.push({ id, shortName });
        else groups.set(prefix, [{ id, shortName }]);
    }

    return [...groups.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([prefix, schemas]) => ({
            prefix,
            schemas: schemas.sort((a, b) => a.shortName.localeCompare(b.shortName)),
        }));
}

function loadKeysForSchema(schemaId: string): KeyInfo[] {
    const source = Gio.SettingsSchemaSource.getDefault();
    if (!source) return [];

    const schema = source.lookup(schemaId, true);
    if (!schema) return [];

    const keys = schema.listKeys();
    const settings = new Gio.Settings(schemaId);
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

let allSchemas: string[] | undefined;
let allSchemaSet: Set<string> | undefined;
let schemaGroups: ReturnType<typeof groupSchemas> | undefined;

function getAllSchemas() {
    if (!allSchemas) {
        allSchemas = loadSchemaList();
    }
    return allSchemas;
}

function getAllSchemaSet() {
    if (!allSchemaSet) {
        allSchemaSet = new Set(getAllSchemas());
    }
    return allSchemaSet;
}

function getSchemaGroups() {
    if (!schemaGroups) {
        schemaGroups = groupSchemas(getAllSchemas());
    }
    return schemaGroups;
}

let childSchemaCache: Map<string, { id: string; shortName: string }[]> | undefined;

function getChildSchemas(schemaId: string): { id: string; shortName: string }[] {
    if (!childSchemaCache) {
        childSchemaCache = new Map();
        const source = Gio.SettingsSchemaSource.getDefault();
        if (source) {
            for (const id of getAllSchemas()) {
                const schema = source.lookup(id, true);
                if (!schema) continue;
                const childNames = schema.listChildren();
                if (childNames.length > 0) {
                    const children = childNames
                        .map((name) => {
                            const childId = `${id}.${name}`;
                            return getAllSchemaSet().has(childId) ? { id: childId, shortName: name } : null;
                        })
                        .filter((c): c is { id: string; shortName: string } => c !== null)
                        .sort((a, b) => a.shortName.localeCompare(b.shortName));
                    if (children.length > 0) {
                        childSchemaCache.set(id, children);
                    }
                }
            }
        }
    }
    return childSchemaCache.get(schemaId) ?? [];
}

function renderSchemaChildren(schemaId: string): ReactNode {
    const children = getChildSchemas(schemaId);
    if (children.length === 0) return null;
    return children.map((child) => {
        const grandChildren = getChildSchemas(child.id);
        if (grandChildren.length === 0) {
            return <x.ListItem key={child.id} id={child.id} value={child.shortName} hideExpander />;
        }
        return (
            <x.ListItem key={child.id} id={child.id} value={child.shortName}>
                {renderSchemaChildren(child.id)}
            </x.ListItem>
        );
    });
}

const ListViewSettingsDemo = () => {
    const [selectedSchemaId, setSelectedSchemaId] = useState<string | null>(null);
    const [keyInfos, setKeyInfos] = useState<KeyInfo[]>([]);
    const [keySearchActive, setKeySearchActive] = useState(false);
    const [keySearchText, setKeySearchText] = useState("");

    const handleSchemaSelected = useCallback((ids: string[]) => {
        const id = ids[0];
        if (!id || !getAllSchemaSet().has(id)) return;
        setSelectedSchemaId(id);
        setKeyInfos(loadKeysForSchema(id));
    }, []);

    const filteredKeyInfos = useMemo(() => {
        if (!keySearchText) return keyInfos;
        const lower = keySearchText.toLowerCase();
        return keyInfos.filter(
            (k) =>
                k.name.toLowerCase().includes(lower) ||
                k.summary.toLowerCase().includes(lower) ||
                k.description.toLowerCase().includes(lower),
        );
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
            if (!selectedSchemaId) return;
            try {
                const source = Gio.SettingsSchemaSource.getDefault();
                if (!source) return;
                const schema = source.lookup(selectedSchemaId, true);
                if (!schema) return;

                const variantType = new GLib.VariantType(keyInfo.type);
                const variant = GLib.variantParse(newText, variantType);
                if (variant) {
                    const schemaKey = schema.getKey(keyInfo.name);
                    if (!schemaKey.rangeCheck(variant)) {
                        widget.errorBell();
                        return;
                    }
                    const settings = new Gio.Settings(selectedSchemaId);
                    settings.setValue(keyInfo.name, variant);
                    setKeyInfos((prev) =>
                        prev.map((k) => (k.name === keyInfo.name ? { ...k, value: variant.print(false) } : k)),
                    );
                }
            } catch {
                widget.errorBell();
            }
        },
        [selectedSchemaId],
    );

    return (
        <>
            <x.Slot for="GtkWindow" id="titlebar">
                <GtkHeaderBar>
                    <x.Slot for={GtkHeaderBar} id="titleWidget">
                        <GtkLabel label="Settings" ellipsize={3} />
                    </x.Slot>
                    <x.ContainerSlot for={GtkHeaderBar} id="packEnd">
                        <GtkToggleButton
                            iconName="system-search-symbolic"
                            active={keySearchActive}
                            onToggled={(btn) => {
                                const active = btn.getActive();
                                setKeySearchActive(active);
                                if (!active) setKeySearchText("");
                            }}
                        />
                    </x.ContainerSlot>
                </GtkHeaderBar>
            </x.Slot>
            <GtkPaned position={300} hexpand vexpand shrinkStartChild={false} shrinkEndChild={false}>
                <x.Slot for={GtkPaned} id="startChild">
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} widthRequest={200}>
                        <GtkScrolledWindow vexpand hscrollbarPolicy={Gtk.PolicyType.NEVER}>
                            <GtkColumnView
                                showColumnSeparators={false}
                                showRowSeparators={false}
                                estimatedRowHeight={28}
                                selectionMode={Gtk.SelectionMode.BROWSE}
                                onSelectionChanged={handleSchemaSelected}
                                cssClasses={["navigation-sidebar"]}
                            >
                                <x.ColumnViewColumn
                                    id="schema-id"
                                    title="Schema"
                                    renderCell={(value: string | null) => (
                                        <GtkLabel
                                            label={value ?? ""}
                                            halign={Gtk.Align.START}
                                            ellipsize={3}
                                            marginTop={2}
                                            marginBottom={2}
                                            marginStart={4}
                                            cssClasses={["monospace", "caption"]}
                                        />
                                    )}
                                />
                                {getSchemaGroups().map((group) => (
                                    <x.ListItem key={group.prefix} id={group.prefix} value={group.prefix}>
                                        {group.schemas.map((s) => {
                                            const children = renderSchemaChildren(s.id);
                                            if (children) {
                                                return (
                                                    <x.ListItem key={s.id} id={s.id} value={s.shortName}>
                                                        {children}
                                                    </x.ListItem>
                                                );
                                            }
                                            return <x.ListItem key={s.id} id={s.id} value={s.shortName} hideExpander />;
                                        })}
                                    </x.ListItem>
                                ))}
                            </GtkColumnView>
                        </GtkScrolledWindow>
                    </GtkBox>
                </x.Slot>
                <x.Slot for={GtkPaned} id="endChild">
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} hexpand vexpand>
                        <GtkSearchBar searchModeEnabled={keySearchActive}>
                            <GtkSearchEntry
                                placeholderText="Search keys..."
                                onSearchChanged={handleKeySearchChanged}
                                onStopSearch={handleStopSearch}
                            />
                        </GtkSearchBar>
                        <GtkScrolledWindow vexpand hexpand>
                            <GtkColumnView
                                ref={columnViewRef}
                                showColumnSeparators
                                showRowSeparators
                                estimatedRowHeight={32}
                                cssClasses={["data-table"]}
                            >
                                <x.ColumnViewColumn
                                    id="name"
                                    title="Name"
                                    sortable
                                    renderCell={(item: KeyInfo | null) => (
                                        <GtkLabel
                                            label={item?.name ?? ""}
                                            halign={Gtk.Align.START}
                                            ellipsize={3}
                                            marginTop={4}
                                            marginBottom={4}
                                            marginStart={4}
                                            cssClasses={["monospace"]}
                                        />
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
                                            cssClasses={["monospace"]}
                                            marginTop={2}
                                            marginBottom={2}
                                        />
                                    )}
                                />
                                <x.ColumnViewColumn
                                    id="type"
                                    title="Type"
                                    resizable
                                    sortable
                                    renderCell={(item: KeyInfo | null) => (
                                        <GtkLabel
                                            label={item?.type ?? ""}
                                            halign={Gtk.Align.START}
                                            marginTop={4}
                                            marginBottom={4}
                                            cssClasses={["dim-label", "caption", "monospace"]}
                                        />
                                    )}
                                />
                                <x.ColumnViewColumn
                                    id="default"
                                    title="Default"
                                    resizable
                                    expand
                                    renderCell={(item: KeyInfo | null) => (
                                        <GtkLabel
                                            label={item?.defaultValue ?? ""}
                                            halign={Gtk.Align.START}
                                            ellipsize={3}
                                            marginTop={4}
                                            marginBottom={4}
                                            cssClasses={["dim-label", "monospace"]}
                                        />
                                    )}
                                />
                                <x.ColumnViewColumn
                                    id="summary"
                                    title="Summary"
                                    resizable
                                    visible={false}
                                    expand
                                    renderCell={(item: KeyInfo | null) => (
                                        <GtkLabel
                                            label={item?.summary ?? ""}
                                            halign={Gtk.Align.START}
                                            wrap
                                            marginTop={4}
                                            marginBottom={4}
                                        />
                                    )}
                                />
                                <x.ColumnViewColumn
                                    id="description"
                                    title="Description"
                                    resizable
                                    visible={false}
                                    expand
                                    renderCell={(item: KeyInfo | null) => (
                                        <GtkLabel
                                            label={item?.description ?? ""}
                                            halign={Gtk.Align.START}
                                            ellipsize={3}
                                            marginTop={4}
                                            marginBottom={4}
                                            wrap
                                        />
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
