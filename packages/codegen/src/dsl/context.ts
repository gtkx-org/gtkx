import type { GirNamespace } from "../gir/namespace.js";
import type { GirRepository } from "../gir/repository.js";
import { ModuleBuilder } from "./module.js";

/**
 * Shared context handed to every writer for a single generated FFI module.
 *
 * Bundles the namespace the writer is emitting for, the broader repository
 * (for cross-namespace lookups), and the in-progress {@link ModuleBuilder}.
 * Writers also call back into this context to register cross-namespace
 * runtime imports so individual writers do not need to know the relative
 * path layout of the generated output.
 *
 * Generated bindings live in the `@gtkx/gi` package at `<ns>/<ns>.{js,d.ts}`,
 * with a per-namespace barrel at `<ns>/index.js` and the augment overlay at
 * `<ns>/augment/*.js`. The hand-written runtime is reached through the single
 * `@gtkx/ffi` barrel; sibling generated namespaces are reached relative to the
 * gi package root.
 */
export class ModuleContext {
    public readonly module = new ModuleBuilder();

    /**
     * @param namespace - The namespace this module corresponds to
     * @param repository - The repository containing every loaded namespace
     */
    constructor(
        public readonly namespace: GirNamespace,
        public readonly repository: GirRepository,
    ) {}

    /**
     * Adds a named import from the `@gtkx/ffi` runtime barrel.
     */
    addRuntimeImport(name: string): void {
        this.module.imports.addNamed("@gtkx/ffi", name);
    }

    /**
     * Adds a named import from the low-level `@gtkx/native` runtime.
     *
     * The transport primitives (`alloc`, `call`, `read`, `write`) live in
     * `@gtkx/native`; generated bindings reach them directly so `@gtkx/ffi`
     * stays the home of higher-level runtime helpers only.
     */
    addNativeImport(name: string): void {
        this.module.imports.addNamed("@gtkx/native", name);
    }

    /**
     * Adds a type-only named import from `@gtkx/native`
     * (`import { type Name }`), erased from the emitted `.js`.
     */
    addNativeTypeImport(name: string): void {
        this.module.imports.addNamed("@gtkx/native", name, true);
    }

    /** Adds the canonical `constructGObjectInstance` import from `@gtkx/ffi`. */
    addConstructGObjectInstanceImport(): void {
        this.module.imports.addNamed("@gtkx/ffi", "constructGObjectInstance");
    }

    /** Adds the `valueFromFfi` import from `@gtkx/ffi`. */
    addValueFromFfiImport(): void {
        this.module.imports.addNamed("@gtkx/ffi", "valueFromFfi");
    }

    /** Adds the `valueFromFfiOptional` import from `@gtkx/ffi`. */
    addValueFromFfiOptionalImport(): void {
        this.module.imports.addNamed("@gtkx/ffi", "valueFromFfiOptional");
    }

    /**
     * Adds the canonical side-effect imports for `gobject/object.js` and
     * `gobject/value.js`.
     *
     * Skipped for the `GObject` namespace itself (those modules import its
     * generated classes) and for `GLib`, which lives below GObject in the
     * import graph. Letting GLib bootstrap creates a runtime cycle:
     * `gobject.js` imports `glib.js` for `GLib.Variant` return-wrapping,
     * `glib.js`'s bootstrap re-enters `gobject/value.js`, and `value.ts`
     * touches `Value.prototype` before `gobject.js` has finished defining
     * `Value`. Other namespaces install the override on first import.
     */
    addGObjectBootstrapImports(): void {
        if (this.namespace.name === "GObject") return;
        if (this.namespace.name === "GLib") return;
        this.module.imports.addSideEffect("../gobject/augment/object.js");
        this.module.imports.addSideEffect("../gobject/augment/value.js");
    }

    /**
     * Adds a wildcard import for another namespace and returns the local
     * alias used.
     *
     * Most namespaces are routed through their hand-written `index.js` so any
     * prototype augmentations (Cairo `Context` methods, Gdk `RGBA`, Graphene
     * structs, …) load whenever a generated module references the namespace.
     * The foundational `gobject` and `glib` namespaces are routed straight to
     * their generated module instead, because their indexes pull in modules
     * that depend on values still mid-initialization, which would deadlock the
     * import graph.
     *
     * For non-foundational namespaces a side-effect import is recorded
     * alongside the wildcard so the foreign module loads even when its alias
     * appears only in type positions. The wildcard alias is type-stripped out
     * of the emitted `.js` whenever it is never read as a value, which would
     * otherwise drop the foreign module from the runtime graph and skip its
     * eager `*_get_type` registrations. The side-effect import survives type
     * stripping and pins the module in place. The foundational `gobject` and
     * `glib` wildcards are always read as values (enums, base classes) and so
     * are never stripped, needing no side-effect pin.
     *
     * @param namespaceName - The other namespace (e.g. `"GLib"`)
     */
    addCrossNamespaceImport(namespaceName: string): string {
        if (namespaceName === this.namespace.name) return namespaceName;
        const directory = namespaceName.toLowerCase();
        const isFoundational = directory === "gobject" || directory === "glib";
        const path = isFoundational ? `../${directory}/${directory}.js` : `../${directory}/index.js`;
        if (!isFoundational) this.module.imports.addSideEffect(`../${directory}/${directory}.js`);
        this.module.imports.addNamespace(path, namespaceName);
        return namespaceName;
    }

    /**
     * Renders a namespace-qualified reference to `typeName`: the bare name when
     * it lives in this module's own namespace, otherwise `Alias.Name` with the
     * foreign namespace imported on demand via {@link addCrossNamespaceImport}.
     *
     * @param namespaceName - The namespace the referenced type lives in
     * @param typeName - The local type or export name within that namespace
     */
    qualify(namespaceName: string, typeName: string): string {
        if (namespaceName === this.namespace.name) return typeName;
        return `${this.addCrossNamespaceImport(namespaceName)}.${typeName}`;
    }
}
