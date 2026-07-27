import type * as Gio from "@gtkx/gi/gio";
import { packVariant, parseVariantType, unpackVariant, type VariantValue } from "./variant.js";

type SettingsSchemaKeys = Record<string, string>;
type SettingKindValue<S extends string> = S extends "enum" | "flags" ? number : VariantValue<S>;
type SettingValue<K extends SettingsSchemaKeys, P extends keyof K> = SettingKindValue<K[P] & string>;

type SettingsSchema<K extends SettingsSchemaKeys = SettingsSchemaKeys> = {
    id: string;
    path: string | null;
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
