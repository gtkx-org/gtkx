import type * as Gio from "@gtkx/gi/gio";
import { fromVariant, toVariant, type VariantValue } from "@gtkx/runtime";

/** Maps each key of a GSettings schema to its kind: a GVariant type string, or `enum` or `flags`. */
type SettingsSchemaKeys = Record<string, string>;
/** Value type a key kind stands for: `number` for `enum` and `flags`, otherwise the unpacked GVariant. */
type SettingKindValue<S extends string> = S extends "enum" | "flags" ? number : VariantValue<S>;
/** Value type of key `P`, looked up by its kind in schema `K`, that reads and writes of that key take. */
type SettingValue<
    K extends SettingsSchemaKeys,
    P extends keyof K,
    V extends SettingsSchemaValues = Record<never, never>,
> =
    P extends keyof V
        ? K[P] extends "enum"
            ? V[P][keyof V[P]]
            : V[P] extends readonly (infer C extends string)[]
                ? WithChoices<SettingKindValue<K[P] & string>, C>
                : SettingKindValue<K[P] & string>
        : SettingKindValue<K[P] & string>;

type SettingsSchemaValues = Record<string, Readonly<Record<string, number>> | readonly string[]>;

type WithChoices<T, C extends string> = T extends string
    ? C
    : T extends (infer Item)[]
        ? WithChoices<Item, C>[]
        : T;

/** A GSettings schema, as described by the modules GTKX generates from a project's `.gschema.xml` files. */
type SettingsSchema<
    K extends SettingsSchemaKeys = SettingsSchemaKeys,
    V extends SettingsSchemaValues = Record<never, never>,
> = {
    /** Schema id it is looked up by, such as `org.gtkx.Example`. */
    id: string;
    /** Path a relocatable schema is instantiated at, or `null` to use the schema's own path. */
    path: string | null;
    /** Kind of every key the schema declares, which types reads and writes of that key. */
    keys: K;
    values?: V;
};

type SettingAccessor<T = unknown> = {
    get: (settings: Gio.Settings, key: string) => T;
    set: (settings: Gio.Settings, key: string, value: T) => void;
};

type ResolvedSettingAccessor<K extends SettingsSchemaKeys, P extends keyof K, V extends SettingsSchemaValues> = {
    get: () => SettingValue<K, P, V>;
    set: (value: SettingValue<K, P, V>) => void;
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

const defaultAccessor = (kind: string): SettingAccessor => ({
    get: (settings: Gio.Settings, key: string) => fromVariant(kind, settings.getValue(key)),
    set: (settings: Gio.Settings, key: string, value: unknown) => {
        settings.setValue(key, toVariant(kind, value));
    },
});

const resolveSettingAccessor = <K extends SettingsSchemaKeys, P extends keyof K, V extends SettingsSchemaValues>(
    settings: Gio.Settings,
    schema: SettingsSchema<K, V>,
    key: P & string,
): ResolvedSettingAccessor<K, P, V> => {
    const kind = schema.keys[key];

    if (kind === undefined) {
        throw new Error(`Key "${key}" is not defined in schema "${schema.id}"`);
    }

    const accessor = (ACCESSORS[kind] ?? defaultAccessor(kind)) as SettingAccessor<SettingValue<K, P, V>>;

    return {
        get: accessor.get.bind(null, settings, key),
        set: accessor.set.bind(null, settings, key),
    };
};

export {
    resolveSettingAccessor,
    type SettingsSchemaKeys,
    type SettingsSchemaValues,
    type SettingValue,
    type SettingsSchema,
};
