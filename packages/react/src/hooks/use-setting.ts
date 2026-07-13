import * as Gio from "@gtkx/gi/gio";
import { useCallback, useMemo } from "react";
import { resolveAccessor } from "../utils/settings-accessor.js";
import { useGObjectValue } from "./use-gobject-value.js";

/**
 * A typed reference to a GSettings schema: its id, path, and the mapping of typed keys to their setting names.
 */
export type SchemaRef<K extends object = Record<string, unknown>> = {
    id: string;
    /** The schema's object path, or `null` to use the schema's default path. */
    path: string | null;
    /** Maps each typed key of `K` to its corresponding GSettings key name. */
    keys: { [P in keyof K]: string };
    /** Phantom field carrying the value type `K`; never populated at runtime. */
    __keys__?: K;
};

export const useSettingsInstance = ({ id, path }: Pick<SchemaRef, "id" | "path">): Gio.Settings =>
    useMemo(() => (path === null ? Gio.Settings.new(id) : new Gio.Settings({ schemaId: id, path })), [id, path]);

/**
 * Reads and writes a single key of a GSettings schema, re-rendering when the stored value changes.
 *
 * @param schema The schema reference identifying the settings backend.
 * @param key The key within the schema to read and write.
 * @returns A tuple of the current value and a setter that persists a new value.
 */
export function useSetting<K extends object, P extends keyof K & string>(
    schema: SchemaRef<K>,
    key: P,
): [K[P], (value: K[P]) => void];
export function useSetting(schema: SchemaRef, key: string): [unknown, (value: unknown) => void] {
    const accessor = resolveAccessor(schema.keys[key], key, schema.id);
    const settings = useSettingsInstance(schema);

    const value = useGObjectValue(settings, `changed::${key}`, () => accessor.read(settings, key));

    const set = useCallback(
        (newValue: unknown) => {
            accessor.write(settings, key, newValue);
        },
        [accessor, settings, key],
    );

    return [value, set];
}
