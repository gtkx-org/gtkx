import { useCallback, useSyncExternalStore } from "react";
import { useSettingsScope } from "../components/settings-context.js";
import {
    resolveSettingAccessor,
    type SettingsSchema,
    type SettingsSchemaKeys,
    type SettingsSchemaValues,
    type SettingValue,
} from "../utils/settings.js";

/**
 * Reads and writes a single key of a GSettings schema, re-rendering when the stored value changes.
 * The instance comes from the nearest `SettingsProvider` rendered above for the same schema.
 *
 * @returns The current value, and a setter that writes a new one back to GSettings.
 * @throws When no `SettingsProvider` for the schema is rendered above, or the key is not declared in the schema.
 */
function useSetting<
    K extends SettingsSchemaKeys,
    P extends keyof K,
    V extends SettingsSchemaValues = Record<never, never>,
>(schema: SettingsSchema<K, V>, key: P & string): [SettingValue<K, P, V>, (value: SettingValue<K, P, V>) => void] {
    const { settings, store } = useSettingsScope(schema);
    const accessor = resolveSettingAccessor(settings, schema, key);
    const subscribe = useCallback((listener: () => void) => store.subscribe(key, listener), [store, key]);
    const getSnapshot = (): SettingValue<K, P, V> => store.read(key, accessor.get);
    const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

    return [value, accessor.set];
}

export { useSetting };
