import { camelCase, lowerFirst, pascalCase, toCamelIdentifier } from "@gtkx/utils";
import type { GirClass } from "../gir/class.js";
import type { GirFunction } from "../gir/function.js";
import type { Library } from "../gir/library.js";
import type { GirProperty } from "../gir/property.js";
import type { TypeId } from "../gir/type-id.js";
import type { ModuleContext } from "../writer/context.js";
import { ancestorChain, type ResolvedAncestor, resolveInterfaces } from "../gir/ancestry.js";
import { methodExportName } from "../store/gi/method.js";
import { resolveAccessorType } from "../store/gi/property-accessor.js";
import { vfuncMemberNames } from "../store/gi/vtable.js";
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

    return context.qualify(resolved.namespace.name, pascalCase(resolved.value.name));
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

const forEachInheritedProperty = (
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

const collectSeenPropertyNames = (context: ModuleContext, klass: GirClass): Set<string> => {
    const seen: Set<string> = new Set();

    for (const property of klass.properties) {
        seen.add(toCamelIdentifier(property.name));
    }

    forEachInheritedProperty(context, klass, (_owner, property) => seen.add(toCamelIdentifier(property.name)));

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
        const name = camelCase(method.name);

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

const mergeOmissionName = (
    context: ModuleContext,
    method: GirFunction,
    ancestors: Map<string, MethodSignature>,
): string | undefined => {
    if (!method.introspectable) {
        return undefined;
    }

    const name = camelCase(method.name);
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

const collectInheritedPropertyTypes = (context: ModuleContext, klass: GirClass): Map<string, string> => {
    const types: Map<string, string> = new Map();

    const record = (owner: GirClass, property: GirProperty): void => {
        const jsName = toCamelIdentifier(property.name);

        if (types.has(jsName)) {
            return;
        }

        const tsType = resolveAccessorType(context, property, owner.methods);

        if (tsType !== undefined) {
            types.set(jsName, tsType);
        }
    };

    forEachInheritedProperty(context, klass, record);

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

        const name = camelCase(method.name);

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
        inputParameters(context.library, callable).length !==
        inputParameters(context.library, inheritedMethod.method).length
    );
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

const hasParameterEnumConflict = (context: ModuleContext, own: GirFunction, inherited: InheritedMethod): boolean => {
    const ownParams = inputParameters(context.library, own);
    const inheritedParams = inputParameters(context.library, inherited.method);
    const count = Math.min(ownParams.length, inheritedParams.length);

    for (let index = 0; index < count; index += 1) {
        const ownParam = ownParams[index];
        const inheritedParam = inheritedParams[index];

        if (
            ownParam !== undefined &&
            inheritedParam !== undefined &&
            hasEnumConflict(context, ownParam.parameter.type, inheritedParam.parameter.type)
        ) {
            return true;
        }
    }

    return false;
};

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
