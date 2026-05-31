import { toCamelCase, toIdentifier } from "@gtkx/utils";
import type { ModuleContext } from "../dsl/context.js";
import type { GirClass } from "../gir/class.js";
import type { GirProperty } from "../gir/property.js";
import { type ResolvedQualifiedClass, resolveQualifiedClass, splitQualifiedName } from "../gir/qualified-name.js";
import { qualifyTypeRef } from "../gir/qualify.js";

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
 * @param ctx - The module context
 * @param name - The (possibly cross-namespace) interface name
 */
export const resolveImplementedInterface = (
    ctx: ModuleContext,
    name: string,
    defaultNamespace: string = ctx.namespace.name,
): ResolvedInterface | undefined => {
    const { namespaceName, typeName } = splitQualifiedName(name, defaultNamespace);
    const resolved = ctx.repository.resolveNamed(namespaceName, typeName);
    if (resolved === undefined || resolved.kind !== "interface") return undefined;
    return { klass: resolved.value, namespaceName: resolved.namespace.name };
};

/**
 * Invokes `visit` for each ancestor class of `klass`, nearest first.
 *
 * Walks the same-namespace and cross-namespace parent chain, stopping at the
 * first unresolved parent or a cycle. Each ancestor is reported together with
 * the namespace it was resolved through so callers can qualify its references.
 *
 * @param ctx - The module context
 * @param klass - The class whose ancestors to visit
 * @param visit - Callback invoked once per resolved ancestor
 */
export const forEachAncestor = (
    ctx: ModuleContext,
    klass: GirClass,
    visit: (ancestor: ResolvedQualifiedClass) => void,
): void => {
    const visited = new Set<string>();
    let current = klass.parent === undefined ? undefined : { name: klass.parent, defaultNamespace: ctx.namespace.name };
    while (current !== undefined) {
        const resolved = resolveQualifiedClass(ctx.repository, current.name, current.defaultNamespace);
        if (resolved === undefined) break;
        const key = `${resolved.namespaceName}.${resolved.klass.name}`;
        if (visited.has(key)) break;
        visited.add(key);
        visit(resolved);
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
 * @param ctx - The module context
 * @param klass - The implementing class
 */
export const collectInterfaceProperties = (ctx: ModuleContext, klass: GirClass): readonly GirProperty[] => {
    const seen = new Set<string>();
    for (const property of klass.properties) seen.add(toIdentifier(toCamelCase(property.name)));
    forEachAncestor(ctx, klass, (ancestor) => {
        for (const property of ancestor.klass.properties) seen.add(toIdentifier(toCamelCase(property.name)));
        for (const implementName of ancestor.klass.implements) {
            const iface = resolveImplementedInterface(ctx, implementName, ancestor.namespaceName);
            if (iface === undefined) continue;
            for (const property of iface.klass.properties) seen.add(toIdentifier(toCamelCase(property.name)));
        }
    });
    const result: GirProperty[] = [];
    for (const implementName of klass.implements) {
        const iface = resolveImplementedInterface(ctx, implementName);
        if (iface === undefined) continue;
        for (const property of iface.klass.properties) {
            const name = toIdentifier(toCamelCase(property.name));
            if (seen.has(name)) continue;
            seen.add(name);
            result.push({ ...property, type: qualifyTypeRef(property.type, iface.namespaceName) });
        }
    }
    return result;
};
