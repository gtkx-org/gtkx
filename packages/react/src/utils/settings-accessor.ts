import type * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";

type SettingAccessor = {
    read: (settings: Gio.Settings, key: string) => unknown;
    write: (settings: Gio.Settings, key: string, value: unknown) => void;
};

const settingTypeError = (expected: string, value: unknown): TypeError =>
    new TypeError(`Expected ${expected} for the settings value, got ${typeof value}`);

const expect =
    <T>(guard: (value: unknown) => value is T, label: string) =>
    (value: unknown): T => {
        if (!guard(value)) throw settingTypeError(label, value);
        return value;
    };

const expectBoolean = expect((value): value is boolean => typeof value === "boolean", "a boolean");

const expectNumber = expect((value): value is number => typeof value === "number", "a number");

const expectString = expect((value): value is string => typeof value === "string", "a string");

const isStringArray = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every((entry) => typeof entry === "string");

const expectStringArray = expect(isStringArray, "an array of strings");

const expectVariant = expect((value): value is GLib.Variant => value instanceof GLib.Variant, "a GLib.Variant");

const expectBigInt = (value: unknown): bigint => {
    if (typeof value === "bigint") return value;
    if (typeof value === "number") return BigInt(value);
    throw settingTypeError("a bigint", value);
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
        write: (settings, key, value) => settings.setInt64(key, expectBigInt(value)),
    },
    t: {
        read: (settings, key) => settings.getUint64(key),
        write: (settings, key, value) => settings.setUint64(key, expectBigInt(value)),
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

export const resolveAccessor = (kind: string | undefined, key: string, schemaId: string): SettingAccessor => {
    if (kind === undefined) {
        throw new TypeError(`Key "${key}" is not declared by the GSettings schema "${schemaId}"`);
    }
    return ACCESSORS[kind] ?? VARIANT_ACCESSOR;
};
