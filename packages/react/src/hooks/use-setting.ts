import * as Gio from "@gtkx/gi/gio";
import assert from "node:assert";
import { useLayoutEffect, useRef } from "react";
import {
    resolveSettingAccessor,
    type SettingsSchema,
    type SettingsSchemaKeys,
    type SettingValue,
} from "../utils/settings.js";
import { useObjectValue } from "./use-object-value.js";

type UseSettingsProps<K extends SettingsSchemaKeys> = Pick<SettingsSchema<K>, "id" | "path">;

export const useSettings = <K extends SettingsSchemaKeys>({ id, path }: UseSettingsProps<K>): Gio.Settings => {
    const settingsRef = useRef<Gio.Settings>(null);
    const createSettings = () => (path ? new Gio.Settings({ schema: id, path }) : Gio.Settings.new(id));

    if (settingsRef.current === null) {
        settingsRef.current = createSettings();
    }

    useLayoutEffect(() => {
        const settings = settingsRef.current;
        assert.ok(settings, "Settings instance should be initialized before useLayoutEffect");

        if (path !== settings.path || id !== settings.schema) {
            settingsRef.current = createSettings();
        }
    }, [id, path]);

    return settingsRef.current;
};

/**
 * Reads and writes a single key of a GSettings schema, re-rendering when the stored value changes.
 *
 * @param schema The schema reference identifying the settings backend.
 * @param key The key within the schema to read and write.
 * @returns A tuple of the current value and a setter that persists a new value.
 */
export function useSetting<K extends SettingsSchemaKeys, P extends keyof K>(
    schema: SettingsSchema<K>,
    key: P & string,
): [SettingValue<K, P>, (value: SettingValue<K, P>) => void] {
    const settings = useSettings({ id: schema.id, path: schema.path });
    const accessor = resolveSettingAccessor(settings, schema, key);
    const value = useObjectValue(settings, `changed::${key}`, () => accessor.get());
    return [value, accessor.set];
}
