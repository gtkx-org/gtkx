import { lowerFirst, toCamelCase, toCamelIdentifier, toPascalCase } from "@gtkx/utils";
import { ancestorChain, type ResolvedAncestor, resolveInterface } from "../gir/ancestry.js";
import type { GirClass } from "../gir/class.js";
import type { GirFunction } from "../gir/function.js";
import type { Library } from "../gir/library.js";
import type { GirProperty } from "../gir/property.js";
import type { TypeId } from "../gir/type-id.js";
import { methodExportName } from "../store/gi/method.js";
import { resolveAccessorType } from "../store/gi/property-accessor.js";
import type { ModuleContext } from "../writer/context.js";
import { inputParameters } from "./param-structure.js";
import { renderTsType } from "./ts-type.js";

type AncestryContext = {
    library: Library;
    namespace: { name: string };
};

export const resolveImplementedInterface = (
    context: AncestryContext,
    name: string,
    defaultNamespace: string = context.namespace.name,
): ResolvedAncestor | undefined => resolveInterface(context.library, defaultNamespace, name);

const resolveDirectInterfaces = (
    context: AncestryContext,
    klass: GirClass,
    defaultNamespace: string,
): ResolvedAncestor[] => {
    const interfaces: ResolvedAncestor[] = [];
    for (const implementName of klass.implements) {
        const iface = resolveImplementedInterface(context, implementName, defaultNamespace);
        if (iface !== undefined) interfaces.push(iface);
    }
    return interfaces;
};

export const resolvePrerequisiteReference = (context: ModuleContext, name: string): string | undefined => {
    const resolved = context.library.resolveType(context.namespace.name, name);
    if (resolved === undefined) return undefined;
    if (resolved.kind !== "interface" && resolved.kind !== "class") return undefined;
    return context.qualify(resolved.namespace.name, toPascalCase(resolved.value.name));
};

export const forEachAncestor = (
    context: AncestryContext,
    klass: GirClass,
    visit: (ancestor: ResolvedAncestor, interfaces: ResolvedAncestor[]) => void,
    stop: (ancestor: GirClass) => boolean = () => false,
): void => {
    let first = true;
    for (const ancestor of ancestorChain(context.library, klass, context.namespace.name)) {
        if (first) {
            first = false;
            continue;
        }
        if (stop(ancestor.klass)) break;
        visit(ancestor, resolveDirectInterfaces(context, ancestor.klass, ancestor.namespaceName));
    }
};

export const collectInterfaceProperties = (context: ModuleContext, klass: GirClass): GirProperty[] => {
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

type MethodSignature = { returnType: string; arity: number };

const ancestorClassMethodSignatures = (context: ModuleContext, klass: GirClass): Map<string, MethodSignature> => {
    const signatures = new Map<string, MethodSignature>();
    forEachAncestor(context, klass, (ancestor) => {
        for (const method of ancestor.klass.methods) {
            if (!method.introspectable) continue;
            const name = toCamelCase(method.name);
            if (signatures.has(name)) continue;
            signatures.set(name, {
                returnType: renderTsType(context, method.returnValue.type, method.returnValue.nullable),
                arity: inputParameters(context.library, method).length,
            });
        }
    });
    return signatures;
};

export const collectInterfaceMergeOmissions = (
    context: ModuleContext,
    klass: GirClass,
    iface: { klass: GirClass; namespaceName: string },
): string[] => {
    const ancestors = ancestorClassMethodSignatures(context, klass);
    const omissions: string[] = [];
    for (const method of iface.klass.methods) {
        if (!method.introspectable) continue;
        const name = toCamelCase(method.name);
        const ancestor = ancestors.get(name);
        if (ancestor === undefined) continue;
        const returnType = renderTsType(context, method.returnValue.type, method.returnValue.nullable);
        const arity = inputParameters(context.library, method).length;
        if (ancestor.returnType !== returnType || ancestor.arity !== arity) omissions.push(name);
    }
    return omissions;
};

export const collectInheritedPropertyTypes = (context: ModuleContext, klass: GirClass): Map<string, string> => {
    const types = new Map<string, string>();
    const record = (owner: GirClass, property: GirProperty): void => {
        const jsName = toCamelIdentifier(property.name);
        if (types.has(jsName)) return;
        const tsType = resolveAccessorType(context, property, owner.methods);
        if (tsType !== undefined) types.set(jsName, tsType);
    };
    forEachAncestor(context, klass, (ancestor, interfaces) => {
        for (const property of ancestor.klass.properties) record(ancestor.klass, property);
        for (const iface of interfaces) {
            for (const property of iface.klass.properties) record(iface.klass, property);
        }
    });
    return types;
};

type InheritedMethod = {
    method: GirFunction;
    namespaceName: string;
};

export type InheritedMethods = {
    returnTypes: Map<string, string>;
    definitions: Map<string, InheritedMethod>;
};

export const collectInheritedMethods = (context: ModuleContext, klass: GirClass): InheritedMethods => {
    const accumulator: InheritedMethods = {
        returnTypes: new Map<string, string>(),
        definitions: new Map<string, InheritedMethod>(),
    };
    for (const iface of resolveDirectInterfaces(context, klass, context.namespace.name)) {
        absorbInheritedMethods(context, iface, accumulator);
    }
    forEachAncestor(context, klass, (ancestor, interfaces) => {
        absorbInheritedMethods(context, ancestor, accumulator);
        for (const iface of interfaces) absorbInheritedMethods(context, iface, accumulator);
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
        if (!method.introspectable) continue;
        const name = toCamelCase(method.name);
        if (returnTypes.has(name)) continue;
        definitions.set(name, { method, namespaceName: resolved.namespaceName });
        returnTypes.set(name, renderTsType(context, method.returnValue.type, method.returnValue.nullable));
    }
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

export const conflictRename = (
    context: ModuleContext,
    callable: GirFunction,
    inherited: InheritedMethods,
    className: string,
): string | undefined => {
    if (!callable.introspectable) return undefined;
    const name = methodExportName(callable);
    if (RESERVED_SIGNAL_MEMBERS.has(name)) return conflictingMethodName(className, callable.name);
    const inheritedReturn = inherited.returnTypes.get(name);
    const inheritedMethod = inherited.definitions.get(name);
    if (inheritedReturn === undefined || inheritedMethod === undefined) return undefined;
    const ownReturn = renderTsType(context, callable.returnValue.type, callable.returnValue.nullable);
    const conflicts =
        inheritedReturn !== ownReturn ||
        hasParameterEnumConflict(context, callable, inheritedMethod) ||
        inputParameters(context.library, callable).length !==
            inputParameters(context.library, inheritedMethod.method).length;
    return conflicts ? conflictingMethodName(className, callable.name) : undefined;
};

const conflictingMethodName = (className: string, methodName: string): string =>
    `${lowerFirst(className)}${toPascalCase(methodName)}`;

export const reservedSignalMemberRename = (className: string, callable: GirFunction): string | undefined =>
    RESERVED_SIGNAL_MEMBERS.has(methodExportName(callable))
        ? conflictingMethodName(className, callable.name)
        : undefined;

const hasParameterEnumConflict = (context: ModuleContext, own: GirFunction, inherited: InheritedMethod): boolean => {
    const ownParams = inputParameters(context.library, own);
    const inheritedParams = inputParameters(context.library, inherited.method);
    const count = Math.min(ownParams.length, inheritedParams.length);
    for (let index = 0; index < count; index += 1) {
        const ownParam = ownParams[index];
        const inheritedParam = inheritedParams[index];
        if (ownParam === undefined || inheritedParam === undefined) continue;
        const ownEnum = enumIdentity(context, ownParam.parameter.type);
        const inheritedEnum = enumIdentity(context, inheritedParam.parameter.type);
        if (ownEnum !== undefined && inheritedEnum !== undefined && ownEnum !== inheritedEnum) return true;
    }
    return false;
};

const enumIdentity = (context: ModuleContext, ref: TypeId | undefined): string | undefined => {
    if (ref === undefined) return undefined;
    const resolved = context.library.typeOf(ref);
    if (resolved?.kind !== "enum") return undefined;
    return `${resolved.namespace.name}.${resolved.value.name}`;
};
