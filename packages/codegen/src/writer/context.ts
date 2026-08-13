import type { Library } from "../gir/library.js";
import type { GirNamespace } from "../gir/namespace.js";
import { type Declaration, ModuleBuilder } from "./module.js";

class ModuleContext {
    public module: ModuleBuilder = new ModuleBuilder();
    public namespace: GirNamespace;
    public library: Library;

    constructor(namespace: GirNamespace, library: Library) {
        this.namespace = namespace;
        this.library = library;
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

    addGObjectBootstrapImports(): void {
        if (this.namespace.name === "GObject") {
            return;
        }

        if (this.namespace.name === "GLib") {
            return;
        }

        this.module.imports.addSideEffect("../gobject/overrides/object.js");
        this.module.imports.addSideEffect("../gobject/overrides/value.js");
    }

    addCrossNamespaceImport(namespaceName: string): string {
        if (namespaceName === this.namespace.name) {
            return namespaceName;
        }

        const directory = namespaceName.toLowerCase();
        const isFoundational = directory === "gobject" || directory === "glib";
        const path = isFoundational ? `../${directory}/${directory}.js` : `../${directory}/index.js`;

        if (!isFoundational) {
            this.module.imports.addSideEffect(path);
        }

        this.module.imports.addNamespace(path, namespaceName);

        return namespaceName;
    }

    declare(declaration: Declaration): void {
        const { name, code, owner } = declaration;

        this.module.appendDeclaration({
            name,
            code,
            owner: owner === undefined ? undefined : `${this.namespace.name}.${owner}`,
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
