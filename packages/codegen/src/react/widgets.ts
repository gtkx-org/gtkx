import { sortedAlphaBy, toCamelIdentifier, toUpperFirst } from "@gtkx/utils";
import { ancestorChain } from "../gir/ancestry.js";
import type { GirClass } from "../gir/class.js";
import type { GirNamespace } from "../gir/namespace.js";
import type { GirRepository } from "../gir/repository.js";

export const signalHandlerName = (signalName: string): string => `on${toUpperFirst(toCamelIdentifier(signalName))}`;

export type WidgetCandidate = {
    glibName: string;
    klass: GirClass;
    namespace: GirNamespace;
};

export function* iterateClassesWithGlibName(repository: GirRepository): IterableIterator<WidgetCandidate> {
    for (const namespace of repository.namespaces.values()) {
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
    repository: GirRepository,
): ResolvedQualifiedInterface[] => {
    const result: ResolvedQualifiedInterface[] = [];
    const visited = new Set<string>();
    const visit = (names: string[], fromNamespace: GirNamespace): void => {
        for (const name of names) {
            const resolved = repository.resolveType(fromNamespace.name, name);
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

export const ancestorGlibNames = (klass: GirClass, namespace: GirNamespace, repository: GirRepository): string[] => {
    const names: string[] = [];
    for (const { klass: ancestor } of ancestorChain(repository, klass, namespace.name)) {
        const glibName = ancestor.glibTypeName ?? ancestor.cType;
        if (glibName !== undefined) names.push(glibName);
    }
    return names;
};

const someAncestor = (
    klass: GirClass,
    namespace: GirNamespace,
    repository: GirRepository,
    predicate: (klass: GirClass, glibName: string) => boolean,
): boolean => {
    for (const { klass: ancestor } of ancestorChain(repository, klass, namespace.name)) {
        const glibName = ancestor.glibTypeName ?? ancestor.cType ?? "";
        if (predicate(ancestor, glibName)) return true;
    }
    return false;
};

const descendsFrom = (
    klass: GirClass,
    namespace: GirNamespace,
    repository: GirRepository,
    matches: (glibName: string) => boolean,
): boolean => someAncestor(klass, namespace, repository, (_klass, glibName) => matches(glibName));

export const classExposesMethod = (
    klass: GirClass,
    namespace: GirNamespace,
    repository: GirRepository,
    methodName: string,
): boolean =>
    someAncestor(klass, namespace, repository, (current) => current.methods.some((m) => m.name === methodName));

export const isReactNodeClass = (klass: GirClass, namespace: GirNamespace, repository: GirRepository): boolean =>
    descendsFrom(klass, namespace, repository, (glibName) => glibName === "GObject");

export const collectReactNodeClasses = (repository: GirRepository): WidgetCandidate[] => {
    const seen = new Set<string>();
    const entries: WidgetCandidate[] = [];
    for (const candidate of iterateClassesWithGlibName(repository)) {
        const { glibName, klass, namespace } = candidate;
        if (!isReactNodeClass(klass, namespace, repository)) continue;
        if (seen.has(glibName)) continue;
        seen.add(glibName);
        entries.push(candidate);
    }
    return sortedAlphaBy(entries, (entry) => entry.glibName);
};
