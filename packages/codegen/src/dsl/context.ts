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
 * Generated FFI files live at
 * `packages/ffi/src/generated/<ns>/<ns>.{js,d.ts}`. Runtime helpers live at
 * `packages/ffi/src/runtime.js` and `packages/ffi/src/object.js`. Sibling
 * generated namespaces live at `packages/ffi/src/generated/<other>/<other>.js`.
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
     * Adds a named import from the runtime barrel (`runtime.ts`).
     */
    addRuntimeImport(name: string): void {
        this.module.imports.addNamed("../../runtime.js", name);
    }

    /** Adds the canonical `constructGObjectInstance` import from `object.js`. */
    addConstructGObjectInstanceImport(): void {
        this.module.imports.addNamed("../../object.js", "constructGObjectInstance");
    }

    /** Adds the `valueFromFfi` import from `value-marshal.js`. */
    addValueFromFfiImport(): void {
        this.module.imports.addNamed("../../value-marshal.js", "valueFromFfi");
    }

    /** Adds the `valueFromFfiOptional` import from `value-marshal.js`. */
    addValueFromFfiOptionalImport(): void {
        this.module.imports.addNamed("../../value-marshal.js", "valueFromFfiOptional");
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
        this.module.imports.addSideEffect("../../gobject/object.js");
        this.module.imports.addSideEffect("../../gobject/value.js");
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
        const path = isFoundational ? `../${directory}/${directory}.js` : `../../${directory}/index.js`;
        if (!isFoundational) this.module.imports.addSideEffect(`../${directory}/${directory}.js`);
        this.module.imports.addNamespace(path, namespaceName);
        return namespaceName;
    }
}
