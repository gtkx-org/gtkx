import { sortStrings, sourceStringLiteral } from "@gtkx/utils";
import type { GeneratedClass, ModuleContext } from "../../writer/context.js";
import { namespaceDirectory } from "../../gir/namespace.js";
import { renderOverrideImports } from "./overrides.js";

const CORE_WRAPPERS: Record<string, string[]> = {
    glib: ["Error", "Variant"],
    gobject: ["ParamSpec", "Value"],
};

const renderDependencyImports = (context: ModuleContext): string[] => [
    ...sortStrings(context.dependencies).map((dependency) => `import "../${dependency}/bootstrap.js";`),
    ...sortStrings(context.externalDependencies).map((packageName) => `import ${sourceStringLiteral(packageName)};`),
];

const renderModuleImports = (context: ModuleContext, directory: string, coreWrappers: string[]): string[] => {
    const moduleImports = sortStrings(new Set([...context.bootstrapModuleExports, ...coreWrappers]));

    return moduleImports.length === 0 ? [] : [`import { ${moduleImports.join(", ")} } from "./${directory}.js";`];
};

const typeNamePrefix = ({ className, glibTypeName }: GeneratedClass): string | undefined =>
    glibTypeName.endsWith(className) ? glibTypeName.slice(0, glibTypeName.length - className.length) : undefined;

const commonTypeNamePrefix = (classes: GeneratedClass[]): string => {
    const counts: Map<string, number> = new Map();
    let common = "";
    let commonCount = 0;

    for (const generated of classes) {
        const prefix = typeNamePrefix(generated);

        if (prefix === undefined) {
            continue;
        }

        const count = (counts.get(prefix) ?? 0) + 1;
        counts.set(prefix, count);

        if (count > commonCount) {
            common = prefix;
            commonCount = count;
        }
    }

    return common;
};

const renderGeneratedClasses = (context: ModuleContext, directory: string): string[] => {
    const classes = context.generatedClasses;

    if (classes.length === 0) {
        return [];
    }

    const prefix = commonTypeNamePrefix(classes);
    const names = classes.map(({ className, glibTypeName }) =>
        prefix + className === glibTypeName ? className : `${className}:${glibTypeName}`,
    );
    const args = [context.namespace.name, directory, prefix, names.join(" ")].map((arg) => sourceStringLiteral(arg));

    return [`registerGeneratedClasses(${args.join(", ")});`];
};

const renderRuntimeImports = (coreWrappers: string[], generatedClasses: string[]): string[] => {
    const names = [
        ...(generatedClasses.length === 0 ? [] : ["registerGeneratedClasses"]),
        ...(coreWrappers.length === 0 ? [] : ["retainWrapperClasses"]),
    ];

    return names.length === 0 ? [] : [`import { ${names.join(", ")} } from "@gtkx/runtime/internal";`];
};

const renderBootstrapModule = (context: ModuleContext): string => {
    const directory = namespaceDirectory(context.namespace);
    const coreWrappers = CORE_WRAPPERS[directory] ?? [];
    const generatedClasses = renderGeneratedClasses(context, directory);

    const retention = coreWrappers.length === 0 ? [] : [`retainWrapperClasses([${coreWrappers.join(", ")}]);`];

    const lines = [
        ...renderDependencyImports(context),
        ...renderOverrideImports(directory),
        ...renderRuntimeImports(coreWrappers, generatedClasses),
        ...renderModuleImports(context, directory, coreWrappers),
        "",
        ...retention,
        ...generatedClasses,
        ...context.bootstrapCalls,
    ];

    return `${lines.join("\n")}\n`;
};

export { renderBootstrapModule };
