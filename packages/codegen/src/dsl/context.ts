import type { GirNamespace } from "../gir/namespace.js";
import type { GirRepository } from "../gir/repository.js";
import { ModuleBuilder } from "./module.js";
import { UsedSymbols } from "./used-symbols.js";

export class ModuleContext {
    public module: ModuleBuilder = new ModuleBuilder();
    public namespace: GirNamespace;
    public repository: GirRepository;
    private used: UsedSymbols = new UsedSymbols();

    constructor(namespace: GirNamespace, repository: GirRepository) {
        this.namespace = namespace;
        this.repository = repository;
    }

    addRuntimeImport(name: string): void {
        this.used.recordNamed("@gtkx/ffi", name);
    }

    addRuntimeTypeImport(name: string): void {
        this.used.recordNamed("@gtkx/ffi", name, true);
    }

    hoistFfiType(expression: string): string {
        return this.module.hoistFfiType(expression);
    }

    addNativeImport(name: string): void {
        this.used.recordNamed("@gtkx/native", name);
    }

    addNativeTypeImport(name: string): void {
        this.used.recordNamed("@gtkx/native", name, true);
    }

    addGobjectBootstrapImports(): void {
        if (this.namespace.name === "GObject") return;
        if (this.namespace.name === "GLib") return;
        this.used.recordSideEffect("../gobject/overrides/object.js");
        this.used.recordSideEffect("../gobject/overrides/value.js");
    }

    addCrossNamespaceImport(namespaceName: string): string {
        if (namespaceName === this.namespace.name) return namespaceName;
        const directory = namespaceName.toLowerCase();
        const isFoundational = directory === "gobject" || directory === "glib";
        const path = isFoundational ? `../${directory}/${directory}.js` : `../${directory}/index.js`;
        if (!isFoundational) this.used.recordSideEffect(path);
        this.used.recordNamespace(path, namespaceName);
        return namespaceName;
    }

    qualify(namespaceName: string, typeName: string): string {
        if (namespaceName === this.namespace.name) return typeName;
        return `${this.addCrossNamespaceImport(namespaceName)}.${typeName}`;
    }

    flushImports(): void {
        this.used.flushInto(this.module.imports);
    }
}
