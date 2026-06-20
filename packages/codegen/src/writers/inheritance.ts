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

/**
 * The minimal context the ancestry walkers read: the repository to resolve
 * references against and the namespace unqualified names default to. Satisfied
 * by a full {@link ModuleContext} as well as the bare repository + namespace the
 * React props builder holds.
 */
type AncestryContext = {
    readonly repository: GirRepository;
    readonly namespace: { readonly name: string };
};

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
 * @param context - The repository and default namespace to resolve against
 * @param name - The (possibly cross-namespace) interface name
 * @param defaultNamespace - Namespace assumed for an unqualified `name`
 */
export const resolveImplementedInterface = (
    context: AncestryContext,
    name: string,
    defaultNamespace: string = context.namespace.name,
): ResolvedInterface | undefined => {
    const resolved = context.repository.resolveType(defaultNamespace, name);
    if (resolved === undefined || resolved.kind !== "interface") return undefined;
    return { klass: resolved.value, namespaceName: resolved.namespace.name };
};

/**
 * Resolves every directly-implemented interface of `klass`, dropping entries
 * that do not resolve to an interface.
 *
 * @param context - The repository and default namespace to resolve against
 * @param klass - The implementing class
 * @param defaultNamespace - Namespace assumed for unqualified `<implements>` names
 */
export const resolveDirectInterfaces = (
    context: AncestryContext,
    klass: GirClass,
    defaultNamespace: string,
): readonly ResolvedInterface[] => {
    const interfaces: ResolvedInterface[] = [];
    for (const implementName of klass.implements) {
        const iface = resolveImplementedInterface(context, implementName, defaultNamespace);
        if (iface !== undefined) interfaces.push(iface);
    }
    return interfaces;
};

/**
 * Resolves a `<prerequisite>` entry to the generated type reference it names —
 * the local PascalCase name within the current namespace, or the
 * cross-namespace `<Alias>.<Name>` form. Returns `undefined` when the name
 * does not resolve to an emitted class or interface.
 *
 * @param context - The module context
 * @param name - The (possibly cross-namespace) prerequisite name
 */
export const resolvePrerequisiteReference = (context: ModuleContext, name: string): string | undefined => {
    const resolved = context.repository.resolveType(context.namespace.name, name);
    if (resolved === undefined) return undefined;
    if (resolved.kind !== "interface" && resolved.kind !== "class") return undefined;
    return context.qualify(resolved.namespace.name, toPascalCase(resolved.value.name));
};

/**
 * Invokes `visit` for each ancestor class of `klass`, nearest first.
 *
 * Walks the same-namespace and cross-namespace parent chain, stopping at the
 * first unresolved parent, a cycle, or an ancestor `stop` selects. Each
 * ancestor is reported together with the namespace it was resolved through and
 * its directly-implemented interfaces, so callers need not re-resolve them.
 *
 * @param context - The repository and default namespace to resolve against
 * @param klass - The class whose ancestors to visit
 * @param visit - Callback invoked once per resolved ancestor with its interfaces
 * @param stop - Halts the walk before visiting an ancestor it selects
 */
export const forEachAncestor = (
    context: AncestryContext,
    klass: GirClass,
    visit: (ancestor: ResolvedAncestor, interfaces: readonly ResolvedInterface[]) => void,
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

/**
 * Collects the properties contributed by a class's directly-implemented
 * interfaces that are not already declared on the class itself or inherited
 * from an ancestor (or an ancestor-implemented interface).
 *
 * Each returned property carries its references re-rooted to the interface's
 * namespace so the class writer can emit its accessor and constructor prop
 * as if the property had been authored on the class.
 *
 * @param context - The module context
 * @param klass - The implementing class
 */
export const collectInterfaceProperties = (context: ModuleContext, klass: GirClass): readonly GirProperty[] => {
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

/** An ancestor method together with the namespace its type references resolve against. */
type InheritedMethod = {
    readonly method: GirFunction;
    readonly namespaceName: string;
};

/** The inherited-method analysis a class consults to disambiguate its own overrides. */
export type InheritedMethods = {
    /** camelCase method name → its TypeScript return type, for ancestor class methods. */
    readonly returnTypes: ReadonlyMap<string, string>;
    /** camelCase method name → the nearest ancestor definition it overrides. */
    readonly definitions: ReadonlyMap<string, InheritedMethod>;
    /** camelCase names of every method reachable through ancestors and the interfaces they implement. */
    readonly names: ReadonlySet<string>;
};

/** Mutable accumulator threaded through ancestor traversal. */
type InheritedMethodsAccumulator = {
    readonly returnTypes: Map<string, string>;
    readonly definitions: Map<string, InheritedMethod>;
    readonly names: Set<string>;
};

/**
 * Collects the methods reachable through a class's ancestors and the interfaces
 * they implement, keyed by camelCase name, so the class writer can detect an
 * incompatible override and rename it.
 *
 * @param context - The module context
 * @param klass - The class whose inherited methods to collect
 */
export const collectInheritedMethods = (context: ModuleContext, klass: GirClass): InheritedMethods => {
    const accumulator: InheritedMethodsAccumulator = {
        returnTypes: new Map<string, string>(),
        definitions: new Map<string, InheritedMethod>(),
        names: new Set<string>(),
    };
    forEachAncestor(context, klass, (ancestor, interfaces) => {
        absorbInheritedMethods(context, ancestor, accumulator);
        absorbInheritedInterfaceMethodNames(interfaces, accumulator.names);
    });
    return accumulator;
};

const absorbInheritedMethods = (
    context: ModuleContext,
    resolved: { readonly klass: GirClass; readonly namespaceName: string },
    accumulator: InheritedMethodsAccumulator,
): void => {
    const { returnTypes, definitions, names } = accumulator;
    for (const method of resolved.klass.methods) {
        if (!method.introspectable) continue;
        const name = toCamelCase(method.name);
        names.add(name);
        if (returnTypes.has(name)) continue;
        definitions.set(name, { method, namespaceName: resolved.namespaceName });
        returnTypes.set(name, renderTsType(context, method.returnValue.type, method.returnValue.nullable));
    }
};

const absorbInheritedInterfaceMethodNames = (interfaces: readonly ResolvedInterface[], names: Set<string>): void => {
    for (const iface of interfaces) {
        for (const method of iface.klass.methods) {
            if (!method.introspectable) continue;
            names.add(toCamelCase(method.name));
        }
    }
};

/**
 * The disambiguated name an instance method is emitted under when it collides
 * incompatibly with an inherited method, or `undefined` when no rename applies.
 *
 * A collision is incompatible when the inherited method of the same name has a
 * different return type, a distinct enum at a parameter position, or a
 * different input-parameter arity — each of which would make the override
 * structurally unassignable to its base. The colliding method is renamed so
 * both it and the inherited method stay callable.
 *
 * @param context - The module context
 * @param callable - The instance method declared on the derived class
 * @param inherited - The inherited-method analysis to test the method against
 * @param className - The PascalCase name of the class being emitted
 */
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

/**
 * Whether an override pairs a distinct enum against the inherited method at
 * any input-parameter position.
 *
 * Numeric enums are mutually assignable with `number`, so a `number`/enum
 * pairing is compatible; two *different* enums are not, which would make the
 * derived class structurally unassignable to its base. Such an override is
 * dropped so the inherited signature stands.
 *
 * @param context - The module context
 * @param own - The override declared on the derived class
 * @param inherited - The nearest ancestor definition of the same name
 */
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
