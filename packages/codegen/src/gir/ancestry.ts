import type { GirClass } from "./class.js";
import type { Library } from "./library.js";
import type { GirType } from "./type.js";

export type ResolvedAncestor = {
    klass: GirClass;
    namespaceName: string;
};

const ancestorOf = (resolved: GirType | undefined): ResolvedAncestor | undefined =>
    resolved !== undefined && (resolved.kind === "class" || resolved.kind === "interface")
        ? { klass: resolved.value, namespaceName: resolved.namespace.name }
        : undefined;

const resolveClassOrInterface = (
    library: Library,
    defaultNamespace: string,
    name: string,
): ResolvedAncestor | undefined => ancestorOf(library.resolveType(defaultNamespace, name));

export const resolveInterface = (
    library: Library,
    defaultNamespace: string,
    name: string,
): ResolvedAncestor | undefined => {
    const resolved = library.resolveType(defaultNamespace, name);
    return resolved?.kind === "interface" ? ancestorOf(resolved) : undefined;
};

export function* ancestorChain(library: Library, klass: GirClass, namespaceName: string): Generator<ResolvedAncestor> {
    const visited = new Set<string>();
    let current: ResolvedAncestor | undefined = { klass, namespaceName };
    while (current !== undefined) {
        const key = `${current.namespaceName}.${current.klass.name}`;
        if (visited.has(key)) return;
        visited.add(key);
        yield current;
        if (current.klass.parent === undefined) return;
        current = resolveClassOrInterface(library, current.namespaceName, current.klass.parent);
    }
}
