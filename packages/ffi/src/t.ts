/**
 * The call convention generated bindings dispatch through, exposed as `t.fn`:
 * a thin sugar over `t.bind` that adds out-parameter tupling, `GError` handling,
 * and result wrapping.
 *
 * {@link fn} resolves the callable's native argument types once — wrapping each
 * runtime-allocated out- or inout-parameter in a `ref` and appending the
 * implicit `GError**` slot when the callable throws — and binds them through
 * `t.bind`, which owns the reused native argument array and the `call` dispatch.
 * Each invocation maps its inputs to the native values `bind` expects — a fresh
 * `{ value }` cell for a runtime-allocated out- or inout-parameter, the handle
 * for a caller-allocated wrapper, the value itself otherwise — runs
 * {@link checkError} when the callable throws, then tuples the wrapped primary
 * return with the surfaced out-values read back from those same cells. A
 * caller-allocated out surfaces the wrapper it was passed, unchanged; every
 * other surfaced value is lifted through {@link wrapValue} under its FFI `type`.
 */

import * as helpers from "./descriptors.js";
import { fn } from "./fn.js";

/**
 * The binding factory the generated `@gtkx/gi` bindings and their override
 * templates call: every FFI type-descriptor helper, plus `fn` — the sugared
 * binder ({@link fn}) that adds out-parameter tupling, `GError` handling, and
 * result wrapping over the native `call`.
 *
 * This is the `t` the package barrel exports. The raw binder the runtime's own
 * type-system and `GValue` marshalling use stays internal and is never surfaced
 * here, so binding code outside the runtime only ever reaches the sugared `t.fn`.
 */

/**
 * The raw `bind` binder plus the FFI type-descriptor helpers: every descriptor
 * constant and factory used to build the `Arg` and return descriptors that
 * bindings pass to `bind` (and, once the sugared layer adds it, to `t.fn`).
 *
 * Keeps hand-written and generated bindings compact and free of inline
 * type-descriptor object literals.
 *
 * @example
 * ```tsx
 * const labelArg = { type: t.string("borrowed") };
 * const surfaceReturn = t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2");
 * ```
 */
/**
 * Shape of the {@link t} namespace: the raw `bind` binder plus every FFI
 * type-descriptor constant and factory used to build `Arg` and return
 * descriptors for hand-written and generated bindings.
 */
type T = {
    readonly bind: typeof helpers.bind;
    readonly int8: typeof helpers.int8T;
    readonly uint8: typeof helpers.uint8T;
    readonly int16: typeof helpers.int16T;
    readonly uint16: typeof helpers.uint16T;
    readonly int32: typeof helpers.int32T;
    readonly uint32: typeof helpers.uint32T;
    readonly int64: typeof helpers.int64T;
    readonly uint64: typeof helpers.uint64T;
    readonly bigint64: typeof helpers.bigint64T;
    readonly biguint64: typeof helpers.biguint64T;
    readonly float32: typeof helpers.float32T;
    readonly float64: typeof helpers.float64T;
    readonly boolean: typeof helpers.booleanT;
    readonly void: typeof helpers.voidT;
    readonly unichar: typeof helpers.unicharT;
    readonly blob: typeof helpers.blobT;
    readonly string: typeof helpers.stringT;
    readonly object: typeof helpers.objectT;
    readonly boxed: typeof helpers.boxedT;
    readonly struct: typeof helpers.structT;
    readonly fundamental: typeof helpers.fundamentalT;
    readonly ref: typeof helpers.refT;
    readonly hashTable: typeof helpers.hashTableT;
    readonly enum: typeof helpers.enumT;
    readonly flags: typeof helpers.flagsT;
    readonly array: typeof helpers.arrayT;
    readonly list: typeof helpers.listT;
    readonly slist: typeof helpers.slistT;
    readonly ptrArray: typeof helpers.ptrArrayT;
    readonly garray: typeof helpers.garrayT;
    readonly byteArray: typeof helpers.byteArrayT;
    readonly sizedArray: typeof helpers.sizedArrayT;
    readonly fixedArray: typeof helpers.fixedArrayT;
    readonly callback: typeof helpers.callbackT;
    readonly fn: typeof fn;
};

export const t: T = {
    bind: helpers.bind,
    int8: helpers.int8T,
    uint8: helpers.uint8T,
    int16: helpers.int16T,
    uint16: helpers.uint16T,
    int32: helpers.int32T,
    uint32: helpers.uint32T,
    int64: helpers.int64T,
    uint64: helpers.uint64T,
    bigint64: helpers.bigint64T,
    biguint64: helpers.biguint64T,
    float32: helpers.float32T,
    float64: helpers.float64T,
    boolean: helpers.booleanT,
    void: helpers.voidT,
    unichar: helpers.unicharT,
    blob: helpers.blobT,
    string: helpers.stringT,
    object: helpers.objectT,
    boxed: helpers.boxedT,
    struct: helpers.structT,
    fundamental: helpers.fundamentalT,
    ref: helpers.refT,
    hashTable: helpers.hashTableT,
    enum: helpers.enumT,
    flags: helpers.flagsT,
    array: helpers.arrayT,
    list: helpers.listT,
    slist: helpers.slistT,
    ptrArray: helpers.ptrArrayT,
    garray: helpers.garrayT,
    byteArray: helpers.byteArrayT,
    sizedArray: helpers.sizedArrayT,
    fixedArray: helpers.fixedArrayT,
    callback: helpers.callbackT,
    fn,
} as const;
