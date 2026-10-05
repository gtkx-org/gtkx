import { sourceStringLiteral } from "@gtkx/utils";

type Override = {
    module: string;
    exports: "*" | string[];
    needsBootstrap?: boolean;
};

const OVERRIDES: Record<string, Override[]> = {
    adw: [
        { module: "sidebar", exports: "*", needsBootstrap: true },
        { module: "combo-row", exports: "*", needsBootstrap: true },
    ],
    gio: [{ module: "application", exports: "*" }],
    glib: [
        { module: "regex", exports: ["MatchInfo"], needsBootstrap: true },
        { module: "variant", exports: "*" },
    ],
    gobject: [
        { module: "object", exports: "*", needsBootstrap: true },
        { module: "object-class", exports: ["ObjectClass"] },
        { module: "param-spec", exports: "*" },
        { module: "param-spec-getters", exports: "*", needsBootstrap: true },
        { module: "value", exports: "*", needsBootstrap: true },
    ],
    gtk: [
        { module: "widget-class", exports: ["WidgetClass"], needsBootstrap: true },
        { module: "text-view", exports: "*", needsBootstrap: true },
        { module: "window", exports: [], needsBootstrap: true },
    ],
};

const namespaceOverrides = (directory: string): Override[] => OVERRIDES[directory] ?? [];

const overrideImportPath = (override: Override): string =>
    sourceStringLiteral(`./overrides/${override.module}.js`);

const renderOverrideImports = (directory: string): string[] =>
    namespaceOverrides(directory)
        .filter((override) => override.needsBootstrap === true)
        .map((override) => `import ${overrideImportPath(override)};`);

const renderOverrideExports = (directory: string): string[] =>
    namespaceOverrides(directory).map((override) => {
        const exports = override.exports === "*" ? "*" : `{ ${override.exports.join(", ")} }`;

        return `export ${exports} from ${overrideImportPath(override)};`;
    });

export { namespaceOverrides, renderOverrideExports, renderOverrideImports };
