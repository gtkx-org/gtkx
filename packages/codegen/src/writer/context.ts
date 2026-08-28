import type { Library } from "../gir/library.js";
import type { GirNamespace } from "../gir/namespace.js";
import { externalPackageFor } from "../gir/external-namespaces.js";
import { type Declaration, ModuleBuilder } from "./module.js";

type BootstrapCallOptions = {
    moduleExports?: string[];
    runtimeImports?: string[];
};

class ModuleContext {
    public module: ModuleBuilder = new ModuleBuilder();
    public namespace: GirNamespace;
    public library: Library;
    public dependencies: Set<string> = new Set();
    public externalDependencies: Set<string> = new Set();
    public bootstrapCalls: string[] = [];
    public bootstrapModuleExports: Set<string> = new Set();
    public bootstrapRuntimeImports: Set<string> = new Set();
    public nativeTypeNames: Map<string, readonly [string, string]> = new Map();
    private registrationSink: string[] | undefined;

    constructor(namespace: GirNamespace, library: Library) {
        this.namespace = namespace;
        this.library = library;
    }

    get isTreeShaken(): boolean {
        return this.library.isTreeShaken;
    }

    addRuntimeImport(name: string): void {
        this.module.imports.addNamed("@gtkx/runtime", name);
    }

    addRuntimeTypeImport(name: string): void {
        this.module.imports.addNamed("@gtkx/runtime", name, true);
    }

    hoistDescriptor(expression: string): string {
        return this.module.hoistDescriptor(expression);
    }

    beginRegistrations(): void {
        this.registrationSink = [];
    }

    takeRegistrations(): string[] {
        const collected = this.registrationSink ?? [];
        this.registrationSink = undefined;

        return collected;
    }

    collectRegistration(code: string, requires: string[] = []): void {
        if (this.registrationSink === undefined) {
            this.module.appendRegistration(code, requires);

            return;
        }

        this.registrationSink.push(code);
    }

    addBootstrapCall(code: string, options: BootstrapCallOptions = {}): void {
        for (const name of options.moduleExports ?? []) {
            this.bootstrapModuleExports.add(name);
        }

        for (const name of options.runtimeImports ?? []) {
            this.bootstrapRuntimeImports.add(name);
        }

        this.bootstrapCalls.push(code);
    }

    addNativeTypeName(glibTypeName: string, getTypeFnName: string): void {
        const sharedLibrary = this.namespace.sharedLibrary;

        if (sharedLibrary === undefined) {
            return;
        }

        this.nativeTypeNames.set(glibTypeName, [sharedLibrary, getTypeFnName]);
    }

    addGObjectBootstrapImports(): void {
        if (this.isTreeShaken) {
            return;
        }

        if (this.namespace.name === "GObject") {
            return;
        }

        if (this.namespace.name === "GLib") {
            return;
        }

        this.module.imports.addSideEffect("../gobject/overrides/object.js");
        this.module.imports.addSideEffect("../gobject/overrides/param-spec-getters.js");
        this.module.imports.addSideEffect("../gobject/overrides/value.js");
    }

    addCrossNamespaceImport(namespaceName: string): string {
        if (namespaceName === this.namespace.name) {
            return namespaceName;
        }

        const packageName = externalPackageFor(namespaceName);

        if (packageName !== undefined) {
            if (this.isTreeShaken) {
                this.externalDependencies.add(packageName);
            } else {
                this.module.imports.addSideEffect(packageName);
            }

            this.module.imports.addNamespace(packageName, namespaceName);

            return namespaceName;
        }

        const directory = namespaceName.toLowerCase();
        const isFoundational = directory === "gobject" || directory === "glib";
        const path = isFoundational ? `../${directory}/${directory}.js` : `../${directory}/index.js`;

        if (this.isTreeShaken) {
            this.dependencies.add(directory);
        } else if (!isFoundational) {
            this.module.imports.addSideEffect(path);
        }

        this.module.imports.addNamespace(path, namespaceName);

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
}

export { ModuleContext };
