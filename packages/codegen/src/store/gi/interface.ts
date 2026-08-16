import { sanitizeTypeIdentifier, sourceStringLiteral } from "@gtkx/utils";
import type { GirClass } from "../../gir/class.js";
import type { GirProperty } from "../../gir/property.js";
import type { ModuleContext } from "../../writer/context.js";
import { reservedSignalMemberRename, resolvePrerequisiteReference } from "../../analysis/inheritance.js";
import { omittedTypeRef, prerequisiteConflicts } from "../../analysis/interface-conflicts.js";
import { resolveClassOrInterface, resolveInterfaces } from "../../gir/ancestry.js";
import { isEmittableEntity } from "../../gir/emittable.js";
import { renderJsDoc } from "../../writer/doc.js";
import { renderBlock, renderBraced, renderBracedOrEmpty } from "../../writer/emit.js";
import {
    type Callables,
    dedupeCallables,
    generateBindings,
    type InstanceMemberRenderer,
    type InstanceScope,
    instanceScope,
    isEmittableCallable,
    renderClassInstanceMember,
    renderInstanceMethodSignature,
    renderStaticHead,
} from "./callables.js";
import { annotationSpec, getDoc } from "./doc-spec.js";
import { renderSourceGtype } from "./gtype-binding.js";
import { methodExportName } from "./method.js";
import {
    type PropertyAccessorArgs,
    renderPropertyAccessor,
    renderPropertyAccessorSignature,
} from "./property-accessor.js";
import { appendInterfaceRegistration } from "./registration.js";
import { renderSignalDeclarations, renderSignalMembers } from "./signal.js";
import {
    hasCallableVfuncSlots,
    renderVfuncMembers,
    renderVfuncMetadata,
    type VfuncMemberMode,
} from "./vtable.js";

type InterfaceMemberRenderers = {
    renderMethod: InstanceMemberRenderer;
    renderProperty: (args: PropertyAccessorArgs) => string | undefined;
};

type MethodMemberOptions = {
    context: ModuleContext;
    className: string;
    scope: InstanceScope;
    callables: Callables;
    renderers: InterfaceMemberRenderers;
    claimedNames: Set<string>;
};

type PropertyMemberOptions = {
    context: ModuleContext;
    iface: GirClass;
    scope: InstanceScope;
    renderers: InterfaceMemberRenderers;
    claimedNames: Set<string>;
};

type InterfaceClassOptions = {
    iface: GirClass;
    className: string;
    callables: Callables;
    gtypeExpr: string | undefined;
    implRef: string;
};

const BRAND_NOTE = [
    "Phantom link to the type a class fills to adopt the interface, which `registerClass` reads",
    "through its `implements` option. It holds no value at runtime. `unknown` asks nothing of the",
    "class, which is what an interface with no slot to fill carries.",
].join("\n");

const generateInterface = (context: ModuleContext, iface: GirClass): void => {
    if (!isEmittableEntity(iface)) {
        return;
    }

    const className = sanitizeTypeIdentifier(iface.name);

    const callables: Callables = {
        constructors: dedupeCallables(iface.constructors),
        functions: dedupeCallables(iface.functions),
        methods: dedupeCallables(iface.methods),
    };

    generateBindings(context, callables);
    const gtypeExpr = renderSourceGtype(context, iface);
    const implRef = appendInterfaceTypes(context, iface, className, callables) ?? "unknown";
    const classCode = renderInterfaceClass(context, { iface, className, callables, gtypeExpr, implRef });
    context.declare({ name: className, code: classCode, owner: iface.name });

    for (const declaration of renderSignalDeclarations(context, iface, className, true)) {
        context.declare(declaration);
    }

    context.declare({
        name: makerName(className),
        code: renderInterfaceMaker(context, iface, className, callables),
    });

    appendInterfaceRegistration(context, {
        className,
        makerName: makerName(className),
        gtypeExpr,
        layout: renderInterfaceLayout(context, iface, callables),
    });
};

const makerName = (className: string): string => `make${className}`;

const renderInterfaceLayout = (
    context: ModuleContext,
    iface: GirClass,
    callables: Callables,
): string | undefined => {
    const vfuncs = renderVfuncMetadata(context, iface);
    const properties = renderSlotBackedProperties(context, iface, callables);

    if (vfuncs === undefined && properties === undefined) {
        return undefined;
    }

    const entries: string[] = [];

    if (vfuncs !== undefined) {
        entries.push(`vfuncs: ${vfuncs},`);
    }

    if (properties !== undefined) {
        entries.push(`properties: ${properties},`);
    }

    return renderBraced(entries.join("\n"));
};

const invokerMembers = (context: ModuleContext, iface: GirClass, callables: Callables): Map<string, string> => {
    const className = sanitizeTypeIdentifier(iface.name);

    const invokers: Set<string> = new Set(
        iface.vfuncs.map((vfunc) => vfunc.invoker).filter((invoker) => invoker !== undefined),
    );

    const members: Map<string, string> = new Map();

    for (const callable of callables.methods) {
        if (invokers.has(callable.name) && isEmittableCallable(context, callable)) {
            members.set(callable.name, reservedSignalMemberRename(className, callable) ?? methodExportName(callable));
        }
    }

    return members;
};

const renderSlotAccessor = (
    key: string,
    method: string | undefined,
    members: Map<string, string>,
): string | undefined => {
    const member = method === undefined ? undefined : members.get(method);

    return member === undefined ? undefined : `${key}: ${sourceStringLiteral(member)},`;
};

const renderSlotBackedProperty = (property: GirProperty, members: Map<string, string>): string | undefined => {
    if (!property.introspectable) {
        return undefined;
    }

    const fields = [
        renderSlotAccessor("getter", property.getter, members),
        renderSlotAccessor("setter", property.setter, members),
    ].filter((field) => field !== undefined);

    if (fields.length === 0) {
        return undefined;
    }

    return `${sourceStringLiteral(property.name)}: ${renderBraced(fields.join("\n"))},`;
};

const renderSlotBackedProperties = (
    context: ModuleContext,
    iface: GirClass,
    callables: Callables,
): string | undefined => {
    const members = invokerMembers(context, iface, callables);

    const entries = iface.properties
        .map((property) => renderSlotBackedProperty(property, members))
        .filter((entry) => entry !== undefined);

    return entries.length === 0 ? undefined : renderBraced(entries.join("\n"));
};

const appendInterfaceTypes = (
    context: ModuleContext,
    iface: GirClass,
    className: string,
    callables: Callables,
): string | undefined => {
    const typeCode = renderInterfaceType(context, iface, className, callables);
    context.declare({ name: className, code: typeCode, owner: iface.name });
    const implType = renderInterfaceImplType(context, iface, className);

    if (implType === undefined) {
        return undefined;
    }

    const implName = implTypeName(className);
    context.declare({ name: implName, code: implType, owner: iface.name });

    return implName;
};

const prerequisiteRef = (context: ModuleContext, iface: GirClass, name: string): string | undefined => {
    const ref = resolvePrerequisiteReference(context, name);
    const base = resolveClassOrInterface(context.library, context.namespace.name, name);

    if (ref === undefined || base === undefined) {
        return undefined;
    }

    return omittedTypeRef(ref, prerequisiteConflicts(context.library, iface, base));
};

const rootPrerequisiteRef = (context: ModuleContext, iface: GirClass): string => {
    const ref = context.qualify("GObject", "Object");
    const base = resolveClassOrInterface(context.library, "GObject", "Object");

    return base === undefined ? ref : omittedTypeRef(ref, prerequisiteConflicts(context.library, iface, base));
};

const interfaceTypeExtends = (context: ModuleContext, iface: GirClass): string => {
    const refs = iface.prerequisites
        .map((name) => prerequisiteRef(context, iface, name))
        .filter((entry): entry is string => entry !== undefined);

    if (refs.length > 0) {
        return refs.join(", ");
    }

    return rootPrerequisiteRef(context, iface);
};

const renderInterfaceType = (
    context: ModuleContext,
    iface: GirClass,
    className: string,
    callables: Callables,
): string => {
    const members = renderInterfaceTypeMembers(context, iface, callables);

    return `${getDoc(iface)}${renderBracedOrEmpty(
        `export interface ${className} extends ${interfaceTypeExtends(context, iface)}`,
        members.join("\n"),
    )}`;
};

const implTypeName = (className: string): string => `${className}Impl`;

const implTypeNote = (className: string): string =>
    [
        `Implementer side of \`${className}\`: the vtable slots a class fills to adopt the interface.`,
        "",
        `Declare it with \`implements ${implTypeName(className)}\` on a class passed to \`registerClass\``,
        `with \`${className}\` in \`implements\`. The interface's methods, properties, and signals come from`,
        "GLib dispatch, so they are not part of this type.",
        "",
        "Every slot is optional: an unfilled one keeps whatever the interface installs by default, and a",
        "GIR update can add one. Declaring a slot pins its signature; declaring it as a class field rather",
        "than a method satisfies this type but never reaches the vtable.",
    ].join("\n");

const implPrerequisiteRefs = (context: ModuleContext, iface: GirClass): string[] => {
    const prerequisites = resolveInterfaces(context.library, context.namespace.name, iface.prerequisites);
    const refs: string[] = [];

    for (const prerequisite of prerequisites) {
        if (!hasCallableVfuncSlots(context, prerequisite.namespaceName, prerequisite.klass)) {
            continue;
        }

        const name = implTypeName(sanitizeTypeIdentifier(prerequisite.klass.name));
        refs.push(context.qualify(prerequisite.namespaceName, name));
    }

    return refs;
};

const implTypeExtends = (context: ModuleContext, iface: GirClass): string => {
    const refs = implPrerequisiteRefs(context, iface);

    return refs.length > 0 ? ` extends ${refs.join(", ")}` : "";
};

const interfaceVfuncMembers = (context: ModuleContext, iface: GirClass, mode: VfuncMemberMode): string[] =>
    renderVfuncMembers({ context, klass: iface, mode });

const renderInterfaceImplType = (
    context: ModuleContext,
    iface: GirClass,
    className: string,
): string | undefined => {
    const members = interfaceVfuncMembers(context, iface, "requirement");

    if (members.length === 0) {
        return undefined;
    }

    return `${renderJsDoc(iface.doc, implTypeNote(className), annotationSpec(iface.annotations))}${renderBracedOrEmpty(
        `export interface ${implTypeName(className)}${implTypeExtends(context, iface)}`,
        members.join("\n"),
    )}`;
};

const collectMethodMembers = (options: MethodMemberOptions): string[] => {
    const { context, className, scope, callables, renderers, claimedNames } = options;
    const members: string[] = [];

    for (const callable of callables.methods) {
        const rename = reservedSignalMemberRename(className, callable);
        const block = renderers.renderMethod(context, callable, scope, rename);

        if (block === undefined) {
            continue;
        }

        members.push(block);
        claimedNames.add(rename ?? methodExportName(callable));
    }

    return members;
};

const collectPropertyMembers = (options: PropertyMemberOptions): string[] => {
    const { context, iface, renderers, claimedNames } = options;
    const members: string[] = [];

    for (const property of iface.properties) {
        const block = renderers.renderProperty({ context, property, claimedNames });

        if (block !== undefined) {
            members.push(block);
        }
    }

    return members;
};

const renderInterfaceMembers = (
    context: ModuleContext,
    iface: GirClass,
    callables: Callables,
    renderers: InterfaceMemberRenderers,
): string[] => {
    const className = sanitizeTypeIdentifier(iface.name);
    const scope = instanceScope(className, callables);
    const claimedNames: Set<string> = new Set();
    const methodMembers = collectMethodMembers({ context, className, scope, callables, renderers, claimedNames });
    const propertyMembers = collectPropertyMembers({ context, iface, scope, renderers, claimedNames });

    return [...methodMembers, ...propertyMembers];
};

const renderInterfaceTypeMembers = (context: ModuleContext, iface: GirClass, callables: Callables): string[] => [
    ...renderInterfaceMembers(context, iface, callables, {
        renderMethod: renderInstanceMethodSignature,
        renderProperty: renderPropertyAccessorSignature,
    }),
    ...interfaceVfuncMembers(context, iface, "signature"),
];

const renderInterfaceClass = (context: ModuleContext, options: InterfaceClassOptions): string => {
    const { iface, className, callables, gtypeExpr, implRef } = options;
    const members: string[] = [];

    if (gtypeExpr !== undefined) {
        members.push(renderInterfaceHasInstance(context, className, gtypeExpr));
    }

    members.push(...renderStaticHead(context, callables, className), renderInterfaceBrand(context, implRef));

    return `${getDoc(iface)}${renderBracedOrEmpty(
        `export abstract class ${className}`,
        members.join("\n\n"),
    )}`;
};

const renderInterfaceBrand = (context: ModuleContext, implRef: string): string => {
    context.addRuntimeTypeImport("Interface");

    return `${renderJsDoc(undefined, BRAND_NOTE)}declare static __impl__: Interface<${implRef}>["__impl__"];`;
};

const renderInterfaceHasInstance = (context: ModuleContext, className: string, gtypeExpr: string): string => {
    context.addRuntimeImport("valueIsA");

    return renderBlock(
        `static [Symbol.hasInstance](value: unknown): value is ${className}`,
        `return valueIsA(value, ${gtypeExpr});`,
    );
};

const renderInterfaceMaker = (
    context: ModuleContext,
    iface: GirClass,
    className: string,
    callables: Callables,
): string => {
    context.addRuntimeTypeImport("Mixin");
    const members = renderInterfaceInstanceMembers(context, iface, callables);
    const classExpression = renderBracedOrEmpty("class extends Base", members.join("\n\n"));

    return `${getDoc(iface)}export const ${makerName(className)}: Mixin = (Base) =>\n${classExpression};`;
};

const renderInterfaceInstanceMembers = (context: ModuleContext, iface: GirClass, callables: Callables): string[] => [
    ...renderInterfaceMembers(context, iface, callables, {
        renderMethod: renderClassInstanceMember,
        renderProperty: renderPropertyAccessor,
    }),
    ...interfaceVfuncMembers(context, iface, "implementation"),
    ...renderSignalMembers(context, iface),
];

export { generateInterface };
