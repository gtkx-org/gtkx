import type { GirClass } from "./class.js";
import type { GirRepository } from "./repository.js";

/** A class or interface resolved to its declaration and the name of the namespace that declares it. */
export type ResolvedAncestor = {
    readonly klass: GirClass;
    readonly namespaceName: string;
};

/**
 * Resolves a (possibly cross-namespace) name to its class or interface
 * declaration and declaring namespace. Returns `undefined` when the name
 * resolves to another kind of entity or not at all.
 *
 * @param repository - The repository to resolve against
 * @param defaultNamespace - Namespace assumed for an unqualified `name`
 * @param name - The class or interface name
 */
export const resolveClassOrInterface = (
    repository: GirRepository,
    defaultNamespace: string,
    name: string,
): ResolvedAncestor | undefined => {
    const resolved = repository.resolveType(defaultNamespace, name);
    if (resolved === undefined || (resolved.kind !== "class" && resolved.kind !== "interface")) return undefined;
    return { klass: resolved.value, namespaceName: resolved.namespace.name };
};

/**
 * Yields `klass` and each ancestor up its `parent` chain, nearest first,
 * following cross-namespace parents and stopping at the first unresolved parent
 * or a repeated type. The single parent-chain traversal the inheritance
 * analysis and the React widget-slot folds both run over.
 *
 * @param repository - The repository for cross-namespace parent lookups
 * @param klass - The class to start from
 * @param namespaceName - The namespace the class is declared in
 */
export function* ancestorChain(
    repository: GirRepository,
    klass: GirClass,
    namespaceName: string,
): Generator<ResolvedAncestor> {
    const visited = new Set<string>();
    let current: ResolvedAncestor | undefined = { klass, namespaceName };
    while (current !== undefined) {
        const key = `${current.namespaceName}.${current.klass.name}`;
        if (visited.has(key)) return;
        visited.add(key);
        yield current;
        if (current.klass.parent === undefined) return;
        current = resolveClassOrInterface(repository, current.namespaceName, current.klass.parent);
    }
}
