import { toCamelCase } from "@gtkx/utils";
import type { ModuleContext } from "../dsl/context.js";
import { indent } from "../dsl/emit.js";
import type { GirFunction } from "../gir/function.js";
import { callableReferencesClassStruct } from "./class-struct-record.js";
import { renderFnExpression } from "./function.js";
import { methodExportName, renderMethodBody, renderMethodReturnType, renderMethodSignature } from "./method.js";
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
 * Appends the top-level `const fn = t.fn(...)` binding for a single callable,
 * deduplicated by its C identifier. Used when flattening interface and
 * prerequisite methods onto a type one at a time.
 *
 * @param context - The module context
 * @param method - The callable to bind
 */
export const appendMethodBinding = (context: ModuleContext, method: GirFunction): void => {
    if (method.cIdentifier === undefined) return;
    if (callableReferencesClassStruct(context, method)) return;
    const expression = renderFnExpression(context, method);
    if (expression === undefined) return;
    context.module.appendBinding(`const ${method.cIdentifier} = ${expression};`, method.cIdentifier);
};

/**
 * Appends the top-level `const fn = t.fn(...)` binding for every introspectable
 * callable that has a C identifier and is not shadowed.
 *
 * @param context - The module context
 * @param callables - The callables to bind
 */
export const emitBindings = (context: ModuleContext, callables: Callables): void => {
    const all = [...callables.constructors, ...callables.functions, ...callables.methods];
    for (const callable of all) {
        if (!callable.introspectable) continue;
        if (callable.shadowedBy !== undefined) continue;
        if (callable.cIdentifier === undefined) continue;
        if (callableReferencesClassStruct(context, callable)) continue;
        const expression = renderFnExpression(context, callable);
        if (expression === undefined) continue;
        context.module.appendBinding(`const ${callable.cIdentifier} = ${expression};`, callable.cIdentifier);
    }
};

/**
 * How a type's static `<constructor>` factories wrap their result:
 *
 * - `"gobject"` — resolve the wrapper from the runtime GLib type (a class).
 * - `"interface"` — resolve the runtime type, falling back to the closest
 *   registered ancestor that implements the interface, then the interface itself.
 * - `"boxed"` — wrap as the exact value-type class (boxed records).
 */
export type ConstructorWrap = "gobject" | "interface" | "boxed";

/**
 * Renders a `static <name>(...): Owner` factory method for a GIR `<constructor>`.
 *
 * Returns `undefined` for non-introspectable, shadowed, identifier-less, or
 * `constructor`-named entries.
 *
 * @param context - The module context
 * @param callable - The GIR constructor callable
 * @param ownerClassName - The local class name that wraps the result
 * @param wrap - How the result is lifted to its JavaScript wrapper
 */
const renderConstructorStatic = (
    context: ModuleContext,
    callable: GirFunction,
    ownerClassName: string,
    wrap: ConstructorWrap,
): string | undefined => {
    if (!isEmittableCallable(context, callable)) return undefined;
    const name = constructorMemberName(callable.name);
    if (name === undefined) return undefined;
    const cIdentifier = callable.cIdentifier;
    if (cIdentifier === undefined) return undefined;
    const signature = renderMethodSignature(context, callable);
    const body = renderMethodBody(context, callable, {
        bindingExpression: cIdentifier,
        isStatic: true,
        returnAs: wrap === "gobject" ? { via: "gobject" } : { via: wrap, className: ownerClassName },
    });
    return `static ${name}(${signature}): ${ownerClassName} {\n${indent(body, 1)}\n}`;
};

/**
 * Renders a `static <name>(...): Return` member for a GIR `<function>`.
 *
 * Returns `undefined` when the callable cannot be emitted on a class body.
 *
 * @param context - The module context
 * @param callable - The GIR function callable
 */
const renderStaticMember = (context: ModuleContext, callable: GirFunction): string | undefined => {
    if (!isEmittableCallable(context, callable)) return undefined;
    const cIdentifier = callable.cIdentifier;
    if (cIdentifier === undefined) return undefined;
    const name = toCamelCase(callable.name);
    if (name === "constructor") return undefined;
    const signature = renderMethodSignature(context, callable);
    const returnType = renderMethodReturnType(context, callable);
    const body = renderMethodBody(context, callable, { bindingExpression: cIdentifier, isStatic: true });
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
 * @param context - The module context
 * @param callable - The GIR method callable
 */
export const renderInstanceMethod = (
    context: ModuleContext,
    callable: GirFunction,
    nameOverride?: string,
): string | undefined => {
    if (!isEmittableCallable(context, callable)) return undefined;
    const cIdentifier = callable.cIdentifier;
    if (cIdentifier === undefined) return undefined;
    const name = nameOverride ?? methodExportName(callable);
    if (name === "constructor") return undefined;
    const override = renderRuntimeOverride(callable, name);
    if (override !== undefined) return override;
    const signature = renderMethodSignature(context, callable);
    const returnType = renderMethodReturnType(context, callable);
    const body = renderMethodBody(context, callable, { bindingExpression: cIdentifier, isStatic: false });
    return `${name}(${signature}): ${returnType} {\n${indent(body, 1)}\n}`;
};

/**
 * Renders the legacy-name alias of a method that has been shadowed by a
 * variadic or kebab-cased successor.
 *
 * Returns `undefined` when the alias collides with `constructor` or the
 * shadower lacks a C identifier.
 *
 * @param context - The module context
 * @param original - The shadowed callable whose name should remain reachable
 * @param shadower - The callable the alias dispatches into
 */
const renderInstanceAlias = (
    context: ModuleContext,
    original: GirFunction,
    shadower: GirFunction,
): string | undefined => {
    if (shadower.cIdentifier === undefined) return undefined;
    const aliasName = toCamelCase(original.name);
    if (aliasName === "constructor") return undefined;
    const signature = renderMethodSignature(context, shadower);
    const returnType = renderMethodReturnType(context, shadower);
    const body = renderMethodBody(context, shadower, { bindingExpression: shadower.cIdentifier, isStatic: false });
    return `${aliasName}(${signature}): ${returnType} {\n${indent(body, 1)}\n}`;
};

/**
 * Inputs for {@link appendShadowedAliases}.
 */
export type ShadowedAliasOptions = {
    readonly context: ModuleContext;
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
    const { context, methods, methodByName, members, claimedNames } = options;
    for (const callable of methods) {
        if (callable.shadowedBy === undefined) continue;
        if (callable.introspectable) continue;
        const shadower = methodByName.get(callable.shadowedBy);
        if (shadower === undefined || !shadower.introspectable) continue;
        const aliasName = toCamelCase(callable.name);
        if (claimedNames.has(aliasName)) continue;
        const block = renderInstanceAlias(context, callable, shadower);
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

const isEmittableCallable = (context: ModuleContext, callable: GirFunction): boolean =>
    callable.introspectable &&
    callable.shadowedBy === undefined &&
    callable.cIdentifier !== undefined &&
    !callableReferencesClassStruct(context, callable);

const constructorMemberName = (girName: string): string | undefined => {
    const camel = toCamelCase(girName);
    if (camel === "constructor") return undefined;
    return camel;
};

/**
 * Renders the shared head of a class/interface/boxed body: every `static`
 * constructor factory and every `static` namespace function on the same type.
 *
 * @param context - The module context
 * @param callables - The class's emittable callables
 * @param ownerClassName - The local PascalCase class name
 * @param wrap - How static constructors lift their result to a wrapper
 */
export const renderStaticHead = (
    context: ModuleContext,
    callables: Callables,
    ownerClassName: string,
    wrap: ConstructorWrap,
): readonly string[] => {
    const blocks: string[] = [];
    for (const callable of callables.constructors) {
        const block = renderConstructorStatic(context, callable, ownerClassName, wrap);
        if (block !== undefined) blocks.push(block);
    }
    for (const callable of callables.functions) {
        const block = renderStaticMember(context, callable);
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
const renderPlainInstanceMethods = (
    context: ModuleContext,
    methods: readonly GirFunction[],
    claimedNames: Set<string>,
): readonly string[] => {
    const blocks: string[] = [];
    for (const callable of methods) {
        const block = renderInstanceMethod(context, callable);
        if (block === undefined) continue;
        blocks.push(block);
        claimedNames.add(methodExportName(callable));
    }
    return blocks;
};

/**
 * Inputs for {@link renderPlainTypeMembers}.
 */
export type PlainTypeMembersOptions = {
    readonly context: ModuleContext;
    readonly className: string;
    readonly callables: Callables;
    /** Whether to prepend `declare __gtype__: number;`. */
    readonly hasGType: boolean;
    /** How static constructors lift their result to a wrapper. */
    readonly wrap: ConstructorWrap;
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
export const renderPlainTypeMembers = (
    options: PlainTypeMembersOptions,
): { readonly members: string[]; readonly claimedNames: Set<string> } => {
    const { context, className, callables, hasGType, wrap } = options;
    const members: string[] = [];
    if (hasGType) members.push("declare __gtype__: number;");
    const claimedNames = new Set<string>();
    members.push(...renderStaticHead(context, callables, className, wrap));
    members.push(...renderPlainInstanceMethods(context, callables.methods, claimedNames));
    const methodByName = indexMethodsByName(callables.methods);
    appendShadowedAliases({ context, methods: callables.methods, methodByName, members, claimedNames });
    return { members, claimedNames };
};
