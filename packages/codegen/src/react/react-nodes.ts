import { sortedStringsBy, toCamelIdentifier, toUpperFirst } from "@gtkx/utils";
import { ancestorChain } from "../gir/ancestry.js";
import type { GirClass } from "../gir/class.js";
import type { GirNamespace } from "../gir/namespace.js";
import type { Library } from "../gir/library.js";

export const signalHandlerName = (signalName: string): string => `on${toUpperFirst(toCamelIdentifier(signalName))}`;

export type ReactNodeClass = {
    glibName: string;
    klass: GirClass;
    namespace: GirNamespace;
};

export function* iterateClassesWithGlibName(library: Library): IterableIterator<ReactNodeClass> {
    for (const namespace of library.namespaces.values()) {
        for (const klass of namespace.classes) {
            const glibName = klass.glibTypeName ?? klass.cType;
            if (glibName === undefined) continue;
            yield { glibName, klass, namespace };
        }
    }
}

export type ResolvedQualifiedInterface = { klass: GirClass; namespace: GirNamespace };

export const implementedInterfaces = (
    klass: GirClass,
    namespace: GirNamespace,
    library: Library,
): ResolvedQualifiedInterface[] => {
    const result: ResolvedQualifiedInterface[] = [];
    const visited = new Set<string>();
    const visit = (names: string[], fromNamespace: GirNamespace): void => {
        for (const name of names) {
            const resolved = library.resolveType(fromNamespace.name, name);
            if (resolved === undefined || resolved.kind !== "interface") continue;
            const key = `${resolved.namespace.name}.${resolved.value.name}`;
            if (visited.has(key)) continue;
            visited.add(key);
            result.push({ klass: resolved.value, namespace: resolved.namespace });
            visit(resolved.value.prerequisites, resolved.namespace);
        }
    };
    visit(klass.implements, namespace);
    return result;
};

export const ancestorGlibNames = (klass: GirClass, namespace: GirNamespace, library: Library): string[] => {
    const names: string[] = [];
    for (const { klass: ancestor } of ancestorChain(library, klass, namespace.name)) {
        const glibName = ancestor.glibTypeName ?? ancestor.cType;
        if (glibName !== undefined) names.push(glibName);
    }
    return names;
};

const someAncestor = (
    klass: GirClass,
    namespace: GirNamespace,
    library: Library,
    predicate: (klass: GirClass, glibName: string) => boolean,
): boolean => {
    for (const { klass: ancestor } of ancestorChain(library, klass, namespace.name)) {
        const glibName = ancestor.glibTypeName ?? ancestor.cType ?? "";
        if (predicate(ancestor, glibName)) return true;
    }
    return false;
};

const descendsFrom = (
    klass: GirClass,
    namespace: GirNamespace,
    library: Library,
    matches: (glibName: string) => boolean,
): boolean => someAncestor(klass, namespace, library, (_klass, glibName) => matches(glibName));

export const classExposesMethod = (
    klass: GirClass,
    namespace: GirNamespace,
    library: Library,
    methodName: string,
): boolean => someAncestor(klass, namespace, library, (current) => current.methods.some((m) => m.name === methodName));

export const isReactNodeClass = (klass: GirClass, namespace: GirNamespace, library: Library): boolean =>
    descendsFrom(klass, namespace, library, (glibName) => glibName === "GObject");

export const collectReactNodeClasses = (library: Library): ReactNodeClass[] => {
    const seen = new Set<string>();
    const entries: ReactNodeClass[] = [];
    for (const candidate of iterateClassesWithGlibName(library)) {
        const { glibName, klass, namespace } = candidate;
        if (!isReactNodeClass(klass, namespace, library)) continue;
        if (seen.has(glibName)) continue;
        seen.add(glibName);
        entries.push(candidate);
    }
    return sortedStringsBy(entries, (entry) => entry.glibName);
};
