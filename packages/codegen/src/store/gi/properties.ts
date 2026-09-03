import { sanitizeTypeIdentifier, sourceStringLiteral, toCamelIdentifier } from "@gtkx/utils";
import type { GirClass } from "../../gir/class.js";
import type { GirProperty } from "../../gir/property.js";
import type { ModuleContext } from "../../writer/context.js";
import type { Declaration } from "../../writer/module.js";
import { collectInheritedPropertyTypes, collectInterfaceProperties } from "../../analysis/inheritance.js";
import { isEmittableEntity } from "../../gir/emittable.js";
import { declaredTypeNames, type GirNamespace } from "../../gir/namespace.js";
import { renderBraced, renderBracedOrEmpty } from "../../writer/emit.js";
import { parentCompanionRef } from "./companion.js";
import { propertyDoc, type ResolvedAccessor, resolvePropertyMetadata } from "./property-accessor.js";

const PROPERTIES_SUFFIX = "Properties";
const WRITABLE_PROPERTIES_SUFFIX = "WritableProperties";
type PropertyMapMember = "__properties__" | "__writableProperties__";
type PropertyMapSpec = {
    member: PropertyMapMember;
    suffix: string;
    accepts: (accessor: ResolvedAccessor) => boolean;
    valueType: (accessor: ResolvedAccessor) => string;
};
type ClassPropertyMapOptions = {
    context: ModuleContext;
    klass: GirClass;
    className: string;
    accessors: ResolvedAccessor[];
    spec: PropertyMapSpec;
};

const PROPERTY_MAP_SPECS: PropertyMapSpec[] = [
    {
        member: "__properties__",
        suffix: PROPERTIES_SUFFIX,
        accepts: (accessor) => accessor.hasGetter && accessor.supportsDescriptorFreeAccess,
        valueType: (accessor) => accessor.readType,
    },
    {
        member: "__writableProperties__",
        suffix: WRITABLE_PROPERTIES_SUFFIX,
        accepts: (accessor) => accessor.isWritable && accessor.supportsDescriptorFreeAccess,
        valueType: (accessor) => accessor.writeType,
    },
];

const propertyEntry = (accessor: ResolvedAccessor, spec: PropertyMapSpec): string =>
    `${propertyDoc(accessor.property)}${accessor.jsName}: ${spec.valueType(accessor)};`;

const isPropertyMatch = (context: ModuleContext, property: GirProperty, spec: PropertyMapSpec): boolean => {
    const accessor = resolvePropertyMetadata(context, property);

    return accessor !== undefined && spec.accepts(accessor);
};

const interfaceEntries = (context: ModuleContext, klass: GirClass, spec: PropertyMapSpec): string[] => {
    const entries: string[] = [];
    const properties = collectInterfaceProperties(
        context,
        klass,
        (_owner, candidate) => isPropertyMatch(context, candidate, spec),
    );

    for (const { property } of properties) {
        const accessor = resolvePropertyMetadata(context, property);

        if (accessor === undefined) {
            continue;
        }

        entries.push(propertyEntry(accessor, spec));
    }

    return entries;
};

const classPropertyMetadata = (context: ModuleContext, klass: GirClass): ResolvedAccessor[] => {
    const inheritedTypes = collectInheritedPropertyTypes(context, klass);

    return klass.properties
        .map((property) =>
            resolvePropertyMetadata(context, property, inheritedTypes.get(toCamelIdentifier(property.name))),
        )
        .filter((accessor): accessor is ResolvedAccessor => accessor !== undefined);
};

const renderClassPropertyMap = (options: ClassPropertyMapOptions): Declaration => {
    const { context, klass, className, accessors, spec } = options;
    const parentRef = parentCompanionRef(context, klass, spec.suffix);
    const ownKeys = [...new Set(
        klass.properties
            .map((property) => sourceStringLiteral(toCamelIdentifier(property.name))),
    )];
    const omitted = parentRef === undefined || ownKeys.length === 0
        ? parentRef
        : `Omit<${parentRef}, ${ownKeys.join(" | ")}>`;
    const extendsClause = omitted === undefined ? "" : ` extends ${omitted}`;
    const entries = [
        ...accessors.filter((accessor) => spec.accepts(accessor)).map((accessor) => propertyEntry(accessor, spec)),
        ...interfaceEntries(context, klass, spec),
    ];
    const map = `${className}${spec.suffix}`;

    return { name: map, code: renderBracedOrEmpty(`export interface ${map}${extendsClause}`, entries.join("\n")) };
};

const renderPropertyDeclarations = (
    context: ModuleContext,
    klass: GirClass,
    className: string,
): Declaration[] => {
    const accessors = classPropertyMetadata(context, klass);
    const maps = PROPERTY_MAP_SPECS.map((spec) =>
        renderClassPropertyMap({ context, klass, className, accessors, spec }),
    );
    const members = PROPERTY_MAP_SPECS.map((spec) => `${spec.member}: ${className}${spec.suffix};`);

    return [
        ...maps,
        {
            name: className,
            code: renderBracedOrEmpty(`export interface ${className}`, members.join("\n")),
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

const interfacePropertyBase = (context: ModuleContext, iface: GirClass, member: PropertyMapMember): string => {
    const refs = iface.prerequisites
        .map((name) => prerequisiteRef(context, name))
        .filter((ref): ref is string => ref !== undefined);
    const bases = refs.length > 0 ? refs : [context.qualify("GObject", "Object")];

    return bases.map((base) => `${base}[${sourceStringLiteral(member)}]`).join(" & ");
};

const interfacePropertyMapName = (namespace: GirNamespace, className: string, suffix: string): string => {
    const taken = declaredTypeNames(namespace);
    let name = `${className}${suffix}`;

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
        .map((property) => resolvePropertyMetadata(context, property))
        .filter((accessor): accessor is ResolvedAccessor => accessor !== undefined);
    const declarations: Declaration[] = [];
    const members: string[] = [];

    for (const spec of PROPERTY_MAP_SPECS) {
        const accepted = accessors.filter((accessor) => spec.accepts(accessor));

        if (accepted.length === 0) {
            continue;
        }

        const map = interfacePropertyMapName(context.namespace, className, spec.suffix);
        const keys = accepted.map((accessor) => sourceStringLiteral(accessor.jsName)).join(" | ");
        const base = `Omit<${interfacePropertyBase(context, iface, spec.member)}, ${keys}>`;
        const entries = accepted.map((accessor) => propertyEntry(accessor, spec));
        declarations.push({ name: map, code: `export type ${map} = ${base} & ${renderBraced(entries.join("\n"))};` });
        members.push(`${spec.member}: ${map};`);
    }

    if (members.length > 0) {
        declarations.push({
            name: className,
            code: renderBracedOrEmpty(`export interface ${className}`, members.join("\n")),
        });
    }

    return declarations;
};

export { renderInterfacePropertyDeclarations, renderPropertyDeclarations };
