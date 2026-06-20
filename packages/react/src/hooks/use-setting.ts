import * as Gio from "@gtkx/gi/gio";
import { useCallback, useEffect, useMemo, useState } from "react";
import { resolveAccessor } from "../utils/settings-accessor.js";
import { useSignal } from "./use-signal.js";

/**
 * A typed reference to a GSettings schema, as produced by importing a
 * `.gschema.xml` file in a GTKX project.
 *
 * The type parameter `K` maps each settings key to its TypeScript value type,
 * carried by the phantom `__keys__` member; `keys` holds the runtime
 * dispatch information {@link useSetting} uses to pick the matching
 * `Gio.Settings` accessor for each key.
 *
 * @example
 * ```tsx
 * import schema from "../com.example.notes.gschema.xml";
 * const [fontSize, setFontSize] = useSetting(schema, "font-size");
 * ```
 */
export interface SchemaRef<K extends object = Record<string, unknown>> {
    /** The GSettings schema ID (e.g. `"com.example.notes"`). */
    readonly id: string;
    /** The instance path for a relocatable schema, or `null` for a schema with a fixed path. */
    readonly path: string | null;
    /** Per-key dispatch tags: a GVariant type string, `"enum"`, or `"flags"`. */
    readonly keys: { readonly [P in keyof K]: string };
    /** Phantom member carrying the key-to-value-type mapping; never set at runtime. */
    // biome-ignore lint/style/useNamingConvention: GObject phantom-type key
    readonly __keys__?: K;
}

/**
 * A typed reference to a relocatable GSettings schema — one declared without
 * a `path` attribute, instantiable at any number of paths (per profile, per
 * project, per account).
 *
 * A relocatable reference cannot be passed to {@link useSetting} directly;
 * call {@link RelocatableSchemaRef.at} to bind it to a concrete path first.
 *
 * @example
 * ```tsx
 * import profile from "../com.example.profile.gschema.xml";
 * const [theme] = useSetting(profile.at(`/com/example/profiles/${profileId}/`), "theme");
 * ```
 */
export interface RelocatableSchemaRef<K extends object = Record<string, unknown>> {
    /** The GSettings schema ID (e.g. `"com.example.profile"`). */
    readonly id: string;
    /** Per-key dispatch tags: a GVariant type string, `"enum"`, or `"flags"`. */
    readonly keys: { readonly [P in keyof K]: string };
    /** Phantom member carrying the key-to-value-type mapping; never set at runtime. */
    // biome-ignore lint/style/useNamingConvention: GObject phantom-type key
    readonly __keys__?: K;
    /**
     * Binds the relocatable schema to a concrete instance path.
     *
     * @param path - The GSettings path for the instance (e.g. `"/org/foo/profiles/a/"`)
     * @returns A {@link SchemaRef} usable with {@link useSetting}
     */
    at(path: string): SchemaRef<K>;
}

/**
 * Subscribes to a key of an imported GSettings schema and returns its current
 * value alongside a setter, similar to `useState`.
 *
 * The key name and value type are checked against the schema: enum keys
 * narrow to a union of their nicks, flags keys to arrays of nicks, and keys
 * whose GVariant type has no native TypeScript mapping surface as
 * `GLib.Variant`. Relocatable schemas must be bound with
 * {@link RelocatableSchemaRef.at} before use.
 *
 * Creates a `Gio.Settings` instance for the schema (stable across
 * re-renders), connects to `changed::key`, and re-renders whenever the
 * setting changes. The initial value is read synchronously at mount time.
 * Calling the returned setter writes the new value to GSettings, which in
 * turn triggers a re-render through the `changed` signal.
 *
 * @param schema - A schema reference imported from a `.gschema.xml` file
 * @param key - One of the schema's settings keys
 * @returns A `[value, setValue]` tuple kept in sync with the GSettings backend
 *
 * @example
 * ```tsx
 * import schema from "../com.example.notes.gschema.xml";
 * const [fontSize, setFontSize] = useSetting(schema, "font-size");
 * ```
 */
export function useSetting<K extends object, P extends keyof K & string>(
    schema: SchemaRef<K>,
    key: P,
): [K[P], (value: K[P]) => void];
export function useSetting(schema: SchemaRef, key: string): [unknown, (value: unknown) => void] {
    const { id: schemaId, path } = schema;
    const accessor = resolveAccessor(schema.keys[key], key, schemaId);

    const settings = useMemo(
        () => (path === null ? Gio.Settings.new(schemaId) : new Gio.Settings({ schemaId, path })),
        [schemaId, path],
    );
    const [value, setValue] = useState<unknown>(() => accessor.read(settings, key));

    useEffect(() => {
        setValue(accessor.read(settings, key));
    }, [accessor, settings, key]);

    useSignal(settings, `changed::${key}`, () => {
        setValue(accessor.read(settings, key));
    });

    const set = useCallback(
        (newValue: unknown) => {
            accessor.write(settings, key, newValue);
        },
        [accessor, settings, key],
    );

    return [value, set];
}
