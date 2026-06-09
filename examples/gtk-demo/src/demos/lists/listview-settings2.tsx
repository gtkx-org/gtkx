import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
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
} from "@gtkx/react";

import { createContext, useContext, useRef, useState } from "react";
import type { Demo, DemoProviderProps } from "../types.js";
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

const loadKeyItem = (schemaId: string, schema: Gio.SettingsSchema, settings: Gio.Settings, name: string): KeyItem => {
    try {
        const variant = settings.getValue(name);
        const valueStr = variant.print(false) ?? "";
        const schemaKey = schema.getKey(name);
        return {
            id: `${schemaId}/${name}`,
            name,
            value: valueStr,
            defaultValue: schemaKey.getDefaultValue().print(false) ?? "",
            description: schemaKey.getDescription() ?? "",
            schemaId,
            summary: schemaKey.getSummary() ?? "",
            valueType: schemaKey.getValueType().dupString() ?? "",
        };
    } catch (e) {
        if (e instanceof Error) console.error(e.message);
        return {
            id: `${schemaId}/${name}`,
            name,
            value: "<error>",
            defaultValue: "",
            description: "",
            schemaId,
            summary: "",
            valueType: "",
        };
    }
};

const loadSchemaKeysFor = (source: Gio.SettingsSchemaSource, schemaId: string): KeyItem[] | null => {
    try {
        const schema = source.lookup(schemaId, true);
        if (!schema) return null;

        const settings = Gio.Settings.new(schemaId);
        const keys = schema.listKeys().map((name) => loadKeyItem(schemaId, schema, settings, name));
        keys.sort((a, b) => a.name.localeCompare(b.name));
        return keys;
    } catch (e) {
        if (e instanceof Error) console.error(e.message);
        return null;
    }
};

function loadAllSchemaKeys(): SchemaKeys[] {
    const source = Gio.SettingsSchemaSource.getDefault();
    if (!source) return [];

    const [nonRelocatable] = source.listSchemas(true);
    const schemaIds = nonRelocatable.slice().sort();
    const result: SchemaKeys[] = [];

    for (const schemaId of schemaIds) {
        const schemaKeys = loadSchemaKeysFor(source, schemaId);
        if (schemaKeys && schemaKeys.length > 0) {
            result.push({ schemaId, keys: schemaKeys });
        }
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

function getSearchString(key: KeyItem): string {
    return `${key.name} ${key.summary} ${key.schemaId}`.toLowerCase();
}

const filterSchemaKeys = (searchText: string): SchemaKeys[] => {
    if (!searchText) return getAllSchemaKeys();
    return getAllSchemaKeys()
        .map((schema) => {
            const matchingKeys = schema.keys.filter((k) => getSearchString(k).includes(searchText));
            if (matchingKeys.length === 0) return null;
            return { schemaId: schema.schemaId, keys: matchingKeys };
        })
        .filter((s): s is SchemaKeys => s !== null);
};

const revertEntry = (entry: Gtk.Entry, key: KeyItem, keysState: React.RefObject<Map<string, string>>) => {
    entry.errorBell();
    entry.setText(keysState.current.get(key.id) ?? key.value);
};

const validateAgainstSchema = (variant: GLib.Variant, key: KeyItem): boolean => {
    const source = Gio.SettingsSchemaSource.getDefault();
    if (!source) return true;
    const schema = source.lookup(key.schemaId, true);
    if (!schema) return true;
    const schemaKey = schema.getKey(key.name);
    return schemaKey.rangeCheck(variant);
};

const commitSettingValue = (key: KeyItem, entry: Gtk.Entry, keysState: React.RefObject<Map<string, string>>) => {
    const text = entry.getText();
    if (!key.valueType) return;
    try {
        const variantType = GLib.VariantType.new(key.valueType);
        const variant = GLib.variantParse(variantType, text, null, null);
        if (!variant || !validateAgainstSchema(variant, key)) {
            revertEntry(entry, key, keysState);
            return;
        }
        const settings = Gio.Settings.new(key.schemaId);
        settings.setValue(key.name, variant);
        keysState.current.set(key.id, variant.print(false) ?? "");
    } catch (e) {
        if (e instanceof Error) console.error(e.message);
        revertEntry(entry, key, keysState);
    }
};

interface SchemaKeysListViewProps {
    filteredSchemaKeys: SchemaKeys[];
    keysState: React.RefObject<Map<string, string>>;
    onValueEdit: (key: KeyItem, entry: Gtk.Entry) => void;
}

const SchemaKeysListView = ({ filteredSchemaKeys, keysState, onValueEdit }: SchemaKeysListViewProps) => (
    <GtkScrolledWindow name="scrolled">
        <GtkListView
            name="list-view"
            vexpand
            cssClasses={["rich-list"]}
            renderItem={(key: KeyItem) => (
                <GtkBox>
                    <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                        <GtkLabel label={key.name} xalign={0} />
                        <GtkLabel label={key.summary} cssClasses={["dim-label"]} xalign={0} ellipsize={3} />
                    </GtkBox>
                    <GtkEntry
                        text={keysState.current.get(key.id) ?? key.value}
                        halign={Gtk.Align.END}
                        hexpand
                        onChanged={(entry: Gtk.Entry) => onValueEdit(key, entry)}
                    />
                </GtkBox>
            )}
            renderHeader={(schemaId: string) => <GtkLabel label={schemaId} xalign={0} />}
            items={filteredSchemaKeys.map((schema) => ({
                id: schema.schemaId,
                value: schema.schemaId,
                section: true,
                children: schema.keys.map((key) => ({ id: key.id, value: key })),
            }))}
        />
    </GtkScrolledWindow>
);

interface Settings2ContextValue {
    searchMode: boolean;
    setSearchMode: (value: boolean) => void;
    setSearchText: (value: string) => void;
    filteredSchemaKeys: SchemaKeys[];
    keysState: React.RefObject<Map<string, string>>;
    handleSearchChanged: (entry: Gtk.SearchEntry) => void;
    handleStopSearch: () => void;
    handleValueEdit: (key: KeyItem, entry: Gtk.Entry) => void;
}

const Settings2Context = createContext<Settings2ContextValue | null>(null);

const useSettings2Context = (): Settings2ContextValue => {
    const ctx = useContext(Settings2Context);
    if (!ctx) throw new Error("Settings2Context is missing");
    return ctx;
};

const ListViewSettings2Provider = ({ children }: DemoProviderProps) => {
    const [searchText, setSearchText] = useState("");
    const [searchMode, setSearchMode] = useState(false);
    const keysState = useRef(new Map<string, string>());

    const handleSearchChanged = (entry: Gtk.SearchEntry) => setSearchText(entry.getText().toLowerCase());

    const handleStopSearch = () => setSearchText("");

    const filteredSchemaKeys = filterSchemaKeys(searchText);

    const handleValueEdit = (key: KeyItem, entry: Gtk.Entry) => commitSettingValue(key, entry, keysState);

    const value = {
        searchMode,
        setSearchMode,
        setSearchText,
        filteredSchemaKeys,
        keysState,
        handleSearchChanged,
        handleStopSearch,
        handleValueEdit,
    };

    return <Settings2Context.Provider value={value}>{children}</Settings2Context.Provider>;
};

const ListViewSettings2Titlebar = () => {
    const { searchMode, setSearchMode, setSearchText } = useSettings2Context();
    return (
        <GtkHeaderBar
            packEnd={
                <GtkToggleButton
                    name="search-toggle"
                    iconName="system-search-symbolic"
                    active={searchMode}
                    onToggled={(btn) => {
                        setSearchMode(btn.getActive());
                        setSearchText("");
                    }}
                />
            }
        />
    );
};

const ListViewSettings2Demo = () => {
    const { searchMode, filteredSchemaKeys, keysState, handleSearchChanged, handleStopSearch, handleValueEdit } =
        useSettings2Context();
    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkSearchBar name="search-bar" searchModeEnabled={searchMode}>
                <GtkSearchEntry
                    name="search-entry"
                    onSearchChanged={handleSearchChanged}
                    onStopSearch={handleStopSearch}
                />
            </GtkSearchBar>
            <SchemaKeysListView
                filteredSchemaKeys={filteredSchemaKeys}
                keysState={keysState}
                onValueEdit={handleValueEdit}
            />
        </GtkBox>
    );
};

export const listviewSettings2Demo: Demo = {
    id: "listview-settings2",
    title: "Lists/Alternative Settings",
    description:
        "This demo shows an alternative settings viewer for GSettings.\n\nIt demonstrates how to implement support for sections with GtkListView.\n\nIt also shows how to quickly flatten a large tree of items into a list that can be filtered to find the items one is looking for.",
    keywords: ["GtkListHeaderFactory", "GtkSectionModel"],
    component: ListViewSettings2Demo,
    titlebar: ListViewSettings2Titlebar,
    provider: ListViewSettings2Provider,
    sourceCode,
    windowTitle: "Settings",
    defaultWidth: 640,
    defaultHeight: 480,
};
