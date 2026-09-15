import { sanitizeTypeIdentifier, toCamelIdentifier } from "@gtkx/utils";
import type { GirClass } from "../gir/class.js";
import type { GirFunction } from "../gir/function.js";
import type { Library } from "../gir/library.js";
import type { GirParameter } from "../gir/parameter.js";
import type { GirProperty } from "../gir/property.js";
import type { TypeId } from "../gir/type-id.js";
import type { ModuleContext } from "../writer/context.js";
import { ancestorChain, type ResolvedAncestor, resolveInterfaces } from "../gir/ancestry.js";
import { isEmittableEntity } from "../gir/emittable.js";
import {
    type InstanceScope,
    instanceScope,
    isEmittableCallable,
    renderInstanceMethodReturnType,
} from "../store/gi/callables.js";
import { memberName, methodExportName } from "../store/gi/method.js";
import { type InheritedAccessorTypes, resolveAccessorTypes } from "../store/gi/property-accessor.js";
import { vfuncMemberNames } from "../store/gi/vtable.js";
import { comparisonContextFor } from "../writer/comparison-context.js";
import { inputParameters } from "./param-structure.js";
import { renderTsType } from "./ts-type.js";

type AncestryContext = {
    library: Library;
    namespace: { name: string };
};

type OwnedProperty = { owner: GirClass; property: GirProperty };
type PropertyFilter = (owner: GirClass, property: GirProperty) => boolean;
type DeclaredAccessorType = { type: string; owner: string };
type DeclaredAccessorTypes = { read: DeclaredAccessorType | undefined; write: DeclaredAccessorType | undefined };
type MethodSignature = { returnType: string; arity: number };

type InheritedMethod = { method: GirFunction; returnType: string };
type InheritedMethods = Map<string, InheritedMethod>;

type ParameterPair = {
    own: GirParameter;
    inherited: GirParameter;
};

const RESERVED_SIGNAL_MEMBERS = new Set([
    "connect",
    "disconnect",
    "emit",
    "on",
    "once",
    "off",
]);

const resolveDirectInterfaces = (
    context: AncestryContext,
    klass: GirClass,
    defaultNamespace: string,
): ResolvedAncestor[] => resolveInterfaces(context.library, defaultNamespace, klass.implements);

const resolvePrerequisiteReference = (context: ModuleContext, name: string): string | undefined => {
    const resolved = context.library.resolveType(context.namespace.name, name);

    if (resolved === undefined) {
        return undefined;
    }

    if (resolved.kind !== "interface" && resolved.kind !== "class") {
        return undefined;
    }

    if (!isEmittableEntity(resolved.value)) {
        return undefined;
    }

    return context.qualify(resolved.namespace.name, sanitizeTypeIdentifier(resolved.value.name));
};

const forEachAncestor = (
    context: AncestryContext,
    klass: GirClass,
    visit: (ancestor: ResolvedAncestor, interfaces: ResolvedAncestor[]) => void,
    shouldStop: (ancestor: GirClass) => boolean = () => false,
): void => {
    let isFirst = true;

    for (const ancestor of ancestorChain(context.library, klass, context.namespace.name)) {
        if (isFirst) {
            isFirst = false;
            continue;
        }

        if (shouldStop(ancestor.klass)) {
            break;
        }

        visit(ancestor, resolveDirectInterfaces(context, ancestor.klass, ancestor.namespaceName));
    }
};

const visitInterfaceProperties = (
    interfaces: ResolvedAncestor[],
    visit: (owner: GirClass, property: GirProperty) => void,
): void => {
    for (const iface of interfaces) {
        for (const property of iface.klass.properties) {
            visit(iface.klass, property);
        }
    }
};

const forEachAncestorProperty = (
    context: ModuleContext,
    klass: GirClass,
    visit: (owner: GirClass, property: GirProperty) => void,
): void => {
    forEachAncestor(context, klass, (ancestor, interfaces) => {
        for (const property of ancestor.klass.properties) {
            visit(ancestor.klass, property);
        }

        visitInterfaceProperties(interfaces, visit);
    });
};

const forEachInheritedProperty = (
    context: ModuleContext,
    klass: GirClass,
    visit: (owner: GirClass, property: GirProperty) => void,
): void => {
    visitInterfaceProperties(resolveDirectInterfaces(context, klass, context.namespace.name), visit);
    forEachAncestorProperty(context, klass, visit);
};

const collectSeenPropertyNames = (context: ModuleContext, klass: GirClass): Set<string> => {
    const seen: Set<string> = new Set();

    for (const property of klass.properties) {
        seen.add(toCamelIdentifier(property.name));
    }

    forEachAncestorProperty(context, klass, (_owner, property) => seen.add(toCamelIdentifier(property.name)));

    return seen;
};

const collectNewInterfaceProperties = (
    iface: ResolvedAncestor,
    seen: Set<string>,
    shouldInclude: PropertyFilter,
): OwnedProperty[] => {
    const result: OwnedProperty[] = [];

    for (const property of iface.klass.properties) {
        const name = toCamelIdentifier(property.name);

        if (!shouldInclude(iface.klass, property) || seen.has(name)) {
            continue;
        }

        seen.add(name);
        result.push({ owner: iface.klass, property });
    }

    return result;
};

const collectInterfaceProperties = (
    context: ModuleContext,
    klass: GirClass,
    shouldInclude: PropertyFilter = () => true,
): OwnedProperty[] => {
    const seen = collectSeenPropertyNames(context, klass);
    const result: OwnedProperty[] = [];

    for (const iface of resolveDirectInterfaces(context, klass, context.namespace.name)) {
        result.push(...collectNewInterfaceProperties(iface, seen, shouldInclude));
    }

    return result;
};

const recordAncestorSignatures = (
    context: ModuleContext,
    klass: GirClass,
    signatures: Map<string, MethodSignature>,
): void => {
    const scope = instanceScope(klass.name, klass);

    for (const method of klass.methods) {
        const name = memberName(method.name);

        if (!isEmittableCallable(context, method) || signatures.has(name)) {
            continue;
        }

        signatures.set(name, {
            returnType: renderInstanceMethodReturnType(comparisonContextFor(context), method, scope),
            arity: inputParameters(context.library, method).length,
        });
    }
};

const ancestorClassMethodSignatures = (context: ModuleContext, klass: GirClass): Map<string, MethodSignature> => {
    const signatures: Map<string, MethodSignature> = new Map();

    forEachAncestor(context, klass, (ancestor) => {
        recordAncestorSignatures(context, ancestor.klass, signatures);
    });

    return signatures;
};

const ancestorClassMethodNames = (context: ModuleContext, klass: GirClass): Set<string> =>
    new Set(ancestorClassMethodSignatures(context, klass).keys());

const mergeOmissionName = (
    context: ModuleContext,
    method: GirFunction,
    scope: InstanceScope,
    ancestors: Map<string, MethodSignature>,
): string | undefined => {
    if (!isEmittableCallable(context, method)) {
        return undefined;
    }

    const name = memberName(method.name);
    const ancestor = ancestors.get(name);

    if (ancestor === undefined) {
        return undefined;
    }

    const returnType = renderInstanceMethodReturnType(comparisonContextFor(context), method, scope);
    const arity = inputParameters(context.library, method).length;

    return ancestor.returnType !== returnType || ancestor.arity !== arity ? name : undefined;
};

const classChainVfuncNames = (context: ModuleContext, klass: GirClass): Set<string> => {
    const names: Set<string> = new Set(vfuncMemberNames(context, context.namespace.name, klass));

    forEachAncestor(context, klass, (ancestor) => {
        for (const name of vfuncMemberNames(context, ancestor.namespaceName, ancestor.klass)) {
            names.add(name);
        }
    });

    return names;
};

const methodMergeOmissions = (context: ModuleContext, klass: GirClass, iface: GirClass): string[] => {
    const ancestors = ancestorClassMethodSignatures(context, klass);
    const scope = instanceScope(iface.name, iface);

    return iface.methods
        .map((method) => mergeOmissionName(context, method, scope, ancestors))
        .filter((name): name is string => name !== undefined);
};

const vfuncMergeOmissions = (
    context: ModuleContext,
    klass: GirClass,
    iface: { klass: GirClass; namespaceName: string },
): string[] => {
    const claimed = classChainVfuncNames(context, klass);

    return vfuncMemberNames(context, iface.namespaceName, iface.klass).filter((name) => claimed.has(name));
};

const propertyMergeOmissions = (context: ModuleContext, klass: GirClass, iface: GirClass): string[] => {
    const declared = new Map(klass.properties.map((property) => [property.name, property]));
    const omitted: string[] = [];

    for (const property of iface.properties) {
        const own = declared.get(property.name);

        if (own === undefined) {
            continue;
        }

        const ownTypes = resolveAccessorTypes(context, own);
        const interfaceTypes = resolveAccessorTypes(context, property);

        if (ownTypes?.readType !== interfaceTypes?.readType || ownTypes?.writeType !== interfaceTypes?.writeType) {
            omitted.push(toCamelIdentifier(property.name));
        }
    }

    return omitted;
};

const collectInterfaceMergeOmissions = (
    context: ModuleContext,
    klass: GirClass,
    iface: { klass: GirClass; namespaceName: string },
): string[] => [
    ...methodMergeOmissions(context, klass, iface.klass),
    ...propertyMergeOmissions(context, klass, iface.klass),
    ...vfuncMergeOmissions(context, klass, iface),
];

const declaredBy = (type: string | undefined, owner: string): DeclaredAccessorType | undefined =>
    type === undefined ? undefined : { type, owner };

const reconcileAccessorType = (
    jsName: string,
    direction: string,
    declared: DeclaredAccessorType | undefined,
    candidate: DeclaredAccessorType | undefined,
): DeclaredAccessorType | undefined => {
    if (candidate === undefined) {
        return declared;
    }

    if (declared === undefined || declared.type === candidate.type) {
        return declared ?? candidate;
    }

    throw new Error(
        `Cannot type the ${direction} accessor of ${jsName}: ${declared.owner} declares it as ${declared.type} ` +
        `and ${candidate.owner} declares it as ${candidate.type}. Both are bases of the same class, so no single ` +
        "member satisfies them; correct the GIR the disagreeing base comes from.",
    );
};

const recordInheritedPropertyType = (
    context: ModuleContext,
    types: Map<string, DeclaredAccessorTypes>,
    owner: GirClass,
    property: GirProperty,
): void => {
    const accessorTypes = resolveAccessorTypes(context, property);

    if (accessorTypes === undefined) {
        return;
    }

    const jsName = toCamelIdentifier(property.name);
    const declared = types.get(jsName);

    types.set(jsName, {
        read: reconcileAccessorType(jsName, "read", declared?.read, declaredBy(accessorTypes.readType, owner.name)),
        write: reconcileAccessorType(jsName, "write", declared?.write, declaredBy(accessorTypes.writeType, owner.name)),
    });
};

const collectInheritedPropertyTypes = (
    context: ModuleContext,
    klass: GirClass,
): Map<string, InheritedAccessorTypes> => {
    const declared: Map<string, DeclaredAccessorTypes> = new Map();

    forEachInheritedProperty(context, klass, (owner, property) => {
        recordInheritedPropertyType(context, declared, owner, property);
    });

    const types: Map<string, InheritedAccessorTypes> = new Map();

    for (const [jsName, entry] of declared) {
        types.set(jsName, { readType: entry.read?.type, writeType: entry.write?.type });
    }

    return types;
};

const collectInheritedMethods = (context: ModuleContext, klass: GirClass): InheritedMethods => {
    const accumulator: InheritedMethods = new Map();
    const inheritedInterfaces: ResolvedAncestor[][] = [];

    forEachAncestor(context, klass, (ancestor, interfaces) => {
        absorbInheritedMethods(context, ancestor.klass, accumulator);
        inheritedInterfaces.push(interfaces);
    });

    for (const interfaces of inheritedInterfaces.toReversed()) {
        for (const iface of interfaces) {
            absorbInheritedMethods(context, iface.klass, accumulator);
        }
    }

    return accumulator;
};

const absorbInheritedMethods = (
    context: ModuleContext,
    klass: GirClass,
    accumulator: InheritedMethods,
): void => {
    const scope = instanceScope(klass.name, klass);

    for (const method of klass.methods) {
        if (!isEmittableCallable(context, method)) {
            continue;
        }

        const name = methodExportName(method);

        if (accumulator.has(name)) {
            continue;
        }

        accumulator.set(name, {
            method,
            returnType: renderInstanceMethodReturnType(comparisonContextFor(context), method, scope),
        });
    }
};

const isCallbackType = (context: ModuleContext, ref: TypeId | undefined): boolean =>
    ref !== undefined && context.library.typeFor(ref)?.kind === "callback";

const areParametersComparable = (context: ModuleContext, pair: ParameterPair): boolean => {
    const scratch = comparisonContextFor(context);

    return renderTsType(scratch, pair.own.type) === renderTsType(scratch, pair.inherited.type);
};

const inputParameterPairs = (context: ModuleContext, own: GirFunction, inherited: GirFunction): ParameterPair[] => {
    const ownParams = inputParameters(context.library, own);
    const inheritedParams = inputParameters(context.library, inherited);

    return ownParams.flatMap((entry, index) => {
        const inherited = inheritedParams[index];

        return inherited === undefined ? [] : [{ own: entry.parameter, inherited: inherited.parameter }];
    });
};

const enumIdentity = (context: ModuleContext, ref: TypeId | undefined): string | undefined => {
    if (ref === undefined) {
        return undefined;
    }

    const resolved = context.library.typeFor(ref);

    return resolved?.kind === "enum" ? `${resolved.namespace.name}.${resolved.value.name}` : undefined;
};

const hasEnumConflict = (
    context: ModuleContext,
    ownRef: TypeId | undefined,
    inheritedRef: TypeId | undefined,
): boolean => {
    const ownEnum = enumIdentity(context, ownRef);
    const inheritedEnum = enumIdentity(context, inheritedRef);

    return ownEnum !== undefined && inheritedEnum !== undefined && ownEnum !== inheritedEnum;
};

const hasDroppedCallbackParameter = (
    context: ModuleContext,
    own: GirFunction,
    inherited: GirFunction,
): boolean => {
    const ownCount = inputParameters(context.library, own).length;

    return inputParameters(context.library, inherited)
        .slice(ownCount)
        .some((entry) => isCallbackType(context, entry.parameter.type));
};

const hasParameterConflict = (context: ModuleContext, own: GirFunction, inherited: GirFunction): boolean => {
    const ownCount = inputParameters(context.library, own).length;

    if (ownCount > inputParameters(context.library, inherited).length) {
        return true;
    }

    if (hasDroppedCallbackParameter(context, own, inherited)) {
        return true;
    }

    return inputParameterPairs(context, own, inherited).some(
        (pair) =>
            hasEnumConflict(context, pair.own.type, pair.inherited.type) ||
            !areParametersComparable(context, pair),
    );
};

const hasMethodConflict = (
    context: ModuleContext,
    callable: GirFunction,
    scope: InstanceScope,
    inherited: InheritedMethod,
): boolean => {
    const scratch = comparisonContextFor(context);

    return (
        inherited.returnType !== renderInstanceMethodReturnType(scratch, callable, scope) ||
        hasParameterConflict(context, callable, inherited.method)
    );
};

const shadowedInstanceMemberName = (
    context: ModuleContext,
    callable: GirFunction,
    scope: InstanceScope,
    inherited: InheritedMethods,
): string | undefined => {
    if (!isEmittableCallable(context, callable)) {
        return undefined;
    }

    const name = methodExportName(callable);
    const match = inherited.get(name);

    return RESERVED_SIGNAL_MEMBERS.has(name) ||
        (match !== undefined && hasMethodConflict(context, callable, scope, match))
        ? name
        : undefined;
};

const naturalSignalMemberNames = (context: ModuleContext, klass: GirClass): string[] =>
    klass.methods
        .filter((method) => isEmittableCallable(context, method))
        .map((method) => methodExportName(method))
        .filter((name) => RESERVED_SIGNAL_MEMBERS.has(name));

const hasOwnNaturalMember = (context: ModuleContext, klass: GirClass, name: string): boolean =>
    klass.methods.some((method) => isEmittableCallable(context, method) && methodExportName(method) === name);

const hasNaturalInterfaceMember = (
    context: ModuleContext,
    iface: ResolvedAncestor,
    name: string,
    visited: Set<string>,
): boolean => {
    const key = `${iface.namespaceName}.${iface.klass.name}`;

    if (visited.has(key)) {
        return false;
    }

    visited.add(key);

    if (hasOwnNaturalMember(context, iface.klass, name)) {
        return true;
    }

    return iface.klass.prerequisites.some((prerequisite) => {
        const resolved = context.library.resolveType(iface.namespaceName, prerequisite);

        return (
            resolved?.kind === "interface" &&
            hasNaturalInterfaceMember(
                context,
                { klass: resolved.value, namespace: resolved.namespace, namespaceName: resolved.namespace.name },
                name,
                visited,
            )
        );
    });
};

const hasNaturalAncestorMember = (
    context: ModuleContext,
    ancestor: ResolvedAncestor,
    name: string,
    visited: Set<string>,
): boolean =>
    hasOwnNaturalMember(context, ancestor.klass, name) ||
    resolveDirectInterfaces(context, ancestor.klass, ancestor.namespaceName).some((iface) =>
        hasNaturalInterfaceMember(context, iface, name, visited),
    );

const hasNaturalMember = (context: ModuleContext, klass: GirClass, name: string): boolean => {
    const visited: Set<string> = new Set();

    return ancestorChain(context.library, klass, context.namespace.name).some((ancestor) =>
        hasNaturalAncestorMember(context, ancestor, name, visited),
    );
};

const effectiveNaturalSignalMemberNames = (context: ModuleContext, klass: GirClass): string[] =>
    [...RESERVED_SIGNAL_MEMBERS].filter((name) => hasNaturalMember(context, klass, name));

const hasNaturalClassChainMember = (context: ModuleContext, klass: GirClass, name: string): boolean => {
    const visited: Set<string> = new Set();

    return ancestorChain(context.library, klass, context.namespace.name).some(
        (ancestor, index) =>
            hasOwnNaturalMember(context, ancestor.klass, name) ||
            (index > 0 &&
                resolveDirectInterfaces(context, ancestor.klass, ancestor.namespaceName).some((iface) =>
                    hasNaturalInterfaceMember(context, iface, name, visited),
                )),
    );
};

export {
    ancestorClassMethodNames,
    resolvePrerequisiteReference,
    forEachAncestor,
    collectInterfaceProperties,
    collectInterfaceMergeOmissions,
    collectInheritedPropertyTypes,
    collectInheritedMethods,
    effectiveNaturalSignalMemberNames,
    hasNaturalMember,
    hasNaturalClassChainMember,
    naturalSignalMemberNames,
    shadowedInstanceMemberName,
};
