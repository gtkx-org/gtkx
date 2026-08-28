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

const renderNativeTypeIndex = (context: ModuleContext): string => {
    const entries = sortStrings(context.nativeTypeNames.keys()).map((name) => {
        const [sharedLibrary, getTypeFnName] = context.nativeTypeNames.get(name) ?? ["", ""];

        return `    ${sourceStringLiteral(name)}: ` +
            `[${sourceStringLiteral(sharedLibrary)}, ${sourceStringLiteral(getTypeFnName)}],`;
    });

    return entries.length === 0 ? "{}" : `{\n${entries.join("\n")}\n}`;
};

const renderBootstrapModule = (context: ModuleContext): string => {
    const directory = namespaceDirectory(context.namespace);
    const lines: string[] = [];

    for (const dependency of sortStrings(context.dependencies)) {
        lines.push(`import "../${dependency}/bootstrap.js";`);
    }

    for (const packageName of sortStrings(context.externalDependencies)) {
        lines.push(`import ${sourceStringLiteral(packageName)};`);
    }

    for (const override of PATCHING_OVERRIDES[directory] ?? []) {
        lines.push(`import ${sourceStringLiteral(override)};`);
    }

    const runtimeImports = new Set(context.bootstrapRuntimeImports);
    runtimeImports.add("registerNativeTypeNames");
    lines.push(`import { ${sortStrings(runtimeImports).join(", ")} } from "@gtkx/runtime";`);

    const coreWrappers = CORE_WRAPPERS[directory] ?? [];
    const moduleImports = sortStrings(new Set([...context.bootstrapModuleExports, ...coreWrappers]));

    if (moduleImports.length > 0) {
        lines.push(`import { ${moduleImports.join(", ")} } from "./${directory}.js";`);
    }

    lines.push("");
    const wrappersArgument = coreWrappers.length === 0 ? "" : `, [${coreWrappers.join(", ")}]`;
    lines.push(`registerNativeTypeNames(${renderNativeTypeIndex(context)}${wrappersArgument});`);
    lines.push(...context.bootstrapCalls);

    return `${lines.join("\n")}\n`;
};

export { renderBootstrapModule };
