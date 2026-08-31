import type { Library } from "../gir/library.js";
import { externalPackageFor } from "../gir/external-namespaces.js";
import { declaredTypeNames, type GirNamespace } from "../gir/namespace.js";
import { type Declaration, ModuleBuilder } from "./module.js";

type BootstrapCallOptions = {
    moduleExports?: string[];
    runtimeImports?: string[];
};

const addExternalNamespaceImport = (context: ModuleContext, packageName: string, namespaceName: string): void => {
    context.externalDependencies.add(packageName);
    context.module.imports.addNamespace(packageName, namespaceName);
};

const addInternalNamespaceImport = (context: ModuleContext, namespaceName: string): void => {
    const directory = namespaceName.toLowerCase();
    const isFoundational = directory === "gobject" || directory === "glib";
    const path = isFoundational ? `../${directory}/${directory}.js` : `../${directory}/index.js`;
    context.dependencies.add(directory);
    context.module.imports.addNamespace(path, namespaceName);
};

class ModuleContext {
    private registrationSink: string[] = [];
    private readonly hoistedBases: Map<string, string> = new Map();
    public module: ModuleBuilder = new ModuleBuilder();
    public namespace: GirNamespace;
    public library: Library;
    public dependencies: Set<string> = new Set();
    public externalDependencies: Set<string> = new Set();
    public bootstrapCalls: string[] = [];
    public bootstrapModuleExports: Set<string> = new Set();
    public bootstrapRuntimeImports: Set<string> = new Set();

    constructor(namespace: GirNamespace, library: Library) {
        this.namespace = namespace;
        this.library = library;
    }

    addRuntimeImport(name: string): void {
        this.module.imports.addNamed("@gtkx/runtime", name);
    }

    addRuntimeTypeImport(name: string): string {
        const local = declaredTypeNames(this.namespace).has(name) ? `Runtime${name}` : name;
        this.module.imports.addNamed("@gtkx/runtime", name, true, local === name ? undefined : local);

        return local;
    }

    hoistDescriptor(expression: string): string {
        return this.module.hoistDescriptor(expression);
    }

    takeRegistrations(): string[] {
        const collected = this.registrationSink;
        this.registrationSink = [];

        return collected;
    }

    collectRegistration(code: string): void {
        this.registrationSink.push(code);
    }

    addBootstrapCall(code: string, options: BootstrapCallOptions = {}): void {
        const moduleExports = options.moduleExports ?? [];
        const runtimeImports = options.runtimeImports ?? [];

        for (const name of moduleExports) {
            this.bootstrapModuleExports.add(name);
        }

        for (const name of runtimeImports) {
            this.bootstrapRuntimeImports.add(name);
        }

        this.bootstrapCalls.push(code);
    }

    addCrossNamespaceImport(namespaceName: string): string {
        if (namespaceName === this.namespace.name) {
            return namespaceName;
        }

        const packageName = externalPackageFor(namespaceName);

        if (packageName === undefined) {
            addInternalNamespaceImport(this, namespaceName);
        } else {
            addExternalNamespaceImport(this, packageName, namespaceName);
        }

        return namespaceName;
    }

    declare(declaration: Declaration): void {
        const { name, code, owner, isLocal } = declaration;

        this.module.appendDeclaration({
            name,
            code,
            owner: owner === undefined ? undefined : `${this.namespace.name}.${owner}`,
            isLocal,
        });
    }

    qualify(namespaceName: string, name: string): string {
        if (namespaceName === this.namespace.name) {
            return name;
        }

        return `${this.addCrossNamespaceImport(namespaceName)}.${name}`;
    }

    hoistBaseRef(expression: string): string {
        if (!expression.includes(".")) {
            return expression;
        }

        const existing = this.hoistedBases.get(expression);

        if (existing !== undefined) {
            return existing;
        }

        const local = `_${expression.replaceAll(".", "_")}`;
        this.hoistedBases.set(expression, local);

        this.module.appendDeclaration({
            name: local,
            code: `const ${local}: typeof ${expression} = ${expression};`,
            isLocal: true,
        });

        return local;
    }
}

export { ModuleContext };
