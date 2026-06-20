import { toCamelIdentifier, toPascalCase } from "@gtkx/utils";
import type { ModuleContext } from "../dsl/context.js";
import type { GirClass } from "../gir/class.js";
import type { GirProperty } from "../gir/property.js";
import type { GirRepository } from "../gir/repository.js";

/**
 * A class or interface resolved to its declaration and the namespace that
 * declares it — the ancestry walk's per-step result.
 */
export type ResolvedQualifiedClass = {
    readonly klass: GirClass;
    readonly namespaceName: string;
};

const resolveClassOrInterface = (
    repository: GirRepository,
    defaultNamespace: string,
    name: string,
): ResolvedQualifiedClass | undefined => {
    const resolved = repository.resolveType(defaultNamespace, name);
    if (resolved === undefined || (resolved.kind !== "class" && resolved.kind !== "interface")) return undefined;
    return { klass: resolved.value, namespaceName: resolved.namespace.name };
};

/**
 * The minimal context the ancestry walkers read: the repository to resolve
 * references against and the namespace unqualified names default to. Satisfied
 * by a full {@link ModuleContext} as well as the bare repository + namespace the
 * React props builder holds.
 */
type AncestryContext = {
    readonly repository: GirRepository;
    readonly namespace: { readonly name: string };
};

/**
 * A directly-implemented interface resolved to its declaration and the
 * namespace that declares it.
 */
export type ResolvedInterface = {
    readonly klass: GirClass;
    readonly namespaceName: string;
};

/**
 * Resolves an `<implements>` entry to its `<interface>` declaration.
 *
 * Returns `undefined` when the name resolves to a non-interface entity or
 * cannot be resolved at all.
 *
 * @param context - The repository and default namespace to resolve against
 * @param name - The (possibly cross-namespace) interface name
 * @param defaultNamespace - Namespace assumed for an unqualified `name`
 */
export const resolveImplementedInterface = (
    context: AncestryContext,
    name: string,
    defaultNamespace: string = context.namespace.name,
): ResolvedInterface | undefined => {
    const resolved = context.repository.resolveType(defaultNamespace, name);
    if (resolved === undefined || resolved.kind !== "interface") return undefined;
    return { klass: resolved.value, namespaceName: resolved.namespace.name };
};

/**
 * Resolves every directly-implemented interface of `klass`, dropping entries
 * that do not resolve to an interface.
 *
 * @param context - The repository and default namespace to resolve against
 * @param klass - The implementing class
 * @param defaultNamespace - Namespace assumed for unqualified `<implements>` names
 */
export const resolveDirectInterfaces = (
    context: AncestryContext,
    klass: GirClass,
    defaultNamespace: string,
): readonly ResolvedInterface[] => {
    const interfaces: ResolvedInterface[] = [];
    for (const implementName of klass.implements) {
        const iface = resolveImplementedInterface(context, implementName, defaultNamespace);
        if (iface !== undefined) interfaces.push(iface);
    }
    return interfaces;
};

/**
 * Resolves a `<prerequisite>` entry to the generated type reference it names —
 * the local PascalCase name within the current namespace, or the
 * cross-namespace `<Alias>.<Name>` form. Returns `undefined` when the name
 * does not resolve to an emitted class or interface.
 *
 * @param context - The module context
 * @param name - The (possibly cross-namespace) prerequisite name
 */
export const resolvePrerequisiteReference = (context: ModuleContext, name: string): string | undefined => {
    const resolved = context.repository.resolveType(context.namespace.name, name);
    if (resolved === undefined) return undefined;
    if (resolved.kind !== "interface" && resolved.kind !== "class") return undefined;
    return context.qualify(resolved.namespace.name, toPascalCase(resolved.value.name));
};

/**
 * Invokes `visit` for each ancestor class of `klass`, nearest first.
 *
 * Walks the same-namespace and cross-namespace parent chain, stopping at the
 * first unresolved parent, a cycle, or an ancestor `stop` selects. Each
 * ancestor is reported together with the namespace it was resolved through and
 * its directly-implemented interfaces, so callers need not re-resolve them.
 *
 * @param context - The repository and default namespace to resolve against
 * @param klass - The class whose ancestors to visit
 * @param visit - Callback invoked once per resolved ancestor with its interfaces
 * @param stop - Halts the walk before visiting an ancestor it selects
 */
export const forEachAncestor = (
    context: AncestryContext,
    klass: GirClass,
    visit: (ancestor: ResolvedQualifiedClass, interfaces: readonly ResolvedInterface[]) => void,
    stop: (ancestor: GirClass) => boolean = () => false,
): void => {
    const visited = new Set<string>();
    let current =
        klass.parent === undefined ? undefined : { name: klass.parent, defaultNamespace: context.namespace.name };
    while (current !== undefined) {
        const resolved = resolveClassOrInterface(context.repository, current.defaultNamespace, current.name);
        if (resolved === undefined || stop(resolved.klass)) break;
        const key = `${resolved.namespaceName}.${resolved.klass.name}`;
        if (visited.has(key)) break;
        visited.add(key);
        visit(resolved, resolveDirectInterfaces(context, resolved.klass, resolved.namespaceName));
        current = resolved.klass.parent
            ? { name: resolved.klass.parent, defaultNamespace: resolved.namespaceName }
            : undefined;
    }
};

/**
 * Collects the properties contributed by a class's directly-implemented
 * interfaces that are not already declared on the class itself or inherited
 * from an ancestor (or an ancestor-implemented interface).
 *
 * Each returned property carries its references re-rooted to the interface's
 * namespace so the class writer can emit its accessor and constructor prop
 * as if the property had been authored on the class.
 *
 * @param context - The module context
 * @param klass - The implementing class
 */
export const collectInterfaceProperties = (context: ModuleContext, klass: GirClass): readonly GirProperty[] => {
    const seen = new Set<string>();
    for (const property of klass.properties) seen.add(toCamelIdentifier(property.name));
    forEachAncestor(context, klass, (ancestor, interfaces) => {
        for (const property of ancestor.klass.properties) seen.add(toCamelIdentifier(property.name));
        for (const iface of interfaces) {
            for (const property of iface.klass.properties) seen.add(toCamelIdentifier(property.name));
        }
    });
    const result: GirProperty[] = [];
    for (const iface of resolveDirectInterfaces(context, klass, context.namespace.name)) {
        for (const property of iface.klass.properties) {
            const name = toCamelIdentifier(property.name);
            if (seen.has(name)) continue;
            seen.add(name);
            result.push(property);
        }
    }
    return result;
};
