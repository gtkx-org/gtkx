import { sortStringsBy, toCamelIdentifier, upperFirst } from "@gtkx/utils";
import { ancestorChain } from "../../gir/ancestry.js";
import type { GirClass } from "../../gir/class.js";
import type { Library } from "../../gir/library.js";
import type { GirNamespace } from "../../gir/namespace.js";

export const signalHandlerName = (signalName: string): string => `on${upperFirst(toCamelIdentifier(signalName))}`;

export type GlibNamedClass = {
    glibName: string;
    klass: GirClass;
    namespace: GirNamespace;
};

export function* iterateClassesWithGlibName(library: Library): IterableIterator<GlibNamedClass> {
    for (const namespace of library.namespaces.values()) {
        for (const klass of namespace.classes) {
            const glibName = glibNameOf(klass);
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

export const glibNameOf = (klass: GirClass): string | undefined => klass.glibTypeName ?? klass.cType;

export const giNamespaceAlias = (namespaceName: string): string => `${namespaceName}$`;

export type HasContainerProps = (glibName: string | undefined) => boolean;

const noContainerProps: HasContainerProps = () => false;

export const interfaceHasPropsBody = (
    klass: GirClass,
    hasContainerProps: HasContainerProps = noContainerProps,
): boolean => klass.properties.length > 0 || klass.signals.length > 0 || hasContainerProps(glibNameOf(klass));

const qualifiedInterfaceKey = (iface: ResolvedQualifiedInterface): string =>
    `${iface.namespace.name}.${iface.klass.name}`;

const parentImplementedInterfaceKeys = (klass: GirClass, namespace: GirNamespace, library: Library): Set<string> => {
    const keys = new Set<string>();
    if (klass.parent === undefined) return keys;
    const resolvedParent = library.resolveType(namespace.name, klass.parent);
    if (resolvedParent === undefined || resolvedParent.kind !== "class") return keys;
    for (const iface of implementedInterfaces(resolvedParent.value, resolvedParent.namespace, library)) {
        keys.add(qualifiedInterfaceKey(iface));
    }
    return keys;
};

export const newlyImplementedInterfaces = (
    klass: GirClass,
    namespace: GirNamespace,
    library: Library,
    hasContainerProps: HasContainerProps = noContainerProps,
): ResolvedQualifiedInterface[] => {
    const inherited = parentImplementedInterfaceKeys(klass, namespace, library);
    const own = implementedInterfaces(klass, namespace, library).filter(
        (iface) =>
            interfaceHasPropsBody(iface.klass, hasContainerProps) && !inherited.has(qualifiedInterfaceKey(iface)),
    );
    return sortStringsBy(own, qualifiedInterfaceKey);
};

export const collectInterfacePropsClasses = (
    library: Library,
    intrinsicElements: GlibNamedClass[],
    targetNamespaceName: string,
    hasContainerProps: HasContainerProps = noContainerProps,
): ResolvedQualifiedInterface[] => {
    const seen = new Set<string>();
    const result: ResolvedQualifiedInterface[] = [];
    for (const intrinsicElement of intrinsicElements) {
        for (const iface of implementedInterfaces(intrinsicElement.klass, intrinsicElement.namespace, library)) {
            const key = qualifiedInterfaceKey(iface);
            if (seen.has(key)) continue;
            seen.add(key);
            if (!interfaceHasPropsBody(iface.klass, hasContainerProps)) continue;
            if (iface.namespace.name !== targetNamespaceName) continue;
            result.push(iface);
        }
    }
    return sortStringsBy(result, qualifiedInterfaceKey);
};

export const ancestorGlibNames = (klass: GirClass, namespace: GirNamespace, library: Library): string[] => {
    const names: string[] = [];
    for (const { klass: ancestor } of ancestorChain(library, klass, namespace.name)) {
        const glibName = glibNameOf(ancestor);
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
        const glibName = glibNameOf(ancestor) ?? "";
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

export const isIntrinsicElementClass = (klass: GirClass, namespace: GirNamespace, library: Library): boolean =>
    descendsFrom(klass, namespace, library, (glibName) => glibName === "GObject");

export const collectIntrinsicElementClasses = (library: Library): GlibNamedClass[] => {
    const seen = new Set<string>();
    const entries: GlibNamedClass[] = [];
    for (const candidate of iterateClassesWithGlibName(library)) {
        const { glibName, klass, namespace } = candidate;
        if (!isIntrinsicElementClass(klass, namespace, library)) continue;
        if (seen.has(glibName)) continue;
        seen.add(glibName);
        entries.push(candidate);
    }
    return sortStringsBy(entries, (entry) => entry.glibName);
};
