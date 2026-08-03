import type { GirClass } from "./class.js";
import type { Library } from "./library.js";
import type { GirType } from "./type.js";

type ResolvedAncestor = {
    klass: GirClass;
    namespaceName: string;
};

const getAncestor = (resolved: GirType | undefined): ResolvedAncestor | undefined =>
    resolved !== undefined && (resolved.kind === "class" || resolved.kind === "interface")
        ? { klass: resolved.value, namespaceName: resolved.namespace.name }
        : undefined;

const resolveClassOrInterface = (
    library: Library,
    defaultNamespace: string,
    name: string,
): ResolvedAncestor | undefined => getAncestor(library.resolveType(defaultNamespace, name));

const resolveInterface = (
    library: Library,
    defaultNamespace: string,
    name: string,
): ResolvedAncestor | undefined => {
    const resolved = library.resolveType(defaultNamespace, name);

    return resolved?.kind === "interface" ? getAncestor(resolved) : undefined;
};

const resolveInterfaces = (library: Library, defaultNamespace: string, names: string[]): ResolvedAncestor[] => {
    const interfaces: ResolvedAncestor[] = [];

    for (const name of names) {
        const iface = resolveInterface(library, defaultNamespace, name);

        if (iface !== undefined) {
            interfaces.push(iface);
        }
    }

    return interfaces;
};

function* ancestorChain(library: Library, klass: GirClass, namespaceName: string): Generator<ResolvedAncestor> {
    const visited: Set<string> = new Set();
    let current: ResolvedAncestor | undefined = { klass, namespaceName };

    while (current !== undefined) {
        const key = `${current.namespaceName}.${current.klass.name}`;

        if (visited.has(key)) {
            return;
        }

        visited.add(key);
        yield current;

        if (current.klass.parent === undefined) {
            return;
        }

        current = resolveClassOrInterface(library, current.namespaceName, current.klass.parent);
    }
}

export { resolveInterfaces, ancestorChain, type ResolvedAncestor };
