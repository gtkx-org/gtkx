import type { ModuleContext } from "../dsl/context.js";
import { indent } from "../dsl/emit.js";
import { camelCaseMember, pascalCase } from "../dsl/identifier.js";
import type { GirClass } from "../gir/class.js";
import type { GirFunction } from "../gir/function.js";
import { splitQualifiedName } from "../gir/qualified-name.js";
import { qualifyFunction, qualifyTypeRef } from "../gir/qualify.js";
import { matchAsyncFinishName } from "./async.js";
import {
    appendMethodBinding,
    appendShadowedAliases,
    type Callables,
    constructorMember,
    dedupeCallables,
    emitBindings,
    indexMethodsByName,
    renderInstanceMethod,
    renderStaticHead,
} from "./callables.js";
import { emitClassStruct } from "./class-struct.js";
import { emitClassConstructionMeta } from "./construction-meta.js";
import { renderGetTypeCall } from "./gtype-binding.js";
import { collectInterfaceProperties, forEachAncestor, resolveImplementedInterface } from "./inheritance.js";
import { methodExportName, writePromisifiedBody, writePromisifiedSignature } from "./method.js";
import { renderPropertyAccessor } from "./property-accessor.js";
import { renderRuntimeOverride } from "./runtime-override.js";
import { renderSignalMembers } from "./signal.js";
import { writeTsType } from "./types-ts.js";

type InterfaceRef = {
    readonly typeExpression: string;
    readonly runtimeExpression: string;
};

/**
 * Emits a full class declaration for a `<class>` element.
 *
 * Walks the class's constructors, static functions, and methods, emitting
 * each as a JS method body on the class declaration plus a hoisted `const`
 * binding for the corresponding FFI symbol. Properties and signals are
 * surfaced by their own writers; this function owns the class shape and
 * the GType / class-struct registration calls.
 *
 * @param ctx - The module context
 * @param klass - The class to emit
 */
export const emitClass = (ctx: ModuleContext, klass: GirClass): void => {
    if (!klass.introspectable) return;
    if (klass.name.length === 0) return;
    ctx.addConstructNativeObjectImport();
    const className = pascalCase(klass.name);
    const callables: Callables = {
        constructors: dedupeCallables(klass.constructors),
        functions: dedupeCallables(klass.functions),
        methods: dedupeCallables(klass.methods),
    };
    emitBindings(ctx, callables);

    const parentExpression = resolveParent(ctx, klass);
    const extendsClause = parentExpression === undefined ? "" : ` extends ${parentExpression}`;
    const members = buildClassMembers(ctx, klass, callables, parentExpression !== undefined);
    const body = members.map((member) => indent(member, 1)).join("\n\n");
    ctx.module.appendDeclaration(`export class ${className}${extendsClause} {\n${body}\n}`);

    const interfaceRefs = klass.implements
        .map((name) => resolveImplementsReference(ctx, name))
        .filter((entry): entry is InterfaceRef => entry !== undefined);
    if (interfaceRefs.length > 0) {
        const extendsList = interfaceRefs.map((ref) => ref.typeExpression).join(", ");
        ctx.module.appendDeclaration(`export interface ${className} extends ${extendsList} {}`);
    }

    appendClassRegistrations(ctx, klass, className, interfaceRefs);
};

const buildClassMembers = (
    ctx: ModuleContext,
    klass: GirClass,
    callables: Callables,
    hasParent: boolean,
): readonly string[] => {
    const className = pascalCase(klass.name);
    const members: string[] = ["declare __gtype__: number;"];
    if (!hasParent) members.push(constructorMember());
    const claimedNames = new Set<string>();
    members.push(...renderStaticHead(ctx, callables, className));
    const inherited = collectInheritedMethods(ctx, klass);
    const methodByName = indexMethodsByName(callables.methods);
    appendInstanceMethods({
        ctx,
        methods: callables.methods,
        methodByName,
        inheritedReturnTypes: inherited.returnTypes,
        members,
        claimedNames,
    });
    appendShadowedAliases({ ctx, methods: callables.methods, methodByName, members, claimedNames });
    appendFlattenedInterfaceMethods({ ctx, klass, inheritedNames: inherited.names, members, claimedNames });
    for (const property of klass.properties) {
        const block = renderPropertyAccessor(ctx, property, claimedNames);
        if (block !== undefined) members.push(block);
    }
    for (const property of collectInterfaceProperties(ctx, klass)) {
        const block = renderPropertyAccessor(ctx, property, claimedNames);
        if (block !== undefined) members.push(block);
    }
    members.push(...renderSignalMembers(ctx, klass));
    return members;
};

type AppendInstanceMethodsOptions = {
    readonly ctx: ModuleContext;
    readonly methods: readonly GirFunction[];
    readonly methodByName: ReadonlyMap<string, GirFunction>;
    readonly inheritedReturnTypes: ReadonlyMap<string, string>;
    readonly members: string[];
    readonly claimedNames: Set<string>;
};

const appendInstanceMethods = (options: AppendInstanceMethodsOptions): void => {
    const { ctx, methods, methodByName, inheritedReturnTypes, members, claimedNames } = options;
    for (const callable of methods) {
        if (conflictsWithInherited(ctx, callable, inheritedReturnTypes)) continue;
        const block = renderClassInstanceMember(ctx, callable, methodByName);
        if (block === undefined) continue;
        members.push(block);
        claimedNames.add(methodExportName(callable));
    }
};

type AppendFlattenedInterfaceMethodsOptions = {
    readonly ctx: ModuleContext;
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
    const { ctx, klass, inheritedNames, members, claimedNames } = options;
    for (const implementName of klass.implements) {
        const iface = resolveImplementedInterface(ctx, implementName);
        if (iface === undefined) continue;
        const methods = dedupeCallables(iface.klass.methods).map((method) =>
            qualifyFunction(method, iface.namespaceName),
        );
        const methodByName = indexMethodsByName(methods);
        for (const method of methods) {
            const name = methodExportName(method);
            if (name === "constructor") continue;
            if (claimedNames.has(name) || inheritedNames.has(name)) continue;
            const block = renderClassInstanceMember(ctx, method, methodByName);
            if (block === undefined) continue;
            appendMethodBinding(ctx, method);
            members.push(block);
            claimedNames.add(name);
        }
    }
};

const appendClassRegistrations = (
    ctx: ModuleContext,
    klass: GirClass,
    className: string,
    interfaceRefs: readonly InterfaceRef[],
): void => {
    if (klass.glibGetType !== undefined) {
        const gtypeCall = renderGetTypeCall(ctx, klass.glibGetType, klass.glibTypeName);
        if (gtypeCall !== undefined) {
            ctx.addRuntimeImport("registerNativeClass");
            ctx.module.appendRegistration(`${className}.prototype.__gtype__ = 0;`);
            ctx.module.appendRegistration(`registerNativeClass(${className}, ${gtypeCall});`);
            emitClassConstructionMeta(ctx, klass);
        }
    }
    if (klass.glibTypeStruct !== undefined) {
        emitClassStruct(ctx, klass);
    }
    void interfaceRefs;
};

const renderClassInstanceMember = (
    ctx: ModuleContext,
    callable: GirFunction,
    siblings: ReadonlyMap<string, GirFunction>,
): string | undefined => {
    if (!callable.introspectable || callable.shadowedBy !== undefined || callable.cIdentifier === undefined) {
        return undefined;
    }
    const name = methodExportName(callable);
    if (name === "constructor") return undefined;
    const override = renderRuntimeOverride(callable, name);
    if (override !== undefined) return override;
    const promisified = renderPromisifiedMember(ctx, callable, siblings, name);
    if (promisified !== undefined) return promisified;
    return renderInstanceMethod(ctx, callable);
};

const renderPromisifiedMember = (
    ctx: ModuleContext,
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
    const { signature, returnType } = writePromisifiedSignature(ctx, callable, finishFn);
    const finishMember = methodExportName(finishFn);
    const body = writePromisifiedBody(ctx, callable, finishMember, cIdentifier);
    return `${name}(${signature}): ${returnType} {\n${indent(body, 1)}\n}`;
};

const resolveImplementsReference = (ctx: ModuleContext, name: string): InterfaceRef | undefined => {
    const { namespaceName, typeName } = splitQualifiedName(name, ctx.namespace.name);
    const resolved = ctx.repository.resolveNamed(namespaceName, typeName);
    if (resolved === undefined || resolved.kind !== "interface") return undefined;
    if (namespaceName === ctx.namespace.name) {
        const local = pascalCase(typeName);
        return { typeExpression: local, runtimeExpression: local };
    }
    const alias = ctx.addCrossNamespaceImport(namespaceName);
    const qualified = `${alias}.${pascalCase(typeName)}`;
    return { typeExpression: qualified, runtimeExpression: qualified };
};

type InheritedMethods = {
    /** camelCase method name → its TypeScript return type, for ancestor class methods. */
    readonly returnTypes: ReadonlyMap<string, string>;
    /** camelCase names of every method reachable through ancestors and the interfaces they implement. */
    readonly names: ReadonlySet<string>;
};

const collectInheritedMethods = (ctx: ModuleContext, klass: GirClass): InheritedMethods => {
    const returnTypes = new Map<string, string>();
    const names = new Set<string>();
    forEachAncestor(ctx, klass, (ancestor) => {
        absorbInheritedMethods(ctx, ancestor, returnTypes, names);
        absorbInheritedInterfaceMethodNames(ctx, ancestor, names);
    });
    return { returnTypes, names };
};

const absorbInheritedMethods = (
    ctx: ModuleContext,
    resolved: { readonly klass: GirClass; readonly namespaceName: string },
    returnTypes: Map<string, string>,
    names: Set<string>,
): void => {
    for (const method of resolved.klass.methods) {
        if (!method.introspectable) continue;
        const name = camelCaseMember(method.name);
        names.add(name);
        if (returnTypes.has(name)) continue;
        const qualifiedType = qualifyTypeRef(method.returnValue.type, resolved.namespaceName);
        returnTypes.set(name, writeTsType(ctx, qualifiedType, method.returnValue.nullable));
    }
};

const absorbInheritedInterfaceMethodNames = (
    ctx: ModuleContext,
    ancestor: { readonly klass: GirClass; readonly namespaceName: string },
    names: Set<string>,
): void => {
    for (const implementName of ancestor.klass.implements) {
        const iface = resolveImplementedInterface(ctx, implementName, ancestor.namespaceName);
        if (iface === undefined) continue;
        for (const method of iface.klass.methods) {
            if (!method.introspectable) continue;
            names.add(camelCaseMember(method.name));
        }
    }
};

const conflictsWithInherited = (
    ctx: ModuleContext,
    callable: GirFunction,
    inheritedReturnTypes: ReadonlyMap<string, string>,
): boolean => {
    if (!callable.introspectable) return false;
    const name = methodExportName(callable);
    const inheritedReturn = inheritedReturnTypes.get(name);
    if (inheritedReturn === undefined) return false;
    const ownReturn = writeTsType(ctx, callable.returnValue.type, callable.returnValue.nullable);
    return inheritedReturn !== ownReturn;
};

const resolveParent = (ctx: ModuleContext, klass: GirClass): string | undefined => {
    if (klass.parent === undefined) return undefined;
    const { namespaceName, typeName } = splitQualifiedName(klass.parent, ctx.namespace.name);
    if (namespaceName === ctx.namespace.name) return pascalCase(typeName);
    const alias = ctx.addCrossNamespaceImport(namespaceName);
    return `${alias}.${pascalCase(typeName)}`;
};
