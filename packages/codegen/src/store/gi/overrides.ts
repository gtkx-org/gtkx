import { sourceStringLiteral } from "@gtkx/utils";

type Override = {
    module: string;
    exports: "*" | string[];
    patchesPrototype?: boolean;
};

const OVERRIDES: Record<string, Override[]> = {
    adw: [
        { module: "sidebar", exports: "*", patchesPrototype: true },
        { module: "combo-row", exports: "*", patchesPrototype: true },
    ],
    glib: [{ module: "regex", exports: "*", patchesPrototype: true }],
    gobject: [
        { module: "object", exports: "*", patchesPrototype: true },
        { module: "object-class", exports: ["ObjectClass"] },
        { module: "param-spec", exports: "*" },
        { module: "param-spec-getters", exports: "*", patchesPrototype: true },
        { module: "value", exports: "*", patchesPrototype: true },
    ],
    gtk: [
        { module: "widget-class", exports: ["WidgetClass"] },
        { module: "text-view", exports: "*", patchesPrototype: true },
    ],
};

const namespaceOverrides = (directory: string): Override[] => OVERRIDES[directory] ?? [];

const overrideImportPath = (override: Override): string =>
    sourceStringLiteral(`./overrides/${override.module}.js`);

const renderOverrideImports = (directory: string): string[] =>
    namespaceOverrides(directory)
        .filter((override) => override.patchesPrototype === true)
        .map((override) => `import ${overrideImportPath(override)};`);

const renderOverrideExports = (directory: string): string[] =>
    namespaceOverrides(directory).map((override) => {
        const exports = override.exports === "*" ? "*" : `{ ${override.exports.join(", ")} }`;

        return `export ${exports} from ${overrideImportPath(override)};`;
    });

export { namespaceOverrides, renderOverrideExports, renderOverrideImports };
