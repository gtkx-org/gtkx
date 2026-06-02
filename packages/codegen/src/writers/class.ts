import { toCamelCase, toPascalCase } from "@gtkx/utils";
import type { ModuleContext } from "../dsl/context.js";
import { indent } from "../dsl/emit.js";
import type { GirClass } from "../gir/class.js";
import type { GirFunction } from "../gir/function.js";
import { splitQualifiedName } from "../gir/qualified-name.js";
import { qualifyFunction, qualifyTypeRef } from "../gir/qualify.js";
import type { GirTypeRef } from "../gir/type-ref.js";
import { matchAsyncFinishName } from "./async.js";
import {
    appendMethodBinding,
    appendShadowedAliases,
    type Callables,
    dedupeCallables,
    emitBindings,
    indexMethodsByName,
    renderInstanceMethod,
    renderStaticHead,
} from "./callables.js";
import { renderVfuncMetadata } from "./class-struct.js";
import { renderClassConstructor, renderConstructorPropsInterface } from "./constructor-props.js";
import { renderGetTypeReference } from "./gtype-binding.js";
import { collectInterfaceProperties, forEachAncestor, resolveImplementedInterface } from "./inheritance.js";
import { methodExportName, renderPromisifiedBody, renderPromisifiedSignature } from "./method.js";
import { inputParameters } from "./param-classify.js";
import { renderPropertyAccessor } from "./property-accessor.js";
import { appendNativeClassRegistration } from "./registration.js";
import { renderRuntimeOverride } from "./runtime-override.js";
import { renderSignalMembers } from "./signal.js";
import { renderTsType } from "./ts-type.js";

/**
 * Emits a full class declaration for a `<class>` element.
 *
 * Walks the class's constructors, static functions, and methods, emitting
 * each as a JS method body on the class declaration plus a hoisted `const`
 * binding for the corresponding FFI symbol. Properties and signals are
 * surfaced by their own writers; this function owns the class shape and
 * the GType / class-struct registration calls.
 *
 * @param context - The module context
 * @param klass - The class to emit
 */
export const emitClass = (context: ModuleContext, klass: GirClass): void => {
    if (!klass.introspectable) return;
    if (klass.name.length === 0) return;
    const className = toPascalCase(klass.name);
    const callables: Callables = {
        constructors: dedupeCallables(klass.constructors),
        functions: dedupeCallables(klass.functions),
        methods: dedupeCallables(klass.methods),
    };
    emitBindings(context, callables);

    const parentExpression = resolveParent(context, klass);
    const extendsClause = parentExpression === undefined ? "" : ` extends ${parentExpression}`;
    const members = renderClassMembers(context, klass, callables, parentExpression !== undefined);
    const body = members.map((member) => indent(member, 1)).join("\n\n");
    context.module.appendDeclaration(`export class ${className}${extendsClause} {\n${body}\n}`);
    context.module.appendDeclaration(renderConstructorPropsInterface(context, klass, className));

    const interfaceRefs = klass.implements
        .map((name) => resolveImplementsReference(context, name))
        .filter((entry): entry is string => entry !== undefined);
    if (interfaceRefs.length > 0) {
        context.module.appendDeclaration(`export interface ${className} extends ${interfaceRefs.join(", ")} {}`);
    }

    appendClassRegistrations(context, klass, className);
};

const renderClassMembers = (
    context: ModuleContext,
    klass: GirClass,
    callables: Callables,
    hasParent: boolean,
): readonly string[] => {
    const className = toPascalCase(klass.name);
    const members: string[] = ["declare __gtype__: number;"];
    const constructorBlock = renderClassConstructor(context, klass, className, hasParent);
    if (constructorBlock !== undefined) members.push(constructorBlock);
    const claimedNames = new Set<string>();
    members.push(...renderStaticHead(context, callables, className, "gobject"));
    const inherited = collectInheritedMethods(context, klass);
    const methodByName = indexMethodsByName(callables.methods);
    appendInstanceMethods({
        context,
        methods: callables.methods,
        methodByName,
        inherited,
        members,
        claimedNames,
        className,
    });
    appendShadowedAliases({ context, methods: callables.methods, methodByName, members, claimedNames });
    appendFlattenedInterfaceMethods({ context, klass, inheritedNames: inherited.names, members, claimedNames });
    for (const property of klass.properties) {
        const block = renderPropertyAccessor(context, property, claimedNames, methodByName);
        if (block !== undefined) members.push(block);
    }
    for (const property of collectInterfaceProperties(context, klass)) {
        const block = renderPropertyAccessor(context, property, claimedNames, methodByName);
        if (block !== undefined) members.push(block);
    }
    members.push(...renderSignalMembers(context, klass));
    return members;
};

type AppendInstanceMethodsOptions = {
    readonly context: ModuleContext;
    readonly methods: readonly GirFunction[];
    readonly methodByName: ReadonlyMap<string, GirFunction>;
    readonly inherited: InheritedMethods;
    readonly members: string[];
    readonly claimedNames: Set<string>;
    readonly className: string;
};

const appendInstanceMethods = (options: AppendInstanceMethodsOptions): void => {
    const { context, methods, methodByName, inherited, members, claimedNames, className } = options;
    for (const callable of methods) {
        const rename = conflictRename(context, callable, inherited, className);
        const block = renderClassInstanceMember(context, callable, methodByName, rename);
        if (block === undefined) continue;
        members.push(block);
        claimedNames.add(rename ?? methodExportName(callable));
    }
};

/**
 * The disambiguated name a colliding instance method is emitted under:
 * `<lowerClassName><MethodName>` (e.g. `iconViewSetCursor`).
 */
const conflictingMethodName = (className: string, methodName: string): string => {
    const camel = toCamelCase(className);
    return `${camel.charAt(0).toLowerCase()}${camel.slice(1)}${toPascalCase(methodName)}`;
};

type AppendFlattenedInterfaceMethodsOptions = {
    readonly context: ModuleContext;
    readonly klass: GirClass;
    readonly inheritedNames: ReadonlySet<string>;
    readonly members: string[];
    readonly claimedNames: Set<string>;
};

/**
 * Copies every interface method onto the implementing class.
 *
 * GObject interfaces are structural at the C level: a class that implements
 * `Gdk.Paintable` can be passed to `gdk_paintable_snapshot`, but the JS
 * wrapper only exposes that method if codegen emits it. Each implemented
 * interface's methods are re-rooted to the interface's namespace, bound
 * against the implementing class's shared library (the loader resolves the
 * symbol through that library's dependency graph), and emitted as direct
 * instance members. Names already provided by the class itself or inherited
 * from an ancestor (or an ancestor-implemented interface) are skipped so the
 * most-derived definition wins and no member is declared twice.
 *
 * @param options - {@link AppendFlattenedInterfaceMethodsOptions}
 */
const appendFlattenedInterfaceMethods = (options: AppendFlattenedInterfaceMethodsOptions): void => {
    const { context, klass, inheritedNames, members, claimedNames } = options;
    for (const implementName of klass.implements) {
        const iface = resolveImplementedInterface(context, implementName);
        if (iface === undefined) continue;
        const methods = dedupeCallables(iface.klass.methods).map((method) =>
            qualifyFunction(method, iface.namespaceName),
        );
        const methodByName = indexMethodsByName(methods);
        for (const method of methods) {
            const name = methodExportName(method);
            if (name === "constructor") continue;
            if (claimedNames.has(name) || inheritedNames.has(name)) continue;
            const block = renderClassInstanceMember(context, method, methodByName);
            if (block === undefined) continue;
            appendMethodBinding(context, method);
            members.push(block);
            claimedNames.add(name);
        }
    }
};

const appendClassRegistrations = (context: ModuleContext, klass: GirClass, className: string): void => {
    const getTypeRef =
        klass.glibGetType === undefined
            ? undefined
            : renderGetTypeReference(context, klass.glibGetType, klass.glibTypeName);
    appendNativeClassRegistration(context, {
        className,
        role: "class",
        getTypeRef,
        vfuncs: renderVfuncMetadata(context, klass),
    });
};

const renderClassInstanceMember = (
    context: ModuleContext,
    callable: GirFunction,
    siblings: ReadonlyMap<string, GirFunction>,
    nameOverride?: string,
): string | undefined => {
    if (!callable.introspectable || callable.shadowedBy !== undefined || callable.cIdentifier === undefined) {
        return undefined;
    }
    const name = nameOverride ?? methodExportName(callable);
    if (name === "constructor") return undefined;
    const override = renderRuntimeOverride(callable, name);
    if (override !== undefined) return override;
    const promisified = renderPromisifiedMember(context, callable, siblings, name);
    if (promisified !== undefined) return promisified;
    return renderInstanceMethod(context, callable, nameOverride);
};

const renderPromisifiedMember = (
    context: ModuleContext,
    callable: GirFunction,
    siblings: ReadonlyMap<string, GirFunction>,
    name: string,
): string | undefined => {
    const finishName = matchAsyncFinishName(callable, [...siblings.values()]);
    if (finishName === undefined) return undefined;
    const finishFn = siblings.get(finishName);
    if (finishFn === undefined) return undefined;
    const cIdentifier = callable.cIdentifier;
    if (cIdentifier === undefined) return undefined;
    const { signature, returnType } = renderPromisifiedSignature(context, callable, finishFn);
    const finishMember = methodExportName(finishFn);
    const body = renderPromisifiedBody(context, callable, finishMember, cIdentifier);
    return `${name}(${signature}): ${returnType} {\n${indent(body, 1)}\n}`;
};

const resolveImplementsReference = (context: ModuleContext, name: string): string | undefined => {
    const { namespaceName, typeName } = splitQualifiedName(name, context.namespace.name);
    const resolved = context.repository.resolveNamed(namespaceName, typeName);
    if (resolved === undefined || resolved.kind !== "interface") return undefined;
    if (namespaceName === context.namespace.name) return toPascalCase(typeName);
    const alias = context.addCrossNamespaceImport(namespaceName);
    return `${alias}.${toPascalCase(typeName)}`;
};

/** An ancestor method together with the namespace its type references resolve against. */
type InheritedMethod = {
    readonly method: GirFunction;
    readonly namespaceName: string;
};

type InheritedMethods = {
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

const collectInheritedMethods = (context: ModuleContext, klass: GirClass): InheritedMethods => {
    const accumulator: InheritedMethodsAccumulator = {
        returnTypes: new Map<string, string>(),
        definitions: new Map<string, InheritedMethod>(),
        names: new Set<string>(),
    };
    forEachAncestor(context, klass, (ancestor) => {
        absorbInheritedMethods(context, ancestor, accumulator);
        absorbInheritedInterfaceMethodNames(context, ancestor, accumulator.names);
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
        const qualifiedType = qualifyTypeRef(method.returnValue.type, resolved.namespaceName);
        returnTypes.set(name, renderTsType(context, qualifiedType, method.returnValue.nullable));
    }
};

const absorbInheritedInterfaceMethodNames = (
    context: ModuleContext,
    ancestor: { readonly klass: GirClass; readonly namespaceName: string },
    names: Set<string>,
): void => {
    for (const implementName of ancestor.klass.implements) {
        const iface = resolveImplementedInterface(context, implementName, ancestor.namespaceName);
        if (iface === undefined) continue;
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
 */
const conflictRename = (
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
        inputParameters(callable).length !== inputParameters(inheritedMethod.method).length;
    return conflicts ? conflictingMethodName(className, callable.name) : undefined;
};

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
    const ownParams = inputParameters(own);
    const inheritedParams = inputParameters(inherited.method);
    const count = Math.min(ownParams.length, inheritedParams.length);
    for (let index = 0; index < count; index += 1) {
        const ownParam = ownParams[index];
        const inheritedParam = inheritedParams[index];
        if (ownParam === undefined || inheritedParam === undefined) continue;
        const ownEnum = enumIdentity(context, ownParam.parameter.type, context.namespace.name);
        const inheritedEnum = enumIdentity(context, inheritedParam.parameter.type, inherited.namespaceName);
        if (ownEnum !== undefined && inheritedEnum !== undefined && ownEnum !== inheritedEnum) return true;
    }
    return false;
};

const enumIdentity = (
    context: ModuleContext,
    ref: GirTypeRef | undefined,
    defaultNamespace: string,
): string | undefined => {
    const qualified = qualifyTypeRef(ref, defaultNamespace);
    if (qualified === undefined || qualified.kind !== "named") return undefined;
    const resolved = context.repository.resolveNamed(qualified.namespaceName ?? defaultNamespace, qualified.typeName);
    if (resolved === undefined || resolved.kind !== "enum") return undefined;
    return `${resolved.namespace.name}.${resolved.value.name}`;
};

const resolveParent = (context: ModuleContext, klass: GirClass): string | undefined => {
    if (klass.parent === undefined) return undefined;
    const { namespaceName, typeName } = splitQualifiedName(klass.parent, context.namespace.name);
    if (namespaceName === context.namespace.name) return toPascalCase(typeName);
    const alias = context.addCrossNamespaceImport(namespaceName);
    return `${alias}.${toPascalCase(typeName)}`;
};
