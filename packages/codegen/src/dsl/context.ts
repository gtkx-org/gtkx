import type { GirNamespace } from "../gir/namespace.js";
import type { GirRepository } from "../gir/repository.js";
import { ModuleBuilder } from "./module.js";

export class ModuleContext {
    public module: ModuleBuilder = new ModuleBuilder();
    public namespace: GirNamespace;
    public repository: GirRepository;

    constructor(namespace: GirNamespace, repository: GirRepository) {
        this.namespace = namespace;
        this.repository = repository;
    }

    addRuntimeImport(name: string): void {
        this.module.imports.addNamed("@gtkx/ffi", name);
    }

    addRuntimeTypeImport(name: string): void {
        this.module.imports.addNamed("@gtkx/ffi", name, true);
    }

    hoistFfiType(expression: string): string {
        return this.module.hoistFfiType(expression);
    }

    addNativeImport(name: string): void {
        this.module.imports.addNamed("@gtkx/native", name);
    }

    addNativeTypeImport(name: string): void {
        this.module.imports.addNamed("@gtkx/native", name, true);
    }

    addGobjectBootstrapImports(): void {
        if (this.namespace.name === "GObject") return;
        if (this.namespace.name === "GLib") return;
        this.module.imports.addSideEffect("../gobject/overrides/object.js");
        this.module.imports.addSideEffect("../gobject/overrides/value.js");
    }

    addCrossNamespaceImport(namespaceName: string): string {
        if (namespaceName === this.namespace.name) return namespaceName;
        const directory = namespaceName.toLowerCase();
        const isFoundational = directory === "gobject" || directory === "glib";
        const path = isFoundational ? `../${directory}/${directory}.js` : `../${directory}/index.js`;
        if (!isFoundational) this.module.imports.addSideEffect(path);
        this.module.imports.addNamespace(path, namespaceName);
        return namespaceName;
    }

    qualify(namespaceName: string, typeName: string): string {
        if (namespaceName === this.namespace.name) return typeName;
        return `${this.addCrossNamespaceImport(namespaceName)}.${typeName}`;
    }
}
