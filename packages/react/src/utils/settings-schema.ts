import type * as Gio from "@gtkx/gi/gio";
import type * as GLib from "@gtkx/gi/glib";

type SettingValueType = "b" | "i" | "u" | "x" | "t" | "d" | "s" | "as" | "enum" | "flags";

type SettingValueTypeMap = {
    b: boolean;
    i: number;
    u: number;
    x: bigint;
    t: bigint;
    d: number;
    s: string;
    as: string[];
    enum: number;
    flags: number;
};

export type SettingsSchemaKeys = Record<string, SettingValueType | (string & {})>;

export type SettingValue<K extends SettingsSchemaKeys, P extends keyof K> = K[P] extends SettingValueType
    ? SettingValueTypeMap[K[P]]
    : GLib.Variant;

export type SettingsSchema<K extends SettingsSchemaKeys = SettingsSchemaKeys> = {
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

const ACCESSORS: Record<SettingValueType, SettingAccessor> = {
    b: {
        get: (settings: Gio.Settings, key: string) => settings.getBoolean(key),
        set: (settings: Gio.Settings, key: string, value: boolean) => {
            settings.setBoolean(key, value);
        },
    },
    i: {
        get: (settings: Gio.Settings, key: string) => settings.getInt(key),
        set: (settings: Gio.Settings, key: string, value: number) => {
            settings.setInt(key, value);
        },
    },
    u: {
        get: (settings: Gio.Settings, key: string) => settings.getUint(key),
        set: (settings: Gio.Settings, key: string, value: number) => {
            settings.setUint(key, value);
        },
    },
    x: {
        get: (settings: Gio.Settings, key: string) => settings.getInt64(key),
        set: (settings: Gio.Settings, key: string, value: bigint) => {
            settings.setInt64(key, value);
        },
    },
    t: {
        get: (settings: Gio.Settings, key: string) => settings.getUint64(key),
        set: (settings: Gio.Settings, key: string, value: bigint) => {
            settings.setUint64(key, value);
        },
    },
    d: {
        get: (settings: Gio.Settings, key: string) => settings.getDouble(key),
        set: (settings: Gio.Settings, key: string, value: number) => {
            settings.setDouble(key, value);
        },
    },
    s: {
        get: (settings: Gio.Settings, key: string) => settings.getString(key),
        set: (settings: Gio.Settings, key: string, value: string) => {
            settings.setString(key, value);
        },
    },
    as: {
        get: (settings: Gio.Settings, key: string) => settings.getStrv(key),
        set: (settings: Gio.Settings, key: string, value: string[]) => {
            settings.setStrv(key, value);
        },
    },
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
} as Record<SettingValueType, SettingAccessor>;

const FALLBACK_ACCESSOR = {
    get: (settings: Gio.Settings, key: string) => settings.getValue(key),
    set: (settings: Gio.Settings, key: string, value: GLib.Variant) => {
        settings.setValue(key, value);
    },
} as SettingAccessor;

export const resolveSettingAccessor = <K extends SettingsSchemaKeys, P extends keyof K>(
    settings: Gio.Settings,
    schema: SettingsSchema<K>,
    key: P & string,
): ResolvedSettingAccessor<K, P> => {
    const accessor = (ACCESSORS[schema.keys[key] as SettingValueType] ?? FALLBACK_ACCESSOR) as SettingAccessor<
        SettingValue<K, P>
    >;

    return {
        get: accessor.get.bind(null, settings, key),
        set: accessor.set.bind(null, settings, key),
    };
};
