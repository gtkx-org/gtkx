import { toCamelCase, toCamelIdentifier, toLowerFirst, toPascalCase } from "@gtkx/utils";
import type { ModuleContext } from "../dsl/context.js";
import { ancestorChain, type ResolvedAncestor } from "../gir/ancestry.js";
import type { GirClass } from "../gir/class.js";
import type { GirFunction } from "../gir/function.js";
import type { GirProperty } from "../gir/property.js";
import type { GirRepository } from "../gir/repository.js";
import type { TypeId } from "../gir/type-id.js";
import { methodExportName } from "./method.js";
import { inputParameters } from "./param-structure.js";
import { renderTsType } from "./ts-type.js";

type AncestryContext = {
    repository: GirRepository;
    namespace: { name: string };
};

export type ResolvedInterface = {
    klass: GirClass;
    namespaceName: string;
};

export const resolveImplementedInterface = (
    context: AncestryContext,
    name: string,
    defaultNamespace: string = context.namespace.name,
): ResolvedInterface | undefined => {
    const resolved = context.repository.resolveType(defaultNamespace, name);
    if (resolved === undefined || resolved.kind !== "interface") return undefined;
    return { klass: resolved.value, namespaceName: resolved.namespace.name };
};

export const resolveDirectInterfaces = (
    context: AncestryContext,
    klass: GirClass,
    defaultNamespace: string,
): ResolvedInterface[] => {
    const interfaces: ResolvedInterface[] = [];
    for (const implementName of klass.implements) {
        const iface = resolveImplementedInterface(context, implementName, defaultNamespace);
        if (iface !== undefined) interfaces.push(iface);
    }
    return interfaces;
};

export const resolvePrerequisiteReference = (context: ModuleContext, name: string): string | undefined => {
    const resolved = context.repository.resolveType(context.namespace.name, name);
    if (resolved === undefined) return undefined;
    if (resolved.kind !== "interface" && resolved.kind !== "class") return undefined;
    return context.qualify(resolved.namespace.name, toPascalCase(resolved.value.name));
};

export const forEachAncestor = (
    context: AncestryContext,
    klass: GirClass,
    visit: (ancestor: ResolvedAncestor, interfaces: ResolvedInterface[]) => void,
    stop: (ancestor: GirClass) => boolean = () => false,
): void => {
    let first = true;
    for (const ancestor of ancestorChain(context.repository, klass, context.namespace.name)) {
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

type InheritedMethod = {
    method: GirFunction;
    namespaceName: string;
};

export type InheritedMethods = {
    returnTypes: Map<string, string>;
    definitions: Map<string, InheritedMethod>;
};

type InheritedMethodsAccumulator = {
    returnTypes: Map<string, string>;
    definitions: Map<string, InheritedMethod>;
};

export const collectInheritedMethods = (context: ModuleContext, klass: GirClass): InheritedMethods => {
    const accumulator: InheritedMethodsAccumulator = {
        returnTypes: new Map<string, string>(),
        definitions: new Map<string, InheritedMethod>(),
    };
    forEachAncestor(context, klass, (ancestor) => {
        absorbInheritedMethods(context, ancestor, accumulator);
    });
    return accumulator;
};

const absorbInheritedMethods = (
    context: ModuleContext,
    resolved: { klass: GirClass; namespaceName: string },
    accumulator: InheritedMethodsAccumulator,
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

export const conflictRename = (
    context: ModuleContext,
    callable: GirFunction,
    inherited: InheritedMethods,
    className: string,
): string | undefined => {
    if (!callable.introspectable) return undefined;
    const name = methodExportName(callable);
    const inheritedReturn = inherited.returnTypes.get(name);
    const inheritedMethod = inherited.definitions.get(name);
    if (inheritedReturn === undefined || inheritedMethod === undefined) return undefined;
    const ownReturn = renderTsType(context, callable.returnValue.type, callable.returnValue.nullable);
    const conflicts =
        inheritedReturn !== ownReturn ||
        hasParameterEnumConflict(context, callable, inheritedMethod) ||
        inputParameters(context.repository, callable).length !==
            inputParameters(context.repository, inheritedMethod.method).length;
    return conflicts ? conflictingMethodName(className, callable.name) : undefined;
};

const conflictingMethodName = (className: string, methodName: string): string =>
    `${toLowerFirst(className)}${toPascalCase(methodName)}`;

const hasParameterEnumConflict = (context: ModuleContext, own: GirFunction, inherited: InheritedMethod): boolean => {
    const ownParams = inputParameters(context.repository, own);
    const inheritedParams = inputParameters(context.repository, inherited.method);
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
    const resolved = context.repository.typeOf(ref);
    if (resolved?.kind !== "enum") return undefined;
    return `${resolved.namespace.name}.${resolved.value.name}`;
};
