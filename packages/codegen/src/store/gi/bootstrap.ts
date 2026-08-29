import { sortStrings, sourceStringLiteral } from "@gtkx/utils";
import type { ModuleContext } from "../../writer/context.js";
import { namespaceDirectory } from "../../gir/namespace.js";

const PATCHING_OVERRIDES: Record<string, string[]> = {
    glib: ["./overrides/regex.js"],
    gobject: ["./overrides/object.js", "./overrides/param-spec-getters.js", "./overrides/value.js"],
};

const CORE_WRAPPERS: Record<string, string[]> = {
    glib: ["Error", "Variant"],
    gobject: ["ParamSpec", "Value"],
};

const renderDependencyImports = (context: ModuleContext): string[] => [
    ...sortStrings(context.dependencies).map((dependency) => `import "../${dependency}/bootstrap.js";`),
    ...sortStrings(context.externalDependencies).map((packageName) => `import ${sourceStringLiteral(packageName)};`),
];

const renderOverrideImports = (directory: string): string[] =>
    (PATCHING_OVERRIDES[directory] ?? []).map((override) => `import ${sourceStringLiteral(override)};`);

const renderRuntimeImport = (context: ModuleContext, coreWrappers: string[]): string[] => {
    const runtimeImports = new Set(context.bootstrapRuntimeImports);

    if (coreWrappers.length > 0) {
        runtimeImports.add("retainWrapperClasses");
    }

    if (runtimeImports.size === 0) {
        return [];
    }

    return [`import { ${sortStrings(runtimeImports).join(", ")} } from "@gtkx/runtime";`];
};

const renderModuleImports = (context: ModuleContext, directory: string, coreWrappers: string[]): string[] => {
    const moduleImports = sortStrings(new Set([...context.bootstrapModuleExports, ...coreWrappers]));

    return moduleImports.length === 0 ? [] : [`import { ${moduleImports.join(", ")} } from "./${directory}.js";`];
};

const renderBootstrapModule = (context: ModuleContext): string => {
    const directory = namespaceDirectory(context.namespace);
    const coreWrappers = CORE_WRAPPERS[directory] ?? [];

    const retention = coreWrappers.length === 0
        ? []
        : [`retainWrapperClasses([${coreWrappers.join(", ")}]);`];

    const lines = [
        ...renderDependencyImports(context),
        ...renderOverrideImports(directory),
        ...renderRuntimeImport(context, coreWrappers),
        ...renderModuleImports(context, directory, coreWrappers),
        "",
        ...retention,
        ...context.bootstrapCalls,
    ];

    return `${lines.join("\n")}\n`;
};

export { renderBootstrapModule };
