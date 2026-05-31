import { toCamelCase } from "@gtkx/utils";
import type { ModuleContext } from "../dsl/context.js";
import { indent } from "../dsl/emit.js";
import type { GirFunction } from "../gir/function.js";
import { callableReferencesClassStruct } from "./class-struct-record.js";
import { writeFnExpression } from "./function.js";
import { methodExportName, writeMethodBody, writeMethodReturnType, writeMethodSignature } from "./method.js";
import { renderRuntimeOverride } from "./runtime-override.js";

/**
 * Constructors, static functions, and instance methods of a class, interface,
 * or boxed record.
 */
export type Callables = {
    readonly constructors: readonly GirFunction[];
    readonly functions: readonly GirFunction[];
    readonly methods: readonly GirFunction[];
};

/**
 * Drops callables that lack a `c:identifier` or repeat one already retained.
 *
 * GIR sometimes lists the same callable twice (e.g. as both a class function
 * and a constructor); the C identifier is the canonical key.
 *
 * @param callables - The raw GIR callables
 */
export const dedupeCallables = (callables: readonly GirFunction[]): readonly GirFunction[] => {
    const seen = new Set<string>();
    const result: GirFunction[] = [];
    for (const callable of callables) {
        if (callable.cIdentifier === undefined) continue;
        if (seen.has(callable.cIdentifier)) continue;
        seen.add(callable.cIdentifier);
        result.push(callable);
    }
    return result;
};

/**
 * Appends the top-level `const fn = t.fn(...)` binding for every introspectable
 * callable that has a C identifier and is not shadowed.
 *
 * @param ctx - The module context
 * @param callables - The callables to bind
 */
/**
 * Appends the top-level `const fn = t.fn(...)` binding for a single callable,
 * deduplicated by its C identifier. Used when flattening interface and
 * prerequisite methods onto a type one at a time.
 *
 * @param ctx - The module context
 * @param method - The callable to bind
 */
export const appendMethodBinding = (ctx: ModuleContext, method: GirFunction): void => {
    if (method.cIdentifier === undefined) return;
    if (callableReferencesClassStruct(ctx, method)) return;
    const expression = writeFnExpression(ctx, method);
    if (expression === undefined) return;
    ctx.module.appendBinding(`const ${method.cIdentifier} = ${expression};`, method.cIdentifier);
};

export const emitBindings = (ctx: ModuleContext, callables: Callables): void => {
    const all = [...callables.constructors, ...callables.functions, ...callables.methods];
    for (const callable of all) {
        if (!callable.introspectable) continue;
        if (callable.shadowedBy !== undefined) continue;
        if (callable.cIdentifier === undefined) continue;
        if (callableReferencesClassStruct(ctx, callable)) continue;
        const expression = writeFnExpression(ctx, callable);
        if (expression === undefined) continue;
        ctx.module.appendBinding(`const ${callable.cIdentifier} = ${expression};`, callable.cIdentifier);
    }
};

/**
 * Renders a `static <name>(...): Owner` factory method for a GIR `<constructor>`.
 *
 * Returns `undefined` for non-introspectable, shadowed, identifier-less, or
 * `constructor`-named entries.
 *
 * @param ctx - The module context
 * @param callable - The GIR constructor callable
 * @param ownerClassName - The local class name that wraps the result
 */
export const renderConstructorStatic = (
    ctx: ModuleContext,
    callable: GirFunction,
    ownerClassName: string,
): string | undefined => {
    if (!isEmittableCallable(ctx, callable)) return undefined;
    const name = constructorMemberName(callable.name);
    if (name === undefined) return undefined;
    const cIdentifier = callable.cIdentifier;
    if (cIdentifier === undefined) return undefined;
    const signature = writeMethodSignature(ctx, callable);
    const body = writeMethodBody(ctx, callable, { bindingExpression: cIdentifier, isStatic: true });
    return `static ${name}(${signature}): ${ownerClassName} {\n${indent(body, 1)}\n}`;
};

/**
 * Renders a `static <name>(...): Return` member for a GIR `<function>`.
 *
 * Returns `undefined` when the callable cannot be emitted on a class body.
 *
 * @param ctx - The module context
 * @param callable - The GIR function callable
 */
export const renderStaticMember = (ctx: ModuleContext, callable: GirFunction): string | undefined => {
    if (!isEmittableCallable(ctx, callable)) return undefined;
    const cIdentifier = callable.cIdentifier;
    if (cIdentifier === undefined) return undefined;
    const name = toCamelCase(callable.name);
    if (name === "constructor") return undefined;
    const signature = writeMethodSignature(ctx, callable);
    const returnType = writeMethodReturnType(ctx, callable);
    const body = writeMethodBody(ctx, callable, { bindingExpression: cIdentifier, isStatic: true });
    return `static ${name}(${signature}): ${returnType} {\n${indent(body, 1)}\n}`;
};

/**
 * Renders an instance method body for a GIR `<method>`.
 *
 * Hand-written runtime overrides (e.g. `g_value_get_boxed`) short-circuit the
 * usual FFI call body with a throwing stub that the runtime replaces on the
 * prototype at module load.
 *
 * Returns `undefined` for non-emittable callables.
 *
 * @param ctx - The module context
 * @param callable - The GIR method callable
 */
export const renderInstanceMethod = (ctx: ModuleContext, callable: GirFunction): string | undefined => {
    if (!isEmittableCallable(ctx, callable)) return undefined;
    const cIdentifier = callable.cIdentifier;
    if (cIdentifier === undefined) return undefined;
    const name = methodExportName(callable);
    if (name === "constructor") return undefined;
    const override = renderRuntimeOverride(callable, name);
    if (override !== undefined) return override;
    const signature = writeMethodSignature(ctx, callable);
    const returnType = writeMethodReturnType(ctx, callable);
    const body = writeMethodBody(ctx, callable, { bindingExpression: cIdentifier, isStatic: false });
    return `${name}(${signature}): ${returnType} {\n${indent(body, 1)}\n}`;
};

/**
 * Renders the legacy-name alias of a method that has been shadowed by a
 * variadic or kebab-cased successor.
 *
 * Returns `undefined` when the alias collides with `constructor` or the
 * shadower lacks a C identifier.
 *
 * @param ctx - The module context
 * @param original - The shadowed callable whose name should remain reachable
 * @param shadower - The callable the alias dispatches into
 */
export const renderInstanceAlias = (
    ctx: ModuleContext,
    original: GirFunction,
    shadower: GirFunction,
): string | undefined => {
    if (shadower.cIdentifier === undefined) return undefined;
    const aliasName = toCamelCase(original.name);
    if (aliasName === "constructor") return undefined;
    const signature = writeMethodSignature(ctx, shadower);
    const returnType = writeMethodReturnType(ctx, shadower);
    const body = writeMethodBody(ctx, shadower, { bindingExpression: shadower.cIdentifier, isStatic: false });
    return `${aliasName}(${signature}): ${returnType} {\n${indent(body, 1)}\n}`;
};

/**
 * Inputs for {@link appendShadowedAliases}.
 */
export type ShadowedAliasOptions = {
    readonly ctx: ModuleContext;
    /** The full list of method callables. */
    readonly methods: readonly GirFunction[];
    /** Lookup table for shadower resolution. */
    readonly methodByName: ReadonlyMap<string, GirFunction>;
    /** The accumulating members list to append to. */
    readonly members: string[];
    /** Set of names already emitted on the class body. */
    readonly claimedNames: Set<string>;
};

/**
 * Appends shadowed-method aliases for every callable in `methods` whose
 * shadower is introspectable.
 *
 * Records each emitted alias name in `claimedNames` so subsequent renderers
 * can detect collisions.
 *
 * @param options - {@link ShadowedAliasOptions}
 */
export const appendShadowedAliases = (options: ShadowedAliasOptions): void => {
    const { ctx, methods, methodByName, members, claimedNames } = options;
    for (const callable of methods) {
        if (callable.shadowedBy === undefined) continue;
        if (callable.introspectable) continue;
        const shadower = methodByName.get(callable.shadowedBy);
        if (shadower === undefined || !shadower.introspectable) continue;
        const aliasName = toCamelCase(callable.name);
        if (claimedNames.has(aliasName)) continue;
        const block = renderInstanceAlias(ctx, callable, shadower);
        if (block !== undefined) {
            members.push(block);
            claimedNames.add(aliasName);
        }
    }
};

/**
 * Indexes a list of method callables by their GIR name for shadower lookup.
 */
export const indexMethodsByName = (methods: readonly GirFunction[]): ReadonlyMap<string, GirFunction> => {
    const map = new Map<string, GirFunction>();
    for (const callable of methods) map.set(callable.name, callable);
    return map;
};

const isEmittableCallable = (ctx: ModuleContext, callable: GirFunction): boolean =>
    callable.introspectable &&
    callable.shadowedBy === undefined &&
    callable.cIdentifier !== undefined &&
    !callableReferencesClassStruct(ctx, callable);

const constructorMemberName = (girName: string): string | undefined => {
    const camel = toCamelCase(girName);
    if (camel === "constructor") return undefined;
    return camel;
};

/**
 * Renders the shared head of a class/interface/boxed body: every `static`
 * constructor factory and every `static` namespace function on the same type.
 *
 * @param ctx - The module context
 * @param callables - The class's emittable callables
 * @param ownerClassName - The local PascalCase class name
 */
export const renderStaticHead = (
    ctx: ModuleContext,
    callables: Callables,
    ownerClassName: string,
): readonly string[] => {
    const blocks: string[] = [];
    for (const callable of callables.constructors) {
        const block = renderConstructorStatic(ctx, callable, ownerClassName);
        if (block !== undefined) blocks.push(block);
    }
    for (const callable of callables.functions) {
        const block = renderStaticMember(ctx, callable);
        if (block !== undefined) blocks.push(block);
    }
    return blocks;
};

/**
 * Renders the plain instance methods of a class/interface/boxed body, the
 * variant that does NOT consult inherited-signature conflicts. Used for
 * interfaces and boxed records that do not extend other widget shapes.
 *
 * Records each emitted method name in `claimedNames` so subsequent property
 * and signal-method renderers can detect collisions.
 */
export const renderPlainInstanceMethods = (
    ctx: ModuleContext,
    methods: readonly GirFunction[],
    claimedNames: Set<string>,
): readonly string[] => {
    const blocks: string[] = [];
    for (const callable of methods) {
        const block = renderInstanceMethod(ctx, callable);
        if (block === undefined) continue;
        blocks.push(block);
        claimedNames.add(methodExportName(callable));
    }
    return blocks;
};

/**
 * Inputs for {@link buildPlainTypeMembers}.
 */
export type PlainTypeMembersOptions = {
    readonly ctx: ModuleContext;
    readonly className: string;
    readonly callables: Callables;
    /** Whether to prepend `declare __gtype__: number;`. */
    readonly hasGType: boolean;
};

/**
 * Renders the shared head of an interface or boxed class body — `__gtype__`
 * declaration (optional), statics, plain instance methods, and
 * shadowed-method aliases — plus the `claimedNames` set populated by those
 * renderers.
 *
 * Callers append the constructor, property accessors, field accessors, and
 * signal members on top of the returned members list. The class writer takes
 * a different path because it has to consult inherited signatures.
 */
export const buildPlainTypeMembers = (
    options: PlainTypeMembersOptions,
): { readonly members: string[]; readonly claimedNames: Set<string> } => {
    const { ctx, className, callables, hasGType } = options;
    const members: string[] = [];
    if (hasGType) members.push("declare __gtype__: number;");
    const claimedNames = new Set<string>();
    members.push(...renderStaticHead(ctx, callables, className));
    members.push(...renderPlainInstanceMethods(ctx, callables.methods, claimedNames));
    const methodByName = indexMethodsByName(callables.methods);
    appendShadowedAliases({ ctx, methods: callables.methods, methodByName, members, claimedNames });
    return { members, claimedNames };
};
