import type * as Gio from "@gtkx/gi/gio";
import {
    resolveSettingAccessor,
    type SettingsSchema,
    type SettingsSchemaKeys,
    type SettingsSchemaValues,
    type SettingValue,
} from "../utils/settings.js";
import { useObjectValue } from "./use-object-value.js";

/**
 * Reads and writes a single key of a GSettings schema, re-rendering when the stored value changes.
 *
 * @returns The current value, and a setter that writes a new one back to GSettings.
 * @throws When the key is not declared in the schema.
 */
function useSetting<
    K extends SettingsSchemaKeys,
    P extends keyof K,
    V extends SettingsSchemaValues = Record<never, never>,
>(
    settings: Gio.Settings,
    schema: SettingsSchema<K, V>,
    key: P & string,
): [SettingValue<K, P, V>, (value: SettingValue<K, P, V>) => void] {
    const accessor = resolveSettingAccessor(settings, schema, key);
    const value = useObjectValue(settings, `changed::${key}`, () => accessor.get());

    return [value, accessor.set];
}

export { useSetting };
