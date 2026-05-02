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

const GETTERS: Record<SettingType, string> = {
    boolean: "getBoolean",
    int: "getInt",
    double: "getDouble",
    string: "getString",
    strv: "getStrv",
};

const SETTERS: Record<SettingType, string> = {
    boolean: "setBoolean",
    int: "setInt",
    double: "setDouble",
    string: "setString",
    strv: "setStrv",
};

type SettingAccessor = (key: string, value?: unknown) => unknown;

function readSetting(settings: Gio.Settings, key: string, type: SettingType): unknown {
    const accessors = settings as unknown as Record<string, SettingAccessor>;
    return accessors[GETTERS[type]]?.call(settings, key);
}

function writeSetting(settings: Gio.Settings, key: string, type: SettingType, value: unknown): void {
    const accessors = settings as unknown as Record<string, SettingAccessor>;
    accessors[SETTERS[type]]?.call(settings, key, value);
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
    const settings = useMemo(() => new Gio.Settings(schemaId), [schemaId]);
    const [value, setValue] = useState<SettingTypeMap[T]>(() => readSetting(settings, key, type) as SettingTypeMap[T]);

    useEffect(() => {
        setValue(readSetting(settings, key, type) as SettingTypeMap[T]);

        const handlerId = settings.connect(`changed::${key}`, () => {
            setValue(readSetting(settings, key, type) as SettingTypeMap[T]);
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
