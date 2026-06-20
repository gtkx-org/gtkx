import { toCamelIdentifier } from "@gtkx/utils";
import type { ModuleContext } from "../dsl/context.js";
import type { GirFunction } from "../gir/function.js";
import { type GirParameter, isCallerAllocatedOut, isInoutParameter, isOutParameter } from "../gir/parameter.js";
import type { GirRepository } from "../gir/repository.js";
import type { GirType } from "../gir/type.js";
import type { TypeId } from "../gir/type-id.js";

/**
 * Parameter classification shared across the callable writers: which positions
 * a TypeScript signature exposes, which marshal through a `{ value }` ref cell,
 * which cross the FFI as native handles, and how a parameter is named. Depends
 * only on the GIR model and the module context.
 */

/**
 * A callable input parameter paired with its original GIR position.
 */
export type InputParameter = {
    /** The GIR parameter. */
    readonly parameter: GirParameter;
    /** The parameter's index in the callable's full parameter list. */
    readonly index: number;
};

/**
 * The input parameters a callable's TypeScript signature exposes.
 *
 * Drops `<varargs>` slots, out-only and caller-allocated-out parameters,
 * array-length parameters computed from a sibling array, and the
 * `user_data`/`GDestroyNotify` slots folded into a callback descriptor. Each
 * surviving parameter keeps its original index so callers can recover argument
 * names.
 *
 * @param repository - The GIR repository, to resolve array-length companions
 * @param fn - The callable
 */
export const inputParameters = (repository: GirRepository, fn: GirFunction): readonly InputParameter[] => {
    const lengthIndices = arrayLengthIndices(repository, fn);
    const closureIndices = closureAndDestroyIndices(fn);
    const result: InputParameter[] = [];
    fn.parameters.forEach((parameter, index) => {
        if (parameter.isVarargs) return;
        if (isOutParameter(parameter)) return;
        if (isCallerAllocatedOut(parameter)) return;
        if (lengthIndices.has(index)) return;
        if (closureIndices.has(index)) return;
        result.push({ parameter, index });
    });
    return result;
};

/**
 * Indices of the `gpointer user_data` and `GDestroyNotify` parameters paired
 * to a callback parameter. These slots are folded into the callback's
 * callback descriptor and are not emitted as standalone FFI arguments.
 *
 * @param fn - The callable
 */
export const closureAndDestroyIndices = (fn: GirFunction): ReadonlySet<number> => {
    const indices = new Set<number>();
    for (const parameter of fn.parameters) {
        if (parameter.closureIndex !== undefined) indices.add(parameter.closureIndex);
        if (parameter.destroyIndex !== undefined) indices.add(parameter.destroyIndex);
    }
    return indices;
};

const arrayLengthIndices = (repository: GirRepository, fn: GirFunction): ReadonlySet<number> => {
    const map = arrayLengthSources(repository, fn);
    return new Set(map.keys());
};

/**
 * Maps each array-length parameter's index to the array parameter whose
 * `.length` supplies it.
 *
 * @param repository - The GIR repository, to resolve each parameter's type
 * @param fn - The callable
 */
export const arrayLengthSources = (repository: GirRepository, fn: GirFunction): ReadonlyMap<number, number> => {
    const map = new Map<number, number>();
    fn.parameters.forEach((parameter, index) => {
        const type = parameter.type === undefined ? undefined : repository.typeOf(parameter.type);
        if (type?.kind !== "carray") return;
        const lengthIndex = type.lengthParameterIndex;
        if (lengthIndex === undefined) return;
        map.set(lengthIndex, index);
    });
    return map;
};

/**
 * Indices of parameters consumed as the length of the return array (and so
 * dropped from the return tuple).
 *
 * @param repository - The GIR repository, to resolve the return type
 * @param fn - The callable
 */
export const returnArrayLengthIndices = (repository: GirRepository, fn: GirFunction): ReadonlySet<number> => {
    const returnType = fn.returnValue.type === undefined ? undefined : repository.typeOf(fn.returnValue.type);
    if (returnType?.kind !== "carray") return new Set();
    const lengthIndex = returnType.lengthParameterIndex;
    if (lengthIndex === undefined) return new Set();
    return new Set([lengthIndex]);
};

/**
 * Indices of parameters whose value is an array's element count and so never
 * surface in the return: the `length` companion of any array parameter, plus
 * the `length` companion of the return array. A GObject-Introspection `length`
 * annotation makes the count recoverable from the materialized array's
 * `.length`, so the count parameter folds away — the convention every GI
 * binding follows. Both the rendered return type and the method body exclude
 * these from the out-parameter tuple while still passing the underlying ref
 * cell to the FFI, which the native marshaller reads to size the array.
 *
 * @param repository - The GIR repository, to resolve array types
 * @param fn - The callable
 */
export const foldedLengthIndices = (repository: GirRepository, fn: GirFunction): ReadonlySet<number> => {
    const indices = new Set<number>(arrayLengthSources(repository, fn).keys());
    for (const index of returnArrayLengthIndices(repository, fn)) indices.add(index);
    return indices;
};

/**
 * Whether an out/inout parameter is passed by its existing native handle and
 * mutated in place by the callee — objects, interfaces, and boxed records,
 * which travel as a borrowed pointer, not a pointer-to-pointer cell.
 *
 * The borrowed pointer is what makes the callee's in-place write visible to the
 * caller, so such an argument must marshal as `"borrowed"` regardless of its
 * GIR `transfer-ownership`: a transfer-full copy of the handle (e.g. the
 * `inout` `GValue*` `g_signal_emitv` writes the return into) would discard the
 * write.
 *
 * @param context - The module context
 * @param parameter - The parameter to test
 */
export const passesHandleInPlace = (context: ModuleContext, parameter: GirParameter): boolean => {
    if (parameter.direction !== "out" && parameter.direction !== "inout") return false;
    return (
        (parameter.callerAllocates || parameter.direction === "inout") &&
        parameter.type !== undefined &&
        isHandlePassing(context, parameter.type)
    );
};

const resolveNamedParam = (context: ModuleContext, parameter: GirParameter): GirType | undefined =>
    parameter.type === undefined ? undefined : context.repository.typeOf(parameter.type);

/**
 * Whether a caller-allocated-out parameter is one the body can materialize and
 * collect into the return — a boxed record or class the runtime can allocate
 * via its wrapper constructor. Array and other caller-out buffers cannot be
 * allocated here, so they are excluded from both the body and the return type.
 *
 * @param context - The module context
 * @param parameter - The parameter to test
 */
export const isCollectibleCallerOut = (context: ModuleContext, parameter: GirParameter): boolean => {
    const kind = resolveNamedParam(context, parameter)?.kind;
    return kind === "boxed" || kind === "class";
};

/**
 * Whether a caller-allocated-out parameter is a boxed record specifically — the
 * only caller-out the signal `emit` path can marshal, since it passes the
 * allocated wrapper through `outBoxedFromFfi`, which resolves a boxed `GType`.
 * Class caller-outs ({@link isCollectibleCallerOut} also admits them for the
 * method body) have no boxed `GType` and route to the unsupported-emit throw.
 *
 * @param context - The module context
 * @param parameter - The parameter to test
 */
export const isBoxedCallerOut = (context: ModuleContext, parameter: GirParameter): boolean =>
    resolveNamedParam(context, parameter)?.kind === "boxed";

/**
 * Whether a parameter is a boxed-record inout — `direction="inout"` with a type
 * resolving to a boxed record. The signal `emit` path shares the caller's
 * wrapper in place (`inoutBoxedFromFfi` / `g_value_set_static_boxed`) so a
 * handler's mutation lands on the caller's object, mirroring how the connect
 * side passes the same pointer. GObject/interface handle inouts marshal through
 * `g_value_set_object`, which already preserves identity, so they stay on the
 * plain in-parameter path.
 *
 * @param context - The module context
 * @param parameter - The parameter to test
 */
export const isBoxedInout = (context: ModuleContext, parameter: GirParameter): boolean =>
    isInoutParameter(parameter) && resolveNamedParam(context, parameter)?.kind === "boxed";

/**
 * Whether a value of `ref` is passed across the FFI boundary as a native
 * handle (object, interface, boxed, or an alias to one) instead of by value.
 *
 * @param context - The module context
 * @param ref - The interned type slot to test
 */
export const isHandlePassing = (context: ModuleContext, ref: TypeId): boolean => {
    const type = context.repository.typeOf(ref);
    if (type === undefined) return true;
    switch (type.kind) {
        case "class":
        case "interface":
        case "boxed":
            return true;
        case "alias":
            return type.target !== undefined && isHandlePassing(context, type.target);
        default:
            return false;
    }
};

/**
 * The JavaScript identifier for a parameter: the camelCased GIR name, or
 * `arg<index>` for an unnamed position.
 *
 * @param parameter - The GIR parameter
 * @param index - The parameter's position in the callable
 */
export const parameterIdentifier = (parameter: GirParameter, index: number): string => {
    if (parameter.name.length === 0) return `arg${index}`;
    return toCamelIdentifier(parameter.name);
};

/**
 * Renders a signal's typed parameter list: each non-varargs, non-out parameter
 * as `name: type`, named by {@link parameterIdentifier} and typed by `renderType`
 * after qualification against `namespaceName`. The emitting instance is not a
 * parameter, so it is never included; out- and scalar-inout parameters surface
 * through the result tuple, not the parameter list.
 *
 * The handler signature uses the default (only pure out-parameters dropped), so a
 * handler still receives caller-allocated outs to fill in place. The `emit`
 * argument list passes `isCallerAllocatedOut` as `additionalExclude`, since `emit`
 * allocates those itself and returns them rather than taking them as arguments.
 *
 * @param parameters - The signal's parameters
 * @param renderType - Renders an interned type slot to its TS annotation
 * @param additionalExclude - Extra predicate for parameters to drop from the list
 */
export const renderHandlerParameters = (
    parameters: readonly GirParameter[],
    renderType: (ref: TypeId | undefined, nullable: boolean) => string,
    additionalExclude: (parameter: GirParameter) => boolean = () => false,
): readonly string[] =>
    parameters
        .filter((parameter) => !parameter.isVarargs && !isOutParameter(parameter) && !additionalExclude(parameter))
        .map(
            (parameter, index) =>
                `${parameterIdentifier(parameter, index)}: ${renderType(parameter.type, parameter.nullable)}`,
        );
