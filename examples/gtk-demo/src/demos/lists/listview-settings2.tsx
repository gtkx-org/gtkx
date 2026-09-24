import { ListView } from "@gtkx/components";
import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import { GSettings } from "@gtkx/jsx/gio";
import {
    GtkBox,
    GtkEntry,
    GtkEventControllerFocus,
    GtkHeaderBar,
    GtkLabel,
    GtkScrolledWindow,
    GtkSearchBar,
    GtkSearchEntry,
    GtkToggleButton,
} from "@gtkx/jsx/gtk";
import { createPortal, rootElement } from "@gtkx/react";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { Demo, DemoProviderProps } from "../types.js";
import sourceCode from "./listview-settings2.tsx?raw";

type KeyItem = {
    id: string;
    name: string;
    value: string;
    schemaId: string;
    summary: string;
    schemaKey: Gio.SettingsSchemaKey;
    settings: Gio.Settings;
};

type SchemaKeys = {
    schemaId: string;
    keys: KeyItem[];
};

type Settings2ContextValue = {
    searchText: string;
    isSearchActive: boolean;
    setIsSearchActive: (isEnabled: boolean) => void;
    setSearchText: (text: string) => void;
    filteredSchemaKeys: SchemaKeys[];
    handleSearchChanged: (entry: Gtk.SearchEntry) => void;
    handleStopSearch: () => void;
    handleValueEdit: (key: KeyItem, entry: Gtk.Entry) => void;
};

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

function loadKeyItem(schema: Gio.SettingsSchema, settings: Gio.Settings, name: string): KeyItem {
    const schemaId = schema.getId();
    const schemaKey = schema.getKey(name);

    return {
        id: `${schemaId}/${name}`,
        name,
        value: settings.getValue(name).print(false),
        schemaId,
        summary: schemaKey.getSummary() ?? "",
        schemaKey,
        settings,
    };
}

function SchemaSettings({ schemaId, onLoaded }: {
    schemaId: string;
    onLoaded: (schema: SchemaKeys) => void;
}) {
    const handleRef = useCallback((settings: Gio.Settings | null) => {
        if (!settings) {
            return;
        }

        const schema = GObject.getProperty(settings, "settingsSchema") as Gio.SettingsSchema;
        const keys = schema.listKeys()
            .toSorted((a, b) => a.localeCompare(b))
            .map((name) => loadKeyItem(schema, settings, name));
        onLoaded({ schemaId, keys });
    }, [schemaId, onLoaded]);

    return createPortal(<GSettings schemaId={schemaId} ref={handleRef} />, rootElement);
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

function filterSchemaKeys(allSchemaKeys: SchemaKeys[], searchText: string): SchemaKeys[] {
    if (!searchText) {
        return allSchemaKeys;
    }

    return allSchemaKeys
        .map((schema) => matchSchemaKeys(schema, searchText))
        .filter((schema): schema is SchemaKeys => schema !== null);
}

function applySettingValue(key: KeyItem, entry: Gtk.Entry): string {
    const variant = GLib.Variant.parse(key.schemaKey.getValueType(), entry.getText(), null, null);

    if (!key.schemaKey.rangeCheck(variant) || !key.settings.setValue(key.name, variant)) {
        throw new Error("Cannot save this setting");
    }

    return variant.print(false);
}

function replaceKeyValue(schemas: SchemaKeys[], keyId: string, value: string): SchemaKeys[] {
    return schemas.map((schema) => ({
        ...schema,
        keys: schema.keys.map((item) => item.id === keyId ? { ...item, value } : item),
    }));
}

function SettingEntry({ item, onValueEdit }: {
    item: KeyItem;
    onValueEdit: (key: KeyItem, entry: Gtk.Entry) => void;
}) {
    const entryRef = useRef<Gtk.Entry | null>(null);

    return (
        <GtkEntry
            ref={entryRef}
            text={item.value}
            accessibleLabel={`Value for ${item.schemaId}/${item.name}`}
            halign={Gtk.Align.END}
            hexpand
            onActivate={(entry) => {
                onValueEdit(item, entry);
            }}
            controllers={(
                <GtkEventControllerFocus
                    onLeave={() => {
                        if (entryRef.current) {
                            onValueEdit(item, entryRef.current);
                        }
                    }}
                />
            )}
        />
    );
}

function renderSchemaHeader({ section: schemaId }: { section: string }) {
    return <GtkLabel xalign={0}>{schemaId}</GtkLabel>;
}

const SchemaKeysListView = ({ filteredSchemaKeys, onValueEdit }: {
    filteredSchemaKeys: SchemaKeys[];
    onValueEdit: (key: KeyItem, entry: Gtk.Entry) => void;
}) => (
    <GtkScrolledWindow name="scrolled" vexpand>
        <ListView
            name="list-view"
            vexpand
            selectionMode={Gtk.SelectionMode.NONE}
            cssClasses={["rich-list"]}
            renderItem={({ item: key }: { item: KeyItem }) => (
                <GtkBox>
                    <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                        <GtkLabel xalign={0}>{key.name}</GtkLabel>
                        <GtkLabel cssClasses={["dim-label"]} xalign={0} ellipsize={Pango.EllipsizeMode.END}>
                            {key.summary}
                        </GtkLabel>
                    </GtkBox>
                    <SettingEntry item={key} onValueEdit={onValueEdit} />
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
    const [isSearchActive, setIsSearchActive] = useState(false);
    const [schemaIds] = useState(() =>
        Gio.SettingsSchemaSource.getDefault()?.listSchemas(true)[0].toSorted((a, b) => a.localeCompare(b)) ?? [],
    );
    const [allSchemaKeys, setAllSchemaKeys] = useState<SchemaKeys[]>([]);
    const handleSchemaLoaded = useCallback((schema: SchemaKeys) => {
        setAllSchemaKeys((previous) => [...previous.filter((item) => item.schemaId !== schema.schemaId), schema]
            .toSorted((a, b) => a.schemaId.localeCompare(b.schemaId)));
    }, []);

    const handleSearchChanged = (entry: Gtk.SearchEntry) => {
        setSearchText(entry.getText());
    };

    const handleStopSearch = () => {
        setIsSearchActive(false);
        setSearchText("");
    };

    const filteredSchemaKeys = filterSchemaKeys(allSchemaKeys, searchText.toLowerCase());

    const handleValueEdit = (key: KeyItem, entry: Gtk.Entry) => {
        if (entry.getText() === key.value) {
            return;
        }

        try {
            const value = applySettingValue(key, entry);
            setAllSchemaKeys((previous) => replaceKeyValue(previous, key.id, value));
        } catch {
            entry.setText(key.value);
            entry.errorBell();
        }
    };

    const value = {
        searchText,
        isSearchActive,
        setIsSearchActive,
        setSearchText,
        filteredSchemaKeys,
        handleSearchChanged,
        handleStopSearch,
        handleValueEdit,
    };

    return (
        <Settings2Context.Provider value={value}>
            {schemaIds.map((schemaId) => (
                <SchemaSettings key={schemaId} schemaId={schemaId} onLoaded={handleSchemaLoaded} />
            ))}
            {children}
        </Settings2Context.Provider>
    );
}

function ListViewSettings2Titlebar() {
    const { isSearchActive, setIsSearchActive, setSearchText } = useSettings2Context();

    return (
        <GtkHeaderBar
            end={(
                <GtkToggleButton
                    name="search-toggle"
                    iconName="system-search-symbolic"
                    accessibleLabel="Search settings"
                    active={isSearchActive}
                    onToggled={(btn) => {
                        setIsSearchActive(btn.getActive());
                        setSearchText("");
                    }}
                />
            )}
        />
    );
}

function ListViewSettings2Demo() {
    const { searchText, isSearchActive, filteredSchemaKeys, handleSearchChanged, handleStopSearch, handleValueEdit } =
        useSettings2Context();

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkSearchBar name="search-bar" searchModeEnabled={isSearchActive}>
                <GtkSearchEntry
                    name="search-entry"
                    accessibleLabel="Search settings"
                    text={searchText}
                    onSearchChanged={handleSearchChanged}
                    onStopSearch={handleStopSearch}
                />
            </GtkSearchBar>
            <SchemaKeysListView
                filteredSchemaKeys={filteredSchemaKeys}
                onValueEdit={handleValueEdit}
            />
        </GtkBox>
    );
}

export { listviewSettings2Demo };
