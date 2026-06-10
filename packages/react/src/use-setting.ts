import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSignal } from "./use-signal.js";

type SettingTypeMap = {
    boolean: boolean;
    int: number;
    double: number;
    string: string;
    strv: string[];
};

type SettingType = keyof SettingTypeMap;

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
    readonly __keys__?: K;
    /**
     * Binds the relocatable schema to a concrete instance path.
     *
     * @param path - The GSettings path for the instance (e.g. `"/org/foo/profiles/a/"`)
     * @returns A {@link SchemaRef} usable with {@link useSetting}
     */
    at(path: string): SchemaRef<K>;
}

type SettingAccessor = {
    read: (settings: Gio.Settings, key: string) => unknown;
    write: (settings: Gio.Settings, key: string, value: unknown) => void;
};

const settingTypeError = (expected: string, value: unknown): TypeError =>
    new TypeError(`Expected ${expected} for the settings value, got ${typeof value}`);

const expectBoolean = (value: unknown): boolean => {
    if (typeof value !== "boolean") throw settingTypeError("a boolean", value);
    return value;
};

const expectNumber = (value: unknown): number => {
    if (typeof value !== "number") throw settingTypeError("a number", value);
    return value;
};

const expectString = (value: unknown): string => {
    if (typeof value !== "string") throw settingTypeError("a string", value);
    return value;
};

const isStringArray = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every((entry) => typeof entry === "string");

const expectStringArray = (value: unknown): string[] => {
    if (!isStringArray(value)) throw settingTypeError("an array of strings", value);
    return value;
};

const expectVariant = (value: unknown): GLib.Variant => {
    if (!(value instanceof GLib.Variant)) throw settingTypeError("a GLib.Variant", value);
    return value;
};

const STRING_ACCESSOR: SettingAccessor = {
    read: (settings, key) => settings.getString(key) ?? "",
    write: (settings, key, value) => settings.setString(key, expectString(value)),
};

const STRV_ACCESSOR: SettingAccessor = {
    read: (settings, key) => settings.getStrv(key),
    write: (settings, key, value) => settings.setStrv(key, expectStringArray(value)),
};

const ACCESSORS: Record<string, SettingAccessor | undefined> = {
    b: {
        read: (settings, key) => settings.getBoolean(key),
        write: (settings, key, value) => settings.setBoolean(key, expectBoolean(value)),
    },
    i: {
        read: (settings, key) => settings.getInt(key),
        write: (settings, key, value) => settings.setInt(key, expectNumber(value)),
    },
    u: {
        read: (settings, key) => settings.getUint(key),
        write: (settings, key, value) => settings.setUint(key, expectNumber(value)),
    },
    x: {
        read: (settings, key) => settings.getInt64(key),
        write: (settings, key, value) => settings.setInt64(key, expectNumber(value)),
    },
    t: {
        read: (settings, key) => settings.getUint64(key),
        write: (settings, key, value) => settings.setUint64(key, expectNumber(value)),
    },
    d: {
        read: (settings, key) => settings.getDouble(key),
        write: (settings, key, value) => settings.setDouble(key, expectNumber(value)),
    },
    s: STRING_ACCESSOR,
    as: STRV_ACCESSOR,
    enum: STRING_ACCESSOR,
    flags: STRV_ACCESSOR,
};

const VARIANT_ACCESSOR: SettingAccessor = {
    read: (settings, key) => settings.getValue(key),
    write: (settings, key, value) => settings.setValue(key, expectVariant(value)),
};

const LEGACY_KINDS: Record<SettingType, string> = {
    boolean: "b",
    int: "i",
    double: "d",
    string: "s",
    strv: "as",
};

const resolveAccessor = (schema: SchemaRef | string, key: string, type: SettingType | undefined): SettingAccessor => {
    if (typeof schema === "string") {
        if (type === undefined) {
            throw new TypeError(`useSetting("${schema}", "${key}") requires a type argument for string schema IDs`);
        }
        const accessor = ACCESSORS[LEGACY_KINDS[type]];
        if (accessor === undefined) throw new TypeError(`Unknown setting type "${type}"`);
        return accessor;
    }
    const kind = schema.keys[key];
    if (kind === undefined) {
        throw new TypeError(`Key "${key}" is not declared by the GSettings schema "${schema.id}"`);
    }
    return ACCESSORS[kind] ?? VARIANT_ACCESSOR;
};

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
/**
 * Subscribes to a GSettings key by schema ID and returns its current value
 * alongside a setter, similar to `useState`.
 *
 * This form addresses schemas the project does not ship — system schemas
 * such as `org.gnome.desktop.interface` — so the key and value type cannot
 * be checked; the `type` argument selects the `Gio.Settings` accessor.
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
 */
export function useSetting<T extends SettingType>(
    schemaId: string,
    key: string,
    type: T,
): [SettingTypeMap[T], (value: SettingTypeMap[T]) => void];
export function useSetting(
    schema: SchemaRef | string,
    key: string,
    type?: SettingType,
): [unknown, (value: unknown) => void] {
    const schemaId = typeof schema === "string" ? schema : schema.id;
    const path = typeof schema === "string" ? null : schema.path;
    const accessor = resolveAccessor(schema, key, type);

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
