import type { GirClass } from "./class.js";
import type { GirRepository } from "./repository.js";

/**
 * Splits a possibly cross-namespace GIR identifier (e.g. `"Gtk.Widget"`) into
 * its namespace and local name.
 *
 * Identifiers without a dot are resolved against `defaultNamespace`. This
 * mirrors the GIR convention where same-namespace references omit the
 * namespace prefix.
 *
 * @param qualified - The GIR identifier as it appears in `<type>` / `parent`
 * @param defaultNamespace - The namespace to assume when no prefix is present
 */
export const splitQualifiedName = (
    qualified: string,
    defaultNamespace: string,
): { readonly namespaceName: string; readonly typeName: string } => {
    const dot = qualified.indexOf(".");
    if (dot === -1) {
        return { namespaceName: defaultNamespace, typeName: qualified };
    }
    return { namespaceName: qualified.slice(0, dot), typeName: qualified.slice(dot + 1) };
};

/**
 * A class or interface together with the namespace it was resolved through.
 */
export type ResolvedQualifiedClass = {
    readonly klass: GirClass;
    readonly namespaceName: string;
};

/**
 * Resolves a possibly cross-namespace identifier to its `class` or `interface`
 * entry plus the namespace that declares it.
 *
 * Returns `undefined` when the identifier resolves to a different kind of GIR
 * entity (boxed, enum, …) or cannot be resolved at all.
 *
 * @param repository - The repository to query
 * @param qualified - The GIR identifier (e.g. `"Gtk.Widget"`)
 * @param defaultNamespace - Namespace to assume for unqualified identifiers
 */
export const resolveQualifiedClass = (
    repository: GirRepository,
    qualified: string,
    defaultNamespace: string,
): ResolvedQualifiedClass | undefined => {
    const { namespaceName, typeName } = splitQualifiedName(qualified, defaultNamespace);
    const resolved = repository.resolveNamed(namespaceName, typeName);
    if (resolved === undefined) return undefined;
    if (resolved.kind !== "class" && resolved.kind !== "interface") return undefined;
    return { klass: resolved.value, namespaceName: resolved.namespace.name };
};
