/**
 * Resolves the relative import specifier used by generated FFI modules to
 * reach a sibling namespace.
 *
 * Most namespaces are routed through their hand-written `index.ts` so any
 * prototype augmentations (Cairo `Context` methods, Gdk `RGBA`, Graphene
 * structs, …) are guaranteed to load whenever a generated module imports
 * the namespace. The exceptions are the foundational namespaces (`gobject`,
 * `glib`), which sit beneath every other namespace in the dependency graph
 * and would introduce import cycles if routed through their indexes — those
 * indexes pull in modules that depend on values exported from their own
 * generated module, so loading them while that module is still mid-init
 * fails.
 *
 * @param namespace - Target namespace (any casing).
 * @returns A specifier relative to a generated FFI file at
 *   `packages/ffi/src/generated/<src>/<src>.js`.
 */
export function resolveNamespaceImportPath(namespace: string): string {
    const ns = namespace.toLowerCase();
    if (ns === "gobject" || ns === "glib") {
        return `../${ns}/${ns}.js`;
    }
    return `../../${ns}/index.js`;
}
