import type * as Gio from "@gtkx/gi/gio";
import {
    resolveSettingAccessor,
    type SettingsSchema,
    type SettingsSchemaKeys,
    type SettingValue,
} from "../utils/settings.js";
import { useObjectValue } from "./use-object-value.js";

/**
 * Reads and writes a single key of a GSettings schema, re-rendering when the stored value changes.
 *
 * @returns The current value, and a setter that writes a new one back to GSettings.
 * @throws When the key is not declared in the schema.
 */
function useSetting<K extends SettingsSchemaKeys, P extends keyof K>(
    settings: Gio.Settings,
    schema: SettingsSchema<K>,
    key: P & string,
): [SettingValue<K, P>, (value: SettingValue<K, P>) => void] {
    const accessor = resolveSettingAccessor(settings, schema, key);
    const value = useObjectValue(settings, `changed::${key}`, () => accessor.get());

    return [value, accessor.set];
}

export { useSetting };
