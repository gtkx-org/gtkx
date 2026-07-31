import type * as Gio from "@gtkx/gi/gio";
import { packVariant, parseVariantType, unpackVariant, type VariantValue } from "./variant.js";

/** Maps each key of a GSettings schema to its kind: a GVariant type string, or `enum` or `flags`. */
type SettingsSchemaKeys = Record<string, string>;
type SettingKindValue<S extends string> = S extends "enum" | "flags" ? number : VariantValue<S>;
/** The JavaScript type key `P` holds: `number` for `enum` and `flags`, otherwise the unpacked GVariant. */
type SettingValue<K extends SettingsSchemaKeys, P extends keyof K> = SettingKindValue<K[P] & string>;

/** A GSettings schema, as described by the modules GTKX generates from a project's `.gschema.xml` files. */
type SettingsSchema<K extends SettingsSchemaKeys = SettingsSchemaKeys> = {
    /** Schema id it is looked up by, such as `org.gtkx.Example`. */
    id: string;
    /** Path a relocatable schema is instantiated at, or `null` to use the schema's own path. */
    path: string | null;
    /** Kind of every key the schema declares, which types reads and writes of that key. */
    keys: K;
};

type SettingAccessor<T = unknown> = {
    get: (settings: Gio.Settings, key: string) => T;
    set: (settings: Gio.Settings, key: string, value: T) => void;
};

type ResolvedSettingAccessor<K extends SettingsSchemaKeys, P extends keyof K> = {
    get: () => SettingValue<K, P>;
    set: (value: SettingValue<K, P>) => void;
};

const ACCESSORS: Record<string, SettingAccessor<number> | undefined> = {
    enum: {
        get: (settings: Gio.Settings, key: string) => settings.getEnum(key),
        set: (settings: Gio.Settings, key: string, value: number) => {
            settings.setEnum(key, value);
        },
    },
    flags: {
        get: (settings: Gio.Settings, key: string) => settings.getFlags(key),
        set: (settings: Gio.Settings, key: string, value: number) => {
            settings.setFlags(key, value);
        },
    },
};

const defaultAccessor = (kind: string): SettingAccessor => {
    const node = parseVariantType(kind);

    return {
        get: (settings: Gio.Settings, key: string) => unpackVariant(node, settings.getValue(key)),
        set: (settings: Gio.Settings, key: string, value: unknown) => {
            settings.setValue(key, packVariant(node, value));
        },
    };
};

const resolveSettingAccessor = <K extends SettingsSchemaKeys, P extends keyof K>(
    settings: Gio.Settings,
    schema: SettingsSchema<K>,
    key: P & string,
): ResolvedSettingAccessor<K, P> => {
    const kind = schema.keys[key];

    if (kind === undefined) {
        throw new Error(`Key "${key}" is not defined in schema "${schema.id}"`);
    }

    const accessor = (ACCESSORS[kind] ?? defaultAccessor(kind)) as SettingAccessor<SettingValue<K, P>>;

    return {
        get: accessor.get.bind(null, settings, key),
        set: accessor.set.bind(null, settings, key),
    };
};

export { resolveSettingAccessor, type SettingsSchemaKeys, type SettingValue, type SettingsSchema };
