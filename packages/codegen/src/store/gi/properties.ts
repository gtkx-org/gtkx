import { sanitizeTypeIdentifier, sourceStringLiteral } from "@gtkx/utils";
import type { GirClass } from "../../gir/class.js";
import type { ModuleContext } from "../../writer/context.js";
import type { Declaration } from "../../writer/module.js";
import { collectInterfaceProperties } from "../../analysis/inheritance.js";
import { isEmittableEntity } from "../../gir/emittable.js";
import { declaredTypeNames, type GirNamespace } from "../../gir/namespace.js";
import { renderBraced, renderBracedOrEmpty } from "../../writer/emit.js";
import { parentCompanionRef } from "./companion.js";
import { propertyDoc, type ResolvedAccessor, resolveOwnerAccessor } from "./property-accessor.js";

const PROPERTIES_SUFFIX = "Properties";

const propertyEntry = (accessor: ResolvedAccessor): string =>
    `${propertyDoc(accessor.property)}${accessor.jsName}: ${accessor.readType};`;

const interfaceEntries = (context: ModuleContext, klass: GirClass): string[] => {
    const entries: string[] = [];

    for (const { owner, property } of collectInterfaceProperties(context, klass)) {
        const accessor = resolveOwnerAccessor(context, property, owner.methods);

        if (!accessor?.hasGetter) {
            continue;
        }

        entries.push(propertyEntry(accessor));
    }

    return entries;
};

const renderPropertyDeclarations = (
    context: ModuleContext,
    klass: GirClass,
    className: string,
    accessors: ResolvedAccessor[],
): Declaration[] => {
    const parentRef = parentCompanionRef(context, klass, PROPERTIES_SUFFIX);
    const extendsClause = parentRef === undefined ? "" : ` extends ${parentRef}`;

    const entries = [
        ...accessors.filter((accessor) => accessor.hasGetter).map((accessor) => propertyEntry(accessor)),
        ...interfaceEntries(context, klass),
    ];

    const map = `${className}${PROPERTIES_SUFFIX}`;

    return [
        { name: map, code: renderBracedOrEmpty(`export interface ${map}${extendsClause}`, entries.join("\n")) },
        {
            name: className,
            code: renderBracedOrEmpty(`export interface ${className}`, `__properties__: ${map};`),
        },
    ];
};

const prerequisiteRef = (context: ModuleContext, name: string): string | undefined => {
    const resolved = context.library.resolveType(context.namespace.name, name);

    if (resolved === undefined || (resolved.kind !== "class" && resolved.kind !== "interface")) {
        return undefined;
    }

    if (!isEmittableEntity(resolved.value)) {
        return undefined;
    }

    return context.qualify(resolved.namespace.name, sanitizeTypeIdentifier(resolved.value.name));
};

const interfacePropertyBase = (context: ModuleContext, iface: GirClass): string => {
    const refs = iface.prerequisites
        .map((name) => prerequisiteRef(context, name))
        .filter((ref): ref is string => ref !== undefined);
    const bases = refs.length > 0 ? refs : [context.qualify("GObject", "Object")];

    return bases.map((base) => `${base}["__properties__"]`).join(" & ");
};

const interfacePropertyMapName = (namespace: GirNamespace, className: string): string => {
    const taken = declaredTypeNames(namespace);
    let name = `${className}${PROPERTIES_SUFFIX}`;

    while (taken.has(name)) {
        name += "Map";
    }

    return name;
};

const renderInterfacePropertyDeclarations = (
    context: ModuleContext,
    iface: GirClass,
    className: string,
): Declaration[] => {
    const accessors = iface.properties
        .map((property) => resolveOwnerAccessor(context, property, iface.methods))
        .filter((accessor): accessor is ResolvedAccessor => accessor?.hasGetter === true);

    if (accessors.length === 0) {
        return [];
    }

    const map = interfacePropertyMapName(context.namespace, className);
    const keys = accessors.map((accessor) => sourceStringLiteral(accessor.jsName)).join(" | ");
    const base = `Omit<${interfacePropertyBase(context, iface)}, ${keys}>`;
    const entries = accessors.map((accessor) => propertyEntry(accessor));

    return [
        { name: map, code: `export type ${map} = ${base} & ${renderBraced(entries.join("\n"))};` },
        {
            name: className,
            code: renderBracedOrEmpty(`export interface ${className}`, `__properties__: ${map};`),
        },
    ];
};

export { renderInterfacePropertyDeclarations, renderPropertyDeclarations };
