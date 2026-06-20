import type { GirClass } from "./class.js";
import type { GirRepository } from "./repository.js";

export type ResolvedAncestor = {
    klass: GirClass;
    namespaceName: string;
};

export const resolveClassOrInterface = (
    repository: GirRepository,
    defaultNamespace: string,
    name: string,
): ResolvedAncestor | undefined => {
    const resolved = repository.resolveType(defaultNamespace, name);
    if (resolved === undefined || (resolved.kind !== "class" && resolved.kind !== "interface")) return undefined;
    return { klass: resolved.value, namespaceName: resolved.namespace.name };
};

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
