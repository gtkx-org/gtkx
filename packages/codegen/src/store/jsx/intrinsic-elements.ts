import { sortStringsBy, toCamelIdentifier, upperFirst } from "@gtkx/utils";
import type { GirClass } from "../../gir/class.js";
import type { Library } from "../../gir/library.js";
import type { GirNamespace } from "../../gir/namespace.js";
import { ancestorChain } from "../../gir/ancestry.js";

type GlibNamedClass = {
    glibName: string;
    klass: GirClass;
    namespace: GirNamespace;
};

type ResolvedQualifiedInterface = { klass: GirClass; namespace: GirNamespace };

type InterfaceVisitState = {
    library: Library;
    visited: Set<string>;
    result: ResolvedQualifiedInterface[];
};

type HasContainerProps = (glibName: string | undefined) => boolean;

type InterfacePropsCollector = {
    library: Library;
    targetNamespaceName: string;
    hasContainerProps: HasContainerProps;
    seen: Set<string>;
    result: ResolvedQualifiedInterface[];
};

const signalHandlerName = (signalName: string): string => `on${upperFirst(toCamelIdentifier(signalName))}`;

function* classesWithGlibNameIn(namespace: GirNamespace): IterableIterator<GlibNamedClass> {
    for (const klass of namespace.classes) {
        const glibName = getGlibName(klass);

        if (glibName === undefined) {
            continue;
        }

        yield { glibName, klass, namespace };
    }
}

function* iterateClassesWithGlibName(library: Library): IterableIterator<GlibNamedClass> {
    for (const namespace of library.namespaces.values()) {
        yield* classesWithGlibNameIn(namespace);
    }
}

function collectImplementedInterface(state: InterfaceVisitState, name: string, fromNamespace: GirNamespace): void {
    const resolved = state.library.resolveType(fromNamespace.name, name);

    if (resolved?.kind !== "interface") {
        return;
    }

    const key = `${resolved.namespace.name}.${resolved.value.name}`;

    if (state.visited.has(key)) {
        return;
    }

    state.visited.add(key);
    state.result.push({ klass: resolved.value, namespace: resolved.namespace });
    visitImplementedInterfaces(state, resolved.value.prerequisites, resolved.namespace);
}

function visitImplementedInterfaces(state: InterfaceVisitState, names: string[], fromNamespace: GirNamespace): void {
    for (const name of names) {
        collectImplementedInterface(state, name, fromNamespace);
    }
}

const implementedInterfaces = (
    klass: GirClass,
    namespace: GirNamespace,
    library: Library,
): ResolvedQualifiedInterface[] => {
    const state: InterfaceVisitState = { library, visited: new Set<string>(), result: [] };
    visitImplementedInterfaces(state, klass.implements, namespace);

    return state.result;
};

const getGlibName = (klass: GirClass): string | undefined => klass.glibTypeName ?? klass.cType;
const giNamespaceAlias = (namespaceName: string): string => `${namespaceName}$`;
const hasNoContainerProps: HasContainerProps = () => false;

const hasInterfacePropsBody = (
    klass: GirClass,
    hasContainerProps: HasContainerProps = hasNoContainerProps,
): boolean => klass.properties.length > 0 || klass.signals.length > 0 || hasContainerProps(getGlibName(klass));

const qualifiedInterfaceKey = (iface: ResolvedQualifiedInterface): string =>
    `${iface.namespace.name}.${iface.klass.name}`;

const isCollectibleInterface = (
    iface: ResolvedQualifiedInterface,
    targetNamespaceName: string,
    hasContainerProps: HasContainerProps,
): boolean => hasInterfacePropsBody(iface.klass, hasContainerProps) && iface.namespace.name === targetNamespaceName;

const parentImplementedInterfaceKeys = (klass: GirClass, namespace: GirNamespace, library: Library): Set<string> => {
    const keys: Set<string> = new Set();

    if (klass.parent === undefined) {
        return keys;
    }

    const resolvedParent = library.resolveType(namespace.name, klass.parent);

    if (resolvedParent?.kind !== "class") {
        return keys;
    }

    for (const iface of implementedInterfaces(resolvedParent.value, resolvedParent.namespace, library)) {
        keys.add(qualifiedInterfaceKey(iface));
    }

    return keys;
};

const newlyImplementedInterfaces = (
    klass: GirClass,
    namespace: GirNamespace,
    library: Library,
    hasContainerProps: HasContainerProps = hasNoContainerProps,
): ResolvedQualifiedInterface[] => {
    const inherited = parentImplementedInterfaceKeys(klass, namespace, library);

    const own = implementedInterfaces(klass, namespace, library).filter(
        (iface) =>
            hasInterfacePropsBody(iface.klass, hasContainerProps) && !inherited.has(qualifiedInterfaceKey(iface)),
    );

    return sortStringsBy(own, qualifiedInterfaceKey);
};

const collectInterfacePropsFromElement = (element: GlibNamedClass, collector: InterfacePropsCollector): void => {
    const { library, targetNamespaceName, hasContainerProps, seen, result } = collector;

    for (const iface of implementedInterfaces(element.klass, element.namespace, library)) {
        const key = qualifiedInterfaceKey(iface);

        if (seen.has(key)) {
            continue;
        }

        seen.add(key);

        if (isCollectibleInterface(iface, targetNamespaceName, hasContainerProps)) {
            result.push(iface);
        }
    }
};

const collectInterfacePropsClasses = (
    library: Library,
    intrinsicElements: GlibNamedClass[],
    targetNamespaceName: string,
    hasContainerProps: HasContainerProps = hasNoContainerProps,
): ResolvedQualifiedInterface[] => {
    const collector: InterfacePropsCollector = {
        library,
        targetNamespaceName,
        hasContainerProps,
        seen: new Set<string>(),
        result: [],
    };

    for (const element of intrinsicElements) {
        collectInterfacePropsFromElement(element, collector);
    }

    return sortStringsBy(collector.result, qualifiedInterfaceKey);
};

const ancestorGlibNames = (klass: GirClass, namespace: GirNamespace, library: Library): string[] => {
    const names: string[] = [];

    for (const { klass: ancestor } of ancestorChain(library, klass, namespace.name)) {
        const glibName = getGlibName(ancestor);

        if (glibName !== undefined) {
            names.push(glibName);
        }
    }

    return names;
};

const hasMatchingAncestor = (
    klass: GirClass,
    namespace: GirNamespace,
    library: Library,
    isMatch: (klass: GirClass, glibName: string) => boolean,
): boolean => {
    for (const { klass: ancestor } of ancestorChain(library, klass, namespace.name)) {
        const glibName = getGlibName(ancestor) ?? "";

        if (isMatch(ancestor, glibName)) {
            return true;
        }
    }

    return false;
};

const hasMatchingAncestorName = (
    klass: GirClass,
    namespace: GirNamespace,
    library: Library,
    isMatch: (glibName: string) => boolean,
): boolean => hasMatchingAncestor(klass, namespace, library, (_klass, glibName) => isMatch(glibName));

const isIntrinsicElementClass = (klass: GirClass, namespace: GirNamespace, library: Library): boolean =>
    hasMatchingAncestorName(klass, namespace, library, (glibName) => glibName === "GObject");

const collectIntrinsicElementClasses = (library: Library): GlibNamedClass[] => {
    const seen: Set<string> = new Set();
    const entries: GlibNamedClass[] = [];

    for (const candidate of iterateClassesWithGlibName(library)) {
        const { glibName, klass, namespace } = candidate;

        if (!isIntrinsicElementClass(klass, namespace, library) || seen.has(glibName)) {
            continue;
        }

        seen.add(glibName);
        entries.push(candidate);
    }

    return sortStringsBy(entries, (entry) => entry.glibName);
};

export {
    signalHandlerName,
    iterateClassesWithGlibName,
    implementedInterfaces,
    getGlibName,
    giNamespaceAlias,
    hasInterfacePropsBody,
    newlyImplementedInterfaces,
    collectInterfacePropsClasses,
    ancestorGlibNames,
    isIntrinsicElementClass,
    collectIntrinsicElementClasses,
    type GlibNamedClass,
    type ResolvedQualifiedInterface,
    type HasContainerProps,
};
