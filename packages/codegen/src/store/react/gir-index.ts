import { toCamelIdentifier } from "@gtkx/utils";
import { ancestorChain } from "../../gir/ancestry.js";
import type { GirClass } from "../../gir/class.js";
import type { GirFunction } from "../../gir/function.js";
import type { Library } from "../../gir/library.js";
import type { GirNamespace } from "../../gir/namespace.js";
import type { GirParameter } from "../../gir/parameter.js";
import { glibNameOf, implementedInterfaces } from "./intrinsic-elements.js";

export type GirTypeEntry = {
    klass: GirClass;
    namespace: GirNamespace;
    isInterface: boolean;
};

export type GirIndex = {
    library: Library;
    index: Map<string, GirTypeEntry>;
};

export const buildGirIndex = (library: Library): GirIndex => {
    const index = new Map<string, GirTypeEntry>();
    for (const namespace of library.namespaces.values()) {
        for (const klass of namespace.classes) {
            const glibName = glibNameOf(klass);
            if (glibName !== undefined && !index.has(glibName)) {
                index.set(glibName, { klass, namespace, isInterface: false });
            }
        }
        for (const klass of namespace.interfaces) {
            const glibName = glibNameOf(klass);
            if (glibName !== undefined && !index.has(glibName)) {
                index.set(glibName, { klass, namespace, isInterface: true });
            }
        }
    }
    return { library, index };
};

export const chainOf = (context: GirIndex, entry: GirTypeEntry): GirClass[] => {
    if (entry.isInterface) return [entry.klass];
    const chain: GirClass[] = [];
    for (const { klass } of ancestorChain(context.library, entry.klass, entry.namespace.name)) chain.push(klass);
    for (const iface of implementedInterfaces(entry.klass, entry.namespace, context.library)) chain.push(iface.klass);
    return chain;
};

type ResolvedMethod = {
    fn: GirFunction;
    params: GirParameter[];
};

export const findMethod = (context: GirIndex, typeName: string, camelName: string): ResolvedMethod | undefined => {
    const entry = context.index.get(typeName);
    if (entry === undefined) return undefined;
    for (const klass of chainOf(context, entry)) {
        const fn = klass.methods.find(
            (method) =>
                method.introspectable &&
                method.shadowedBy === undefined &&
                toCamelIdentifier(method.name) === camelName,
        );
        if (fn !== undefined) {
            return { fn, params: fn.parameters.filter((param) => param.direction === "in") };
        }
    }
    return undefined;
};

export const hasMethod = (context: GirIndex, typeName: string, camelName: string): boolean => {
    const entry = context.index.get(typeName);
    if (entry === undefined) return false;
    return chainOf(context, entry).some((klass) =>
        klass.methods.some((method) => method.introspectable && toCamelIdentifier(method.name) === camelName),
    );
};

export const hasProperty = (context: GirIndex, typeName: string, camelName: string): boolean => {
    const entry = context.index.get(typeName);
    if (entry === undefined) return false;
    return chainOf(context, entry).some((klass) =>
        klass.properties.some((property) => toCamelIdentifier(property.name) === camelName),
    );
};
