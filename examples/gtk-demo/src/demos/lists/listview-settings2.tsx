import { createRef } from "@gtkx/ffi";
import * as Gio from "@gtkx/ffi/gio";
import * as GLib from "@gtkx/ffi/glib";
import * as Gtk from "@gtkx/ffi/gtk";
import {
    GtkBox,
    GtkEntry,
    GtkHeaderBar,
    GtkLabel,
    GtkListView,
    GtkScrolledWindow,
    GtkSearchBar,
    GtkSearchEntry,
    GtkToggleButton,
    x,
} from "@gtkx/react";
import { useCallback, useMemo, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./listview-settings2.tsx?raw";

interface KeyItem {
    id: string;
    name: string;
    value: string;
    defaultValue: string;
    description: string;
    schemaId: string;
    summary: string;
    valueType: string;
}

interface SchemaKeys {
    schemaId: string;
    keys: KeyItem[];
}

function loadAllSchemaKeys(): SchemaKeys[] {
    const source = Gio.SettingsSchemaSource.getDefault();
    if (!source) return [];

    const nonRelocatable = createRef<string[]>([]);
    const relocatable = createRef<string[]>([]);
    source.listSchemas(true, nonRelocatable, relocatable);

    const schemaIds = nonRelocatable.value.slice().sort();
    const result: SchemaKeys[] = [];

    for (const schemaId of schemaIds) {
        try {
            const schema = source.lookup(schemaId, true);
            if (!schema) continue;

            const settings = new Gio.Settings(schemaId);
            const keyNames = schema.listKeys();
            const keys: KeyItem[] = [];

            for (const name of keyNames) {
                try {
                    const variant = settings.getValue(name);
                    const valueStr = variant.print(false);
                    const schemaKey = schema.getKey(name);
                    const summary = schemaKey.getSummary() ?? "";
                    const description = schemaKey.getDescription() ?? "";
                    const defaultValue = schemaKey.getDefaultValue().print(false);
                    const valueType = schemaKey.getValueType().dupString();

                    keys.push({
                        id: `${schemaId}/${name}`,
                        name,
                        value: valueStr,
                        defaultValue,
                        description,
                        schemaId,
                        summary,
                        valueType,
                    });
                } catch {
                    keys.push({
                        id: `${schemaId}/${name}`,
                        name,
                        value: "<error>",
                        defaultValue: "",
                        description: "",
                        schemaId,
                        summary: "",
                        valueType: "",
                    });
                }
            }

            keys.sort((a, b) => a.name.localeCompare(b.name));
            if (keys.length > 0) {
                result.push({ schemaId, keys });
            }
        } catch {}
    }

    return result;
}

let allSchemaKeys: SchemaKeys[] | undefined;
function getAllSchemaKeys() {
    if (!allSchemaKeys) {
        allSchemaKeys = loadAllSchemaKeys();
    }
    return allSchemaKeys;
}

type TreeValue = { type: "schema"; schemaId: string } | { type: "key"; key: KeyItem };

function getSearchString(key: KeyItem): string {
    return `${key.name} ${key.summary} ${key.description} ${key.schemaId}`.toLowerCase();
}

const ListViewSettings2Demo = () => {
    const [searchText, setSearchText] = useState("");
    const [searchMode, setSearchMode] = useState(false);
    const keysState = useRef(new Map<string, string>());

    const handleSearchChanged = useCallback((entry: Gtk.SearchEntry) => {
        setSearchText(entry.getText().toLowerCase());
    }, []);

    const handleStopSearch = useCallback(() => {
        setSearchText("");
    }, []);

    const filteredSchemaKeys = useMemo(() => {
        if (!searchText) return getAllSchemaKeys();

        return getAllSchemaKeys()
            .map((schema) => {
                const matchingKeys = schema.keys.filter((k) => getSearchString(k).includes(searchText));
                if (matchingKeys.length === 0) return null;
                return { schemaId: schema.schemaId, keys: matchingKeys };
            })
            .filter((s): s is SchemaKeys => s !== null);
    }, [searchText]);

    const handleValueEdit = useCallback((key: KeyItem, entry: Gtk.Entry) => {
        const text = entry.getText();
        if (!key.valueType) return;

        try {
            const variantType = new GLib.VariantType(key.valueType);
            const variant = GLib.variantParse(text, variantType);
            if (!variant) {
                entry.errorBell();
                entry.setText(keysState.current.get(key.id) ?? key.value);
                return;
            }

            const source = Gio.SettingsSchemaSource.getDefault();
            if (source) {
                const schema = source.lookup(key.schemaId, true);
                if (schema) {
                    const schemaKey = schema.getKey(key.name);
                    if (!schemaKey.rangeCheck(variant)) {
                        entry.errorBell();
                        entry.setText(keysState.current.get(key.id) ?? key.value);
                        return;
                    }
                }
            }

            const settings = new Gio.Settings(key.schemaId);
            settings.setValue(key.name, variant);
            keysState.current.set(key.id, variant.print(false));
        } catch {
            entry.errorBell();
            entry.setText(keysState.current.get(key.id) ?? key.value);
        }
    }, []);

    return (
        <>
            <x.Slot for="GtkWindow" id="titlebar">
                <GtkHeaderBar>
                    <x.ContainerSlot for={GtkHeaderBar} id="packEnd">
                        <GtkToggleButton
                            iconName="system-search-symbolic"
                            active={searchMode}
                            onToggled={(btn) => setSearchMode(btn.getActive())}
                        />
                    </x.ContainerSlot>
                </GtkHeaderBar>
            </x.Slot>
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkSearchBar searchModeEnabled={searchMode}>
                    <GtkSearchEntry hexpand onSearchChanged={handleSearchChanged} onStopSearch={handleStopSearch} />
                </GtkSearchBar>
                <GtkScrolledWindow vexpand hscrollbarPolicy={Gtk.PolicyType.NEVER}>
                    <GtkListView
                        cssClasses={["rich-list"]}
                        renderItem={(item: TreeValue | null) => {
                            if (!item) return <GtkLabel label="" />;
                            if (item.type === "schema") {
                                return (
                                    <GtkLabel
                                        label={item.schemaId}
                                        halign={Gtk.Align.START}
                                        cssClasses={["heading"]}
                                        ellipsize={3}
                                    />
                                );
                            }
                            const key = item.key;
                            return (
                                <GtkBox spacing={10}>
                                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={2} hexpand>
                                        <GtkLabel label={key.name} halign={Gtk.Align.START} />
                                        {key.summary ? (
                                            <GtkLabel
                                                label={key.summary}
                                                halign={Gtk.Align.START}
                                                cssClasses={["dim-label"]}
                                                ellipsize={3}
                                            />
                                        ) : null}
                                    </GtkBox>
                                    <GtkEntry
                                        text={keysState.current.get(key.id) ?? key.value}
                                        halign={Gtk.Align.END}
                                        hexpand
                                        onChanged={(entry: Gtk.Entry) => handleValueEdit(key, entry)}
                                    />
                                </GtkBox>
                            );
                        }}
                    >
                        {filteredSchemaKeys.map((schema) => (
                            <x.ListItem
                                key={schema.schemaId}
                                id={schema.schemaId}
                                value={{ type: "schema", schemaId: schema.schemaId } satisfies TreeValue}
                            >
                                {schema.keys.map((key) => (
                                    <x.ListItem
                                        key={key.id}
                                        id={key.id}
                                        value={{ type: "key", key } satisfies TreeValue}
                                        hideExpander
                                    />
                                ))}
                            </x.ListItem>
                        ))}
                    </GtkListView>
                </GtkScrolledWindow>
            </GtkBox>
        </>
    );
};

export const listviewSettings2Demo: Demo = {
    id: "listview-settings2",
    title: "Lists/Alternative Settings",
    description:
        "An alternative GSettings viewer that uses a flat list with section headers. Demonstrates GtkListView sections with GtkListHeader and GtkSectionModel.",
    keywords: ["listview", "section", "header", "settings", "GSettings", "GtkListHeader", "GtkSectionModel"],
    component: ListViewSettings2Demo,
    sourceCode,
    defaultWidth: 640,
    defaultHeight: 480,
};
