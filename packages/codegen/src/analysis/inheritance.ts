import { lowerFirst, pascalCase, sanitizeTypeIdentifier, toCamelIdentifier } from "@gtkx/utils";
import type { GirClass } from "../gir/class.js";
import type { GirFunction } from "../gir/function.js";
import type { Library } from "../gir/library.js";
import type { GirParameter } from "../gir/parameter.js";
import type { GirProperty } from "../gir/property.js";
import type { TypeId } from "../gir/type-id.js";
import type { ModuleContext } from "../writer/context.js";
import { ancestorChain, type ResolvedAncestor, resolveInterfaces } from "../gir/ancestry.js";
import { isEmittableEntity } from "../gir/emittable.js";
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
type MethodSignature = { returnType: string; arity: number };

type InheritedMethod = {
    method: GirFunction;
    namespaceName: string;
};

type InheritedMethods = {
    returnTypes: Map<string, string>;
    definitions: Map<string, InheritedMethod>;
};

type ParameterPair = {
    own: GirParameter;
    inherited: GirParameter;
};

type InheritedMatch = {
    inheritedReturn: string;
    inheritedMethod: InheritedMethod;
};

const RESERVED_SIGNAL_MEMBERS = new Set([
    "connect",
    "disconnect",
    "emit",
    "on",
    "once",
    "off",
    "addEventListener",
    "removeEventListener",
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

const collectNewInterfaceProperties = (iface: ResolvedAncestor, seen: Set<string>): OwnedProperty[] => {
    const result: OwnedProperty[] = [];

    for (const property of iface.klass.properties) {
        const name = toCamelIdentifier(property.name);

        if (seen.has(name)) {
            continue;
        }

        seen.add(name);
        result.push({ owner: iface.klass, property });
    }

    return result;
};

const collectInterfaceProperties = (context: ModuleContext, klass: GirClass): OwnedProperty[] => {
    const seen = collectSeenPropertyNames(context, klass);
    const result: OwnedProperty[] = [];

    for (const iface of resolveDirectInterfaces(context, klass, context.namespace.name)) {
        result.push(...collectNewInterfaceProperties(iface, seen));
    }

    return result;
};

const recordAncestorSignatures = (
    context: ModuleContext,
    klass: GirClass,
    signatures: Map<string, MethodSignature>,
): void => {
    for (const method of klass.methods) {
        const name = memberName(method.name);

        if (!method.introspectable || signatures.has(name)) {
            continue;
        }

        signatures.set(name, {
            returnType: renderTsType(context, method.returnValue.type, method.returnValue.nullable),
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
    ancestors: Map<string, MethodSignature>,
): string | undefined => {
    if (!method.introspectable) {
        return undefined;
    }

    const name = memberName(method.name);
    const ancestor = ancestors.get(name);

    if (ancestor === undefined) {
        return undefined;
    }

    const returnType = renderTsType(context, method.returnValue.type, method.returnValue.nullable);
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

    return iface.methods
        .map((method) => mergeOmissionName(context, method, ancestors))
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

const collectInterfaceMergeOmissions = (
    context: ModuleContext,
    klass: GirClass,
    iface: { klass: GirClass; namespaceName: string },
): string[] => [
    ...methodMergeOmissions(context, klass, iface.klass),
    ...vfuncMergeOmissions(context, klass, iface),
];

const recordInheritedPropertyType = (
    context: ModuleContext,
    types: Map<string, InheritedAccessorTypes>,
    owner: GirClass,
    property: GirProperty,
): void => {
    const jsName = toCamelIdentifier(property.name);
    const declared = types.get(jsName);

    if (declared?.readType !== undefined && declared.writeType !== undefined) {
        return;
    }

    const accessorTypes = resolveAccessorTypes(context, property, owner.methods);

    if (accessorTypes === undefined) {
        return;
    }

    types.set(jsName, {
        readType: declared?.readType ?? accessorTypes.readType,
        writeType: declared?.writeType ?? accessorTypes.writeType,
    });
};

const collectInheritedPropertyTypes = (
    context: ModuleContext,
    klass: GirClass,
): Map<string, InheritedAccessorTypes> => {
    const types: Map<string, InheritedAccessorTypes> = new Map();

    forEachInheritedProperty(context, klass, (owner, property) => {
        recordInheritedPropertyType(context, types, owner, property);
    });

    return types;
};

const collectInheritedMethods = (context: ModuleContext, klass: GirClass): InheritedMethods => {
    const accumulator: InheritedMethods = {
        returnTypes: new Map<string, string>(),
        definitions: new Map<string, InheritedMethod>(),
    };

    for (const iface of resolveDirectInterfaces(context, klass, context.namespace.name)) {
        absorbInheritedMethods(context, iface, accumulator);
    }

    forEachAncestor(context, klass, (ancestor, interfaces) => {
        absorbInheritedMethods(context, ancestor, accumulator);

        for (const iface of interfaces) {
            absorbInheritedMethods(context, iface, accumulator);
        }
    });

    return accumulator;
};

const absorbInheritedMethods = (
    context: ModuleContext,
    resolved: { klass: GirClass; namespaceName: string },
    accumulator: InheritedMethods,
): void => {
    const { returnTypes, definitions } = accumulator;

    for (const method of resolved.klass.methods) {
        if (!method.introspectable) {
            continue;
        }

        const name = memberName(method.name);

        if (returnTypes.has(name)) {
            continue;
        }

        definitions.set(name, { method, namespaceName: resolved.namespaceName });
        returnTypes.set(name, renderTsType(context, method.returnValue.type, method.returnValue.nullable));
    }
};

const inheritedMatch = (inherited: InheritedMethods, name: string): InheritedMatch | undefined => {
    const inheritedReturn = inherited.returnTypes.get(name);
    const inheritedMethod = inherited.definitions.get(name);

    if (inheritedReturn === undefined || inheritedMethod === undefined) {
        return undefined;
    }

    return { inheritedReturn, inheritedMethod };
};

const hasMethodConflict = (options: {
    context: ModuleContext;
    callable: GirFunction;
    inheritedReturn: string;
    inheritedMethod: InheritedMethod;
}): boolean => {
    const { context, callable, inheritedReturn, inheritedMethod } = options;
    const ownReturn = renderTsType(context, callable.returnValue.type, callable.returnValue.nullable);

    return (
        inheritedReturn !== ownReturn ||
        hasParameterEnumConflict(context, callable, inheritedMethod) ||
        hasParameterTypeConflict(context, callable, inheritedMethod.method)
    );
};

const isCallbackType = (context: ModuleContext, ref: TypeId | undefined): boolean =>
    ref !== undefined && context.library.typeFor(ref)?.kind === "callback";

const areParametersComparable = (context: ModuleContext, pair: ParameterPair): boolean => {
    if (isCallbackType(context, pair.own.type) && isCallbackType(context, pair.inherited.type)) {
        return true;
    }

    const scratch = comparisonContextFor(context);

    return renderTsType(scratch, pair.own.type, false) === renderTsType(scratch, pair.inherited.type, false);
};

const inputParameterPairs = (context: ModuleContext, own: GirFunction, inherited: GirFunction): ParameterPair[] => {
    const ownParams = inputParameters(context.library, own);
    const inheritedParams = inputParameters(context.library, inherited);
    const pairs: ParameterPair[] = [];

    for (const [index, entry] of ownParams.entries()) {
        const other = inheritedParams[index];

        if (other !== undefined) {
            pairs.push({ own: entry.parameter, inherited: other.parameter });
        }
    }

    return pairs;
};

const hasParameterTypeConflict = (context: ModuleContext, own: GirFunction, inherited: GirFunction): boolean => {
    const ownCount = inputParameters(context.library, own).length;

    if (ownCount !== inputParameters(context.library, inherited).length) {
        return true;
    }

    return inputParameterPairs(context, own, inherited).some((pair) => !areParametersComparable(context, pair));
};

const conflictRename = (
    context: ModuleContext,
    callable: GirFunction,
    inherited: InheritedMethods,
    className: string,
): string | undefined => {
    if (!callable.introspectable) {
        return undefined;
    }

    const name = methodExportName(callable);

    if (RESERVED_SIGNAL_MEMBERS.has(name)) {
        return conflictingMethodName(className, callable.name);
    }

    const match = inheritedMatch(inherited, name);

    if (match === undefined) {
        return undefined;
    }

    const hasConflict = hasMethodConflict({ context, callable, ...match });

    return hasConflict ? conflictingMethodName(className, callable.name) : undefined;
};

const conflictingMethodName = (className: string, methodName: string): string =>
    `${lowerFirst(className)}${pascalCase(methodName)}`;

const reservedSignalMemberRename = (className: string, callable: GirFunction): string | undefined =>
    RESERVED_SIGNAL_MEMBERS.has(methodExportName(callable))
        ? conflictingMethodName(className, callable.name)
        : undefined;

const hasEnumConflict = (
    context: ModuleContext,
    ownRef: TypeId | undefined,
    inheritedRef: TypeId | undefined,
): boolean => {
    const ownEnum = enumIdentity(context, ownRef);
    const inheritedEnum = enumIdentity(context, inheritedRef);

    return ownEnum !== undefined && inheritedEnum !== undefined && ownEnum !== inheritedEnum;
};

const hasParameterEnumConflict = (context: ModuleContext, own: GirFunction, inherited: InheritedMethod): boolean =>
    inputParameterPairs(context, own, inherited.method).some(
        (pair) => hasEnumConflict(context, pair.own.type, pair.inherited.type));

const enumIdentity = (context: ModuleContext, ref: TypeId | undefined): string | undefined => {
    if (ref === undefined) {
        return undefined;
    }

    const resolved = context.library.typeFor(ref);

    if (resolved?.kind !== "enum") {
        return undefined;
    }

    return `${resolved.namespace.name}.${resolved.value.name}`;
};

export {
    ancestorClassMethodNames,
    resolvePrerequisiteReference,
    forEachAncestor,
    collectInterfaceProperties,
    collectInterfaceMergeOmissions,
    collectInheritedPropertyTypes,
    collectInheritedMethods,
    conflictRename,
    reservedSignalMemberRename,
    type InheritedMethods,
};
