import * as Gio from "@gtkx/ffi/gio";
import * as GObject from "@gtkx/ffi/gobject";
import { useCallback, useEffect, useMemo, useState } from "react";

interface SettingTypeMap {
    boolean: boolean;
    int: number;
    double: number;
    string: string;
    strv: string[];
}

type SettingType = keyof SettingTypeMap;

const GETTERS: { [K in SettingType]: (settings: Gio.Settings, key: string) => SettingTypeMap[K] } = {
    boolean: (settings, key) => settings.getBoolean(key),
    int: (settings, key) => settings.getInt(key),
    double: (settings, key) => settings.getDouble(key),
    string: (settings, key) => settings.getString(key) ?? "",
    strv: (settings, key) => settings.getStrv(key),
};

const SETTERS: { [K in SettingType]: (settings: Gio.Settings, key: string, value: SettingTypeMap[K]) => void } = {
    boolean: (settings, key, value) => settings.setBoolean(key, value),
    int: (settings, key, value) => settings.setInt(key, value),
    double: (settings, key, value) => settings.setDouble(key, value),
    string: (settings, key, value) => settings.setString(key, value),
    strv: (settings, key, value) => settings.setStrv(key, value),
};

function readSetting<T extends SettingType>(settings: Gio.Settings, key: string, type: T): SettingTypeMap[T] {
    return GETTERS[type](settings, key);
}

function writeSetting<T extends SettingType>(
    settings: Gio.Settings,
    key: string,
    type: T,
    value: SettingTypeMap[T],
): void {
    SETTERS[type](settings, key, value);
}

/**
 * Subscribes to a GSettings key and returns its current value alongside a
 * setter, similar to `useState`.
 *
 * Creates a `Gio.Settings` instance for the given schema (stable across
 * re-renders), connects to `changed::key`, and re-renders whenever the
 * setting changes. The initial value is read synchronously at mount time.
 * Calling the returned setter writes the new value to GSettings, which in
 * turn triggers a re-render through the `changed` signal.
 *
 * @param schemaId - The GSettings schema ID (e.g. `"org.gnome.desktop.interface"`)
 * @param key - The settings key in kebab-case (e.g. `"color-scheme"`)
 * @param type - The value type, used to select the appropriate GSettings getter/setter
 * @returns A `[value, setValue]` tuple kept in sync with the GSettings backend
 *
 * @example
 * ```tsx
 * const [colorScheme, setColorScheme] = useSetting("org.gnome.desktop.interface", "color-scheme", "string");
 * ```
 *
 * @example
 * ```tsx
 * const [fontSize, setFontSize] = useSetting("com.example.myapp", "font-size", "int");
 * ```
 */
export function useSetting<T extends SettingType>(
    schemaId: string,
    key: string,
    type: T,
): [SettingTypeMap[T], (value: SettingTypeMap[T]) => void] {
    const settings = useMemo(() => Gio.Settings.new(schemaId), [schemaId]);
    const [value, setValue] = useState<SettingTypeMap[T]>(() => readSetting(settings, key, type));

    useEffect(() => {
        setValue(readSetting(settings, key, type));

        const handlerId = settings.connect(`changed::${key}`, () => {
            setValue(readSetting(settings, key, type));
        });

        return () => {
            GObject.signalHandlerDisconnect(settings, handlerId);
        };
    }, [settings, key, type]);

    const set = useCallback(
        (newValue: SettingTypeMap[T]) => {
            writeSetting(settings, key, type, newValue);
        },
        [settings, key, type],
    );

    return [value, set];
}
