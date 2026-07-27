import { ListView } from "@gtkx/components";
import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import {
    GtkBox,
    GtkEntry,
    GtkHeaderBar,
    GtkLabel,
    GtkScrolledWindow,
    GtkSearchBar,
    GtkSearchEntry,
    GtkToggleButton,
} from "@gtkx/jsx/gtk";
import { createContext, useContext, useRef, useState } from "react";
import type { Demo, DemoProviderProps } from "../types.js";
import sourceCode from "./listview-settings2.tsx?raw";

type KeyItem = {
    id: string;
    name: string;
    value: string;
    defaultValue: string;
    description: string;
    schemaId: string;
    summary: string;
    valueType: string;
};

type SchemaKeys = {
    schemaId: string;
    keys: KeyItem[];
};

type KeysState = React.RefObject<Map<string, string>>;

type SchemaKeysListViewProps = {
    filteredSchemaKeys: SchemaKeys[];
    keysState: KeysState;
    onValueEdit: (key: KeyItem, entry: Gtk.Entry) => void;
};

type Settings2ContextValue = {
    searchMode: boolean;
    setSearchMode: (isEnabled: boolean) => void;
    setSearchText: (text: string) => void;
    filteredSchemaKeys: SchemaKeys[];
    keysState: KeysState;
    handleSearchChanged: (entry: Gtk.SearchEntry) => void;
    handleStopSearch: () => void;
    handleValueEdit: (key: KeyItem, entry: Gtk.Entry) => void;
};

const revertingEntries: WeakSet<Gtk.Entry> = new WeakSet();

const getAllSchemaKeys = (() => {
    let cache: SchemaKeys[] | undefined;

    return (): SchemaKeys[] => {
        cache ??= loadAllSchemaKeys();

        return cache;
    };
})();

const Settings2Context = createContext<Settings2ContextValue | null>(null);

const listviewSettings2Demo: Demo = {
    id: "listview-settings2",
    title: "Lists/Alternative Settings",
    description:
        "This demo shows an alternative settings viewer for GSettings.\n\nIt demonstrates how to implement " +
        "support for sections with GtkListView.\n\nIt also shows how to quickly flatten a large tree of items " +
        "into a list that can be filtered to find the items one is looking for.",
    keywords: ["GtkListHeaderFactory", "GtkSectionModel"],
    component: ListViewSettings2Demo,
    titlebar: ListViewSettings2Titlebar,
    provider: ListViewSettings2Provider,
    sourceCode,
    windowTitle: "Settings",
    defaultWidth: 640,
    defaultHeight: 480,
};

function logError(error: unknown) {
    if (error instanceof Error) {
        console.error(error.message);
    }
}

function loadKeyItem(schemaId: string, schema: Gio.SettingsSchema, settings: Gio.Settings, name: string): KeyItem {
    try {
        const variant = settings.getValue(name);
        const valueStr = variant.print(false);
        const schemaKey = schema.getKey(name);

        return {
            id: `${schemaId}/${name}`,
            name,
            value: valueStr,
            defaultValue: schemaKey.getDefaultValue().print(false),
            description: schemaKey.getDescription() ?? "",
            schemaId,
            summary: schemaKey.getSummary() ?? "",
            valueType: schemaKey.getValueType().dupString(),
        };
    } catch (error) {
        logError(error);

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
}

function loadSchemaKeysFor(source: Gio.SettingsSchemaSource, schemaId: string): KeyItem[] | null {
    try {
        const schema = source.lookup(schemaId, true);

        if (!schema) {
            return null;
        }

        const settings = Gio.Settings.new(schemaId);
        const keys = schema.listKeys().map((name) => loadKeyItem(schemaId, schema, settings, name));
        keys.sort((a, b) => a.name.localeCompare(b.name));

        return keys;
    } catch (error) {
        logError(error);

        return null;
    }
}

function compareSchemaIds(a: string, b: string): number {
    if (a === b) {
        return 0;
    }

    return a < b ? -1 : 1;
}

function loadAllSchemaKeys(): SchemaKeys[] {
    const source = Gio.SettingsSchemaSource.getDefault();

    if (!source) {
        return [];
    }

    const [nonRelocatable] = source.listSchemas(true);
    const schemaIds = nonRelocatable.toSorted(compareSchemaIds);
    const result: SchemaKeys[] = [];

    for (const schemaId of schemaIds) {
        const schemaKeys = loadSchemaKeysFor(source, schemaId);

        if (schemaKeys && schemaKeys.length > 0) {
            result.push({ schemaId, keys: schemaKeys });
        }
    }

    return result;
}

function getSearchString(key: KeyItem): string {
    return `${key.name} ${key.summary} ${key.schemaId}`.toLowerCase();
}

function matchSchemaKeys(schema: SchemaKeys, searchText: string): SchemaKeys | null {
    const matchingKeys = schema.keys.filter((key) => getSearchString(key).includes(searchText));

    if (matchingKeys.length === 0) {
        return null;
    }

    return { schemaId: schema.schemaId, keys: matchingKeys };
}

function filterSchemaKeys(searchText: string): SchemaKeys[] {
    if (!searchText) {
        return getAllSchemaKeys();
    }

    return getAllSchemaKeys()
        .map((schema) => matchSchemaKeys(schema, searchText))
        .filter((schema): schema is SchemaKeys => schema !== null);
}

function revertEntry(entry: Gtk.Entry, key: KeyItem, keysState: KeysState) {
    entry.errorBell();
    revertingEntries.add(entry);

    try {
        entry.setText(keysState.current.get(key.id) ?? key.value);
    } finally {
        revertingEntries.delete(entry);
    }
}

function isWithinSchemaRange(variant: GLib.Variant, key: KeyItem): boolean {
    const source = Gio.SettingsSchemaSource.getDefault();

    if (!source) {
        return true;
    }

    const schema = source.lookup(key.schemaId, true);

    if (!schema) {
        return true;
    }

    const schemaKey = schema.getKey(key.name);

    return schemaKey.rangeCheck(variant);
}

function applySettingValue(key: KeyItem, entry: Gtk.Entry, keysState: KeysState) {
    const variantType = GLib.VariantType.new(key.valueType);
    const variant = GLib.Variant.parse(variantType, entry.getText(), null, null);

    if (!isWithinSchemaRange(variant, key)) {
        revertEntry(entry, key, keysState);

        return;
    }

    const settings = Gio.Settings.new(key.schemaId);
    settings.setValue(key.name, variant);
    keysState.current.set(key.id, variant.print(false));
}

function commitSettingValue(key: KeyItem, entry: Gtk.Entry, keysState: KeysState) {
    if (revertingEntries.has(entry) || !key.valueType) {
        return;
    }

    try {
        applySettingValue(key, entry, keysState);
    } catch (error) {
        logError(error);
        revertEntry(entry, key, keysState);
    }
}

function renderSchemaHeader({ section: schemaId }: { section: string }) {
    return <GtkLabel xalign={0}>{schemaId}</GtkLabel>;
}

const SchemaKeysListView = ({ filteredSchemaKeys, keysState, onValueEdit }: SchemaKeysListViewProps) => (
    <GtkScrolledWindow name="scrolled">
        <ListView
            name="list-view"
            vexpand
            cssClasses={["rich-list"]}
            renderItem={({ item: key }: { item: KeyItem }) => (
                <GtkBox>
                    <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                        <GtkLabel xalign={0}>{key.name}</GtkLabel>
                        <GtkLabel cssClasses={["dim-label"]} xalign={0} ellipsize={3}>
                            {key.summary}
                        </GtkLabel>
                    </GtkBox>
                    <GtkEntry
                        text={keysState.current.get(key.id) ?? key.value}
                        halign={Gtk.Align.END}
                        hexpand
                        onChanged={(entry: Gtk.Entry) => {
                            onValueEdit(key, entry);
                        }}
                    />
                </GtkBox>
            )}
            renderHeader={renderSchemaHeader}
            sections={filteredSchemaKeys.map((schema) => ({
                id: schema.schemaId,
                value: schema.schemaId,
                data: schema.keys.map((key) => ({ id: key.id, value: key })),
            }))}
        />
    </GtkScrolledWindow>
);

function useSettings2Context(): Settings2ContextValue {
    const ctx = useContext(Settings2Context);

    if (!ctx) {
        throw new Error("Settings2Context is missing");
    }

    return ctx;
}

function ListViewSettings2Provider({ children }: DemoProviderProps) {
    const [searchText, setSearchText] = useState("");
    const [searchMode, setSearchMode] = useState(false);
    const keysState = useRef(new Map<string, string>());

    const handleSearchChanged = (entry: Gtk.SearchEntry) => {
        setSearchText(entry.getText().toLowerCase());
    };

    const handleStopSearch = () => {
        setSearchText("");
    };

    const filteredSchemaKeys = filterSchemaKeys(searchText);

    const handleValueEdit = (key: KeyItem, entry: Gtk.Entry) => {
        commitSettingValue(key, entry, keysState);
    };

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
}

function ListViewSettings2Titlebar() {
    const { searchMode, setSearchMode, setSearchText } = useSettings2Context();

    return (
        <GtkHeaderBar
            end={(
                <GtkToggleButton
                    name="search-toggle"
                    iconName="system-search-symbolic"
                    active={searchMode}
                    onToggled={(btn) => {
                        setSearchMode(btn.getActive());
                        setSearchText("");
                    }}
                />
            )}
        />
    );
}

function ListViewSettings2Demo() {
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
}

export { listviewSettings2Demo };
