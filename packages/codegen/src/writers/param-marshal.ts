import type { ModuleContext } from "../dsl/context.js";
import { type GirParameter, isInoutParameter } from "../gir/parameter.js";
import type { GirType } from "../gir/type.js";
import type { TypeId } from "../gir/type-id.js";

/**
 * Marshalling-policy parameter classification shared across the callable
 * writers: which out/inout parameters travel as native handles mutated in
 * place, which caller-allocated outs the body can collect, and which inouts the
 * signal `emit` path shares by pointer. Resolves each parameter's type through
 * the {@link ModuleContext} — the runtime marshalling category, not GIR shape.
 */

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
