import * as Gio from "@gtkx/gi/gio";
import { useMemo } from "react";
import {
    resolveSettingAccessor,
    type SettingsSchema,
    type SettingsSchemaKeys,
    type SettingValue,
} from "../utils/settings.js";
import { useObjectValue } from "./use-object-value.js";

type UseSettingsProps<K extends SettingsSchemaKeys> = Pick<SettingsSchema<K>, "id" | "path">;

const useSettings = <K extends SettingsSchemaKeys>({ id, path }: UseSettingsProps<K>): Gio.Settings =>
    useMemo(() => (path ? new Gio.Settings({ schema: id, path }) : Gio.Settings.new(id)), [id, path]);

/**
 * Reads and writes a single key of a GSettings schema, re-rendering when the stored value changes.
 *
 * @returns The current value, and a setter that writes a new one back to GSettings.
 * @throws When the schema is not installed, needs a path it was not given, or does not declare the key.
 */
function useSetting<K extends SettingsSchemaKeys, P extends keyof K>(
    schema: SettingsSchema<K>,
    key: P & string,
): [SettingValue<K, P>, (value: SettingValue<K, P>) => void] {
    const settings = useSettings({ id: schema.id, path: schema.path });
    const accessor = resolveSettingAccessor(settings, schema, key);
    const value = useObjectValue(settings, `changed::${key}`, () => accessor.get());

    return [value, accessor.set];
}

export { useSettings, useSetting };
