import { getClassType, registerWrapperClass, type WrapperClass } from "@gtkx/runtime";
import { getVfuncRegistry } from "@gtkx/runtime/internal";
import {
    Settings as GeneratedSettings,
    SettingsSchema,
    type SettingsConstructorProps,
    SettingsSchemaSource,
} from "../gio.js";

/** Application settings, with GJS's checks for missing schemas, keys and children. */
interface Settings extends GeneratedSettings {}

type KeyedMethod = (this: Settings, key: string, ...args: never[]) => unknown;

const settingsKeys: WeakMap<Settings, string[]> = new WeakMap();
const settingsChildren: WeakMap<Settings, string[]> = new WeakMap();

const lookupSchema = (props: SettingsConstructorProps): SettingsSchema => {
    if (props.settingsSchema !== undefined && props.settingsSchema !== null) {
        return props.settingsSchema;
    }

    const schemaId = props.schemaId ?? props.schema;

    if (schemaId === undefined || schemaId === null) {
        throw new Error("One of property 'schemaId' or 'settingsSchema' are required for Gio.Settings");
    }

    const schema = SettingsSchemaSource.getDefault()?.lookup(schemaId, true) ?? null;

    if (schema === null) {
        throw new Error(`GSettings schema ${schemaId} not found`);
    }

    return schema;
};

const checkConstructProps = (props: SettingsConstructorProps): void => {
    const schema = lookupSchema(props);
    const schemaPath = schema.getPath();
    const path = props.path ?? null;

    if (path === null && schemaPath === null) {
        throw new Error(`Attempting to create schema '${schema.getId()}' without a path`);
    }

    if (path !== null && schemaPath !== null && path !== schemaPath) {
        throw new Error(`GSettings created for path '${path}', but schema specifies '${schemaPath}'`);
    }
};

const checkKey = (settings: Settings, key: string): void => {
    const keys = settingsKeys.getOrInsertComputed(settings, () => settings.settingsSchema?.listKeys() ?? []);

    if (!keys.includes(key)) {
        throw new Error(`GSettings key ${key} not found in schema ${settings.schemaId}`);
    }
};

const checkChild = (settings: Settings, name: string): void => {
    const children = settingsChildren.getOrInsertComputed(settings, () => settings.listChildren());

    if (!children.includes(name)) {
        throw new Error(`Child ${name} not found in GSettings schema ${settings.schemaId}`);
    }
};

const checkMethod = (
    prototype: Record<KeyedMethodName, KeyedMethod>,
    name: KeyedMethodName,
    check: (settings: Settings, key: string) => void,
): void => {
    const method = prototype[name];

    prototype[name] = function (this: Settings, key: string, ...args: never[]): unknown {
        check(this, key);

        return method.call(this, key, ...args);
    };
};

const KEYED_METHODS = [
    "getBoolean",
    "setBoolean",
    "getDouble",
    "setDouble",
    "getEnum",
    "setEnum",
    "getFlags",
    "setFlags",
    "getInt",
    "setInt",
    "getInt64",
    "setInt64",
    "getString",
    "setString",
    "getStrv",
    "setStrv",
    "getUint",
    "setUint",
    "getUint64",
    "setUint64",
    "getValue",
    "setValue",
    "bind",
    "bindWritable",
    "createAction",
    "getDefaultValue",
    "getUserValue",
    "isWritable",
    "reset",
] as const;

type KeyedMethodName = (typeof KEYED_METHODS)[number] | "getChild";

const settingsPrototype: Record<KeyedMethodName, KeyedMethod> = GeneratedSettings.prototype;

for (const name of KEYED_METHODS) {
    checkMethod(settingsPrototype, name, checkKey);
}
checkMethod(settingsPrototype, "getChild", checkChild);

const schemaMethods: { getKey: SettingsSchema["getKey"] } = SettingsSchema.prototype;
const { getKey } = schemaMethods;

SettingsSchema.prototype.getKey = function (name) {
    if (!this.hasKey(name)) {
        throw new Error(`GSettings key ${name} not found in schema ${this.getId()}`);
    }

    return getKey.call(this, name);
};

const checkFactory =
    <A extends unknown[], R>(
        create: (...args: A) => R,
        constructProps: (...args: A) => SettingsConstructorProps,
    ): ((...args: A) => R) =>
    (...args) => {
        checkConstructProps(constructProps(...args));

        return create(...args);
    };

const { new: create, newFull, newWithBackend, newWithBackendAndPath, newWithPath } = GeneratedSettings;

GeneratedSettings.new = checkFactory(create, (schemaId) => ({ schemaId }));
GeneratedSettings.newFull = checkFactory(newFull, (settingsSchema, _backend, path) => ({ settingsSchema, path }));
GeneratedSettings.newWithBackend = checkFactory(newWithBackend, (schemaId) => ({ schemaId }));
GeneratedSettings.newWithBackendAndPath = checkFactory(newWithBackendAndPath, (schemaId, _backend, path) => ({
    schemaId,
    path,
}));
GeneratedSettings.newWithPath = checkFactory(newWithPath, (schemaId, path) => ({ schemaId, path }));

const wrapSettingsConstructor = <C extends WrapperClass<typeof GeneratedSettings, Settings>>(base: C): C => {
    const wrapped = new Proxy(base, {
        construct(target, args: [SettingsConstructorProps?], newTarget): Settings {
            checkConstructProps(args[0] ?? {});

            return Reflect.construct(target, args, newTarget) as Settings;
        },
    });
    registerWrapperClass(wrapped, getClassType(base), getVfuncRegistry(base));

    return wrapped;
};

/** The settings class, with GJS-compatible checks that throw where GLib would abort the process. */
const Settings: WrapperClass<typeof GeneratedSettings, Settings> = wrapSettingsConstructor(GeneratedSettings);

export { Settings };
