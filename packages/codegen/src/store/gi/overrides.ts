import { sourceStringLiteral } from "@gtkx/utils";

type Override = {
    module: string;
    exports: "*" | string[];
    needsBootstrap?: boolean;
    interfaces?: Record<string, string>;
};

type InterfaceExtension = {
    module: string;
    name: string;
};

const OVERRIDES: Record<string, Override[]> = {
    adw: [
        { module: "application", exports: ["Application"], needsBootstrap: true },
        { module: "sidebar", exports: "*", needsBootstrap: true },
        { module: "combo-row", exports: "*", needsBootstrap: true },
        { module: "tab-bar", exports: "*", needsBootstrap: true },
        { module: "breakpoint-bin", exports: [], needsBootstrap: true },
    ],
    gio: [
        { module: "action-map", exports: ["type ActionEntryObj"], interfaces: { ActionMap: "extendActionMap" } },
        {
            module: "application",
            exports: ["Application"],
            needsBootstrap: true,
        },
        { module: "settings", exports: ["Settings"], needsBootstrap: true },
    ],
    glib: [
        { module: "error", exports: ["Error", "type ErrorConstructor"], needsBootstrap: true },
        { module: "regex", exports: [], needsBootstrap: true },
        {
            module: "variant",
            exports: [
                "type RecursiveVariantValue",
                "type ShallowVariantValue",
                "Variant",
                "type VariantByteArray",
                "type VariantConstructor",
                "type VariantInput",
                "type VariantValue",
            ],
            needsBootstrap: true,
        },
    ],
    gobject: [
        { module: "object", exports: "*", needsBootstrap: true },
        { module: "object-class", exports: ["ObjectClass"] },
        { module: "param-spec", exports: ["ParamSpec"], needsBootstrap: true },
        { module: "param-spec-getters", exports: "*", needsBootstrap: true },
        { module: "value", exports: "*", needsBootstrap: true },
    ],
    gtk: [
        { module: "application", exports: ["Application"], needsBootstrap: true },
        { module: "editable", exports: [], needsBootstrap: true },
        { module: "widget-class", exports: ["WidgetClass"], needsBootstrap: true },
        { module: "text-view", exports: "*", needsBootstrap: true },
        { module: "window", exports: [], needsBootstrap: true },
    ],
};

const namespaceOverrides = (directory: string): Override[] => OVERRIDES[directory] ?? [];

const overrideImportPath = (override: Override): string => sourceStringLiteral(`./overrides/${override.module}.js`);

const renderOverrideImports = (directory: string): string[] =>
    namespaceOverrides(directory)
        .filter((override) => override.needsBootstrap === true)
        .map((override) => `import ${overrideImportPath(override)};`);

const renderOverrideExports = (directory: string): string[] =>
    namespaceOverrides(directory)
        .filter((override) => override.exports === "*" || override.exports.length > 0)
        .map((override) => {
            const exports = override.exports === "*" ? "*" : `{ ${override.exports.join(", ")} }`;

            return `export ${exports} from ${overrideImportPath(override)};`;
        });

const interfaceExtension = (directory: string, className: string): InterfaceExtension | undefined => {
    for (const override of namespaceOverrides(directory)) {
        const name = override.interfaces?.[className];

        if (name !== undefined) {
            return { module: `./overrides/${override.module}.js`, name };
        }
    }

    return undefined;
};

export { interfaceExtension, namespaceOverrides, renderOverrideExports, renderOverrideImports };
