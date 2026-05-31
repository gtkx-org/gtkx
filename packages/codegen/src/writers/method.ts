import { toCamelCase, toIdentifier } from "@gtkx/utils";
import type { ModuleContext } from "../dsl/context.js";
import type { GirFunction } from "../gir/function.js";
import {
    type GirParameter,
    isCallerAllocatedOut,
    isInoutParameter,
    isOutParameter,
    type ParameterTransfer,
} from "../gir/parameter.js";
import { qualifyTypeRef } from "../gir/qualify.js";
import type { ResolvedNamed } from "../gir/repository.js";
import type { GirTypeRef, NamedTypeRef, PrimitiveTypeRef } from "../gir/type-ref.js";
import { writeTsType } from "./types-ts.js";
import { isCellInout, type ResolvedCallback, resolveCallbackType } from "./value.js";

/**
 * Returns the camelCased JS export name for a callable's method or static.
 *
 * @param fn - The callable
 */
export const methodExportName = (fn: GirFunction): string => toCamelCase(fn.name);

/**
 * Renders the TypeScript parameter list for a callable.
 *
 * Drops out-only parameters, `<varargs>` slots, and array-length
 * parameters whose value is computed from a sibling array's `.length`.
 * Names follow `toCamelCase` of the GIR name, falling back to
 * `arg<index>` for unnamed positions.
 *
 * @param ctx - The module context
 * @param fn - The callable
 */
export const writeMethodSignature = (ctx: ModuleContext, fn: GirFunction): string =>
    renderInputParameters(
        ctx,
        fn,
        () => false,
        () => false,
    );

const renderInputParameters = (
    ctx: ModuleContext,
    fn: GirFunction,
    skip: (parameter: GirParameter) => boolean,
    isOptionalExtra: (parameter: GirParameter) => boolean,
): string => {
    const parts: string[] = [];
    for (const { parameter, index } of inputParameters(fn)) {
        if (skip(parameter)) continue;
        const name = parameterIdentifier(parameter, index);
        const optional = parameter.nullable || parameter.optional || isOptionalExtra(parameter);
        const annotation = writeTsType(ctx, parameter.type, parameter.nullable);
        parts.push(optional ? `${name}?: ${annotation}` : `${name}: ${annotation}`);
    }
    return parts.join(", ");
};

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
 * `user_data`/`GDestroyNotify` slots folded into a callback descriptor —
 * the same positions {@link writeMethodSignature} omits. Each surviving
 * parameter keeps its original index so callers can recover argument names.
 *
 * @param fn - The callable
 */
export const inputParameters = (fn: GirFunction): readonly InputParameter[] => {
    const lengthIndices = arrayLengthIndices(fn);
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
 * trampoline descriptor and are not emitted as standalone FFI arguments.
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

const arrayLengthIndices = (fn: GirFunction): ReadonlySet<number> => {
    const map = arrayLengthSources(fn);
    return new Set(map.keys());
};

const arrayLengthSources = (fn: GirFunction): ReadonlyMap<number, number> => {
    const map = new Map<number, number>();
    fn.parameters.forEach((parameter, index) => {
        if (parameter.type?.kind !== "array") return;
        const lengthIndex = parameter.type.lengthParameterIndex;
        if (lengthIndex === undefined) return;
        map.set(lengthIndex, index);
    });
    return map;
};

/**
 * Renders the TypeScript return-type annotation for a callable.
 *
 * Multi-out callables tuple the primary return with each out-parameter
 * (`[primary, ...outs]`); when the primary return is void the tuple
 * starts at the first out-parameter.
 *
 * @param ctx - The module context
 * @param fn - The callable
 */
export const writeMethodReturnType = (ctx: ModuleContext, fn: GirFunction): string => {
    const consumedByReturn = returnArrayLengthIndices(fn);
    const outs = fn.parameters.filter(
        (p, index) =>
            (isOutParameter(p) || isCallerAllocatedOut(p) || isInoutParameter(p)) && !consumedByReturn.has(index),
    );
    const primaryReturnsValue = !isVoidReturn(fn);
    if (outs.length === 0) {
        return primaryReturnsValue ? writeTsType(ctx, fn.returnValue.type, fn.returnValue.nullable) : "void";
    }
    const outTypes = outs.map((parameter) => writeTsType(ctx, parameter.type, false));
    if (!primaryReturnsValue) {
        return outTypes.length === 1 ? `${outTypes[0]}` : `[${outTypes.join(", ")}]`;
    }
    const primary = writeTsType(ctx, fn.returnValue.type, fn.returnValue.nullable);
    return `[${primary}, ${outTypes.join(", ")}]`;
};

const returnArrayLengthIndices = (fn: GirFunction): ReadonlySet<number> => {
    if (fn.returnValue.type?.kind !== "array") return new Set();
    const lengthIndex = fn.returnValue.type.lengthParameterIndex;
    if (lengthIndex === undefined) return new Set();
    return new Set([lengthIndex]);
};

const isVoidReturn = (fn: GirFunction): boolean => {
    const ref = fn.returnValue.type;
    if (ref === undefined) return true;
    return ref.kind === "primitive" && ref.category === "void";
};

/**
 * Optional override for the wrapper produced for the primary return value.
 *
 * Constructors use this to force the result to be wrapped as the owning
 * class even when the GIR `<return-value>` is typed as a parent class.
 */
export type ReturnOverride = {
    /** Local class identifier to pass as the second argument of `getNativeObject`. */
    readonly className: string;
    /** Kind of wrapping helper to use. */
    readonly via: "class" | "interface";
};

/**
 * Renders the JS body of a promisified `*_async` method that delegates to
 * the runtime's `promisify` helper.
 *
 * The method's leading FFI args (everything before the `GCancellable*`
 * slot) and the cancellable parameter are extracted from the GIR `*_async`
 * signature; the trailing `GAsyncReadyCallback` slot is filled by
 * `promisify`. The `*_finish` companion is bound from the same class via
 * `this[finishName].bind(this)`.
 *
 * @param ctx - The module context
 * @param asyncFn - The `*_async` callable
 * @param finishMember - The camelCase JS name of the companion `*_finish` method
 * @param bindingExpression - Expression that evaluates to the bound async `t.fn` callable
 */
export const writePromisifiedBody = (
    ctx: ModuleContext,
    asyncFn: GirFunction,
    finishMember: string,
    bindingExpression: string,
): string => {
    ctx.addRuntimeImport("promisify");
    const cancellableIndex = findCancellableIndex(asyncFn.parameters);
    const closureIndices = closureAndDestroyIndices(asyncFn);
    const lengthFor = arrayLengthSources(asyncFn);
    const leadingExpressions: string[] = [];
    if (asyncFn.instance !== undefined) {
        ctx.addRuntimeImport("getHandle");
        leadingExpressions.push("getHandle(this)");
    }
    let cancellableExpression = "null";
    asyncFn.parameters.forEach((parameter, index) => {
        if (parameter.isVarargs) return;
        if (index === cancellableIndex) {
            cancellableExpression = parameterIdentifier(parameter, index);
            return;
        }
        if (isCallbackParameter(ctx, parameter)) return;
        if (closureIndices.has(index)) return;
        const sourceIndex = lengthFor.get(index);
        if (sourceIndex !== undefined) {
            const source = asyncFn.parameters[sourceIndex];
            if (source !== undefined) {
                leadingExpressions.push(`${parameterIdentifier(source, sourceIndex)}.length`);
                return;
            }
        }
        leadingExpressions.push(parameterCallExpression(ctx, parameter, index));
    });
    const leadingLiteral = `[${leadingExpressions.join(", ")}]`;
    return `return promisify(${bindingExpression}, this.${finishMember}.bind(this), ${cancellableExpression}, { leading: ${leadingLiteral} });`;
};

const findCancellableIndex = (parameters: readonly GirParameter[]): number => {
    for (let index = 0; index < parameters.length; index += 1) {
        const parameter = parameters[index];
        if (parameter === undefined) continue;
        if (parameter.type?.kind !== "named") continue;
        if (parameter.type.typeName === "Cancellable") return index;
    }
    return -1;
};

/**
 * Renders the TypeScript signature for a promisified `*_async` method.
 *
 * The signature drops the trailing `GAsyncReadyCallback` and `gpointer
 * user_data` slots, marks the cancellable optional, and returns a
 * `Promise` wrapping the finish method's return type.
 *
 * @param ctx - The module context
 * @param asyncFn - The `*_async` callable
 * @param finishFn - The companion `*_finish` callable
 */
export const writePromisifiedSignature = (
    ctx: ModuleContext,
    asyncFn: GirFunction,
    finishFn: GirFunction,
): { readonly signature: string; readonly returnType: string } => {
    const signature = renderInputParameters(
        ctx,
        asyncFn,
        (parameter) => isCallbackParameter(ctx, parameter),
        isCancellable,
    );
    const finishReturn = writeMethodReturnType(ctx, finishFn);
    return { signature, returnType: `Promise<${finishReturn}>` };
};

const isCancellable = (parameter: GirParameter): boolean =>
    parameter.type?.kind === "named" && parameter.type.typeName === "Cancellable";

const isCallbackParameter = (ctx: ModuleContext, parameter: GirParameter): boolean => {
    const ref = parameter.type;
    if (ref === undefined) return false;
    if (ref.kind === "callback") return true;
    if (ref.kind !== "named") return false;
    const namespaceName = ref.namespaceName ?? ctx.namespace.name;
    const resolved = ctx.repository.resolveNamed(namespaceName, ref.typeName);
    return resolved !== undefined && resolved.kind === "callback";
};

/**
 * Renders the JS body of a method or static that dispatches `binding(...)`
 * and returns the appropriately wrapped result.
 *
 * Handles instance vs. static dispatch, optional handle coercion on
 * inbound named-type parameters, out-parameter ref construction with
 * tuple return, `GError` ref + `checkError`, and return-value wrapping
 * via `getNativeObject` / `getNativeObjectAsInterface` for object and
 * boxed results.
 *
 * @param ctx - The module context
 * @param fn - The callable
 * @param bindingExpression - Expression that evaluates to the bound `t.fn` callable
 * @param isStatic - `true` for static methods, constructors, or namespace functions
 * @param returnAs - Optional override for the primary return wrapping class
 */
type OutRef = {
    readonly name: string;
    readonly type: GirTypeRef | undefined;
    readonly nullable: boolean;
    readonly raw?: boolean;
};

type BodyBuilder = {
    readonly callArgs: string[];
    readonly setup: string[];
    readonly outRefs: OutRef[];
};

export type WriteMethodBodyOptions = {
    /** Bound `t.fn` callable expression to invoke. */
    readonly bindingExpression: string;
    /** True for static methods, constructors, or namespace functions. */
    readonly isStatic: boolean;
    /** Optional override for the primary return wrapping class. */
    readonly returnAs?: ReturnOverride;
};

export const writeMethodBody = (ctx: ModuleContext, fn: GirFunction, options: WriteMethodBodyOptions): string => {
    const { bindingExpression, isStatic, returnAs } = options;
    const builder: BodyBuilder = { callArgs: [], setup: [], outRefs: [] };
    if (!isStatic && fn.instance !== undefined) {
        ctx.addRuntimeImport("getHandle");
        builder.callArgs.push("getHandle(this)");
    }
    collectParameterArgs(ctx, fn, builder);
    const errorRef = appendErrorRef(fn, builder);
    const callExpression = `${bindingExpression}(${builder.callArgs.join(", ")})`;
    const lines: string[] = [...builder.setup];
    const returnsValue = !isVoidReturn(fn);
    lines.push(returnsValue ? `const __result = ${callExpression};` : `${callExpression};`);
    if (errorRef !== undefined) {
        ctx.addRuntimeImport("checkError");
        lines.push(`checkError(${errorRef}, ${errorClassReference(ctx)});`);
    }
    const primary = returnsValue ? wrapPrimary(ctx, fn, "__result", returnAs) : undefined;
    appendReturn(ctx, lines, primary, builder.outRefs);
    return lines.join("\n");
};

const collectParameterArgs = (ctx: ModuleContext, fn: GirFunction, builder: BodyBuilder): void => {
    const lengthFor = arrayLengthSources(fn);
    const closureIndices = closureAndDestroyIndices(fn);
    const returnLengthIndices = returnArrayLengthIndices(fn);
    fn.parameters.forEach((parameter, index) => {
        if (parameter.isVarargs) return;
        if (isOutParameter(parameter)) {
            appendOutRef({ ctx, parameter, index, returnLengthIndices, builder });
            return;
        }
        if (isCallerAllocatedOut(parameter)) {
            appendCallerAllocatedOut(ctx, parameter, builder);
            return;
        }
        if (isInoutParameter(parameter)) {
            appendInoutParameter({ ctx, parameter, index, returnLengthIndices, builder });
            return;
        }
        const sourceIndex = lengthFor.get(index);
        if (sourceIndex !== undefined) {
            const source = fn.parameters[sourceIndex];
            if (source !== undefined) {
                builder.callArgs.push(`${parameterIdentifier(source, sourceIndex)}.length`);
                return;
            }
        }
        if (closureIndices.has(index)) {
            return;
        }
        builder.callArgs.push(parameterCallExpression(ctx, parameter, index));
    });
};

type AppendOutRefOptions = {
    readonly ctx: ModuleContext;
    readonly parameter: GirParameter;
    readonly index: number;
    readonly returnLengthIndices: ReadonlySet<number>;
    readonly builder: BodyBuilder;
};

const appendOutRef = (options: AppendOutRefOptions): void => {
    const { ctx, parameter, builder } = options;
    const refName = `out${builder.outRefs.length}`;
    builder.setup.push(`const ${refName} = { value: ${outRefInitial(ctx, parameter.type)} };`);
    registerRefArg(options, refName);
};

/**
 * The initial value seeded into a pure-out `{ value }` ref cell.
 *
 * The native marshaller encodes the cell's current value against the ref's
 * inner FFI type before the call, so the seed must be assignable to that
 * type: numeric and pointer cells seed `0`, booleans `false`, strings `""`,
 * and object/boxed cells `null`.
 */
const outRefInitial = (ctx: ModuleContext, ref: GirTypeRef | undefined): string => {
    if (ref === undefined) return "null";
    switch (ref.kind) {
        case "primitive":
            return primitiveInitial(ref.category);
        case "named":
            return namedInitial(ctx, ref);
        case "array":
        case "list":
        case "hashtable":
        case "callback":
        case "varargs":
            return "null";
    }
};

const primitiveInitial = (category: PrimitiveTypeRef["category"]): string => {
    switch (category) {
        case "boolean":
            return "false";
        case "string":
            return '""';
        case "void":
            return "null";
        default:
            return "0";
    }
};

const namedInitial = (ctx: ModuleContext, ref: NamedTypeRef): string => {
    const owner = ref.namespaceName ?? ctx.namespace.name;
    const resolved = ctx.repository.resolveNamed(owner, ref.typeName);
    if (resolved === undefined) return "null";
    if (resolved.kind === "enum") return "0";
    if (resolved.kind === "alias") {
        const qualified = qualifyTypeRef(resolved.targetRef, resolved.namespace.name);
        return qualified === undefined ? "null" : outRefInitial(ctx, qualified);
    }
    return "null";
};

const appendInoutRef = (options: AppendOutRefOptions): void => {
    const { ctx, parameter, index, builder } = options;
    const refName = `inout${builder.outRefs.length}`;
    builder.setup.push(`const ${refName} = { value: ${parameterCallExpression(ctx, parameter, index)} };`);
    registerRefArg(options, refName);
};

const appendInoutParameter = (options: AppendOutRefOptions): void => {
    const { ctx, parameter } = options;
    if (parameter.type !== undefined && isHandlePassing(ctx, parameter.type)) {
        appendInoutHandle(options);
    } else {
        appendInoutRef(options);
    }
};

const appendInoutHandle = (options: AppendOutRefOptions): void => {
    const { ctx, parameter, index, returnLengthIndices, builder } = options;
    builder.callArgs.push(parameterCallExpression(ctx, parameter, index));
    if (!returnLengthIndices.has(index)) {
        builder.outRefs.push({
            name: parameterIdentifier(parameter, index),
            type: parameter.type,
            nullable: parameter.nullable,
            raw: true,
        });
    }
};

const registerRefArg = (options: AppendOutRefOptions, refName: string): void => {
    const { parameter, index, returnLengthIndices, builder } = options;
    builder.callArgs.push(refName);
    if (!returnLengthIndices.has(index)) {
        builder.outRefs.push({ name: refName, type: parameter.type, nullable: parameter.nullable });
    }
};

const appendCallerAllocatedOut = (ctx: ModuleContext, parameter: GirParameter, builder: BodyBuilder): void => {
    const allocated = allocateCallerOut(ctx, parameter, builder.outRefs.length);
    if (allocated === undefined) {
        builder.callArgs.push("undefined");
        return;
    }
    builder.setup.push(allocated.setup);
    builder.callArgs.push(allocated.callArg);
    builder.outRefs.push({
        name: allocated.returnExpression,
        type: parameter.type,
        nullable: parameter.nullable,
        raw: true,
    });
};

const appendErrorRef = (fn: GirFunction, builder: BodyBuilder): string | undefined => {
    if (!fn.throws) return undefined;
    const errorRef = "__error";
    builder.setup.push(`const ${errorRef} = { value: null };`);
    builder.callArgs.push(errorRef);
    return errorRef;
};

const appendReturn = (
    ctx: ModuleContext,
    lines: string[],
    primary: string | undefined,
    outRefs: readonly OutRef[],
): void => {
    if (outRefs.length === 0) {
        if (primary !== undefined) lines.push(`return ${primary};`);
        return;
    }
    const outExpressions = outRefs.map((ref) =>
        ref.raw === true
            ? ref.name
            : wrapReturnValue(ctx, {
                  ref: ref.type,
                  transfer: "full",
                  nullable: ref.nullable,
                  valueExpression: `${ref.name}.value`,
              }),
    );
    if (primary !== undefined) {
        lines.push(`return [${primary}, ${outExpressions.join(", ")}];`);
        return;
    }
    if (outExpressions.length === 1) {
        lines.push(`return ${outExpressions[0]};`);
        return;
    }
    lines.push(`return [${outExpressions.join(", ")}];`);
};

/**
 * Whether a parameter is passed to the FFI binding as a `t.ref(...)` cell.
 *
 * Pure out parameters marshal through a `{ value }` ref cell the native layer
 * writes into. Inout parameters do too — except handle-passing ones
 * (objects, interfaces, boxed), which are passed by their existing handle
 * and mutated in place rather than through a pointer-to-pointer cell.
 * Caller-allocated outs pass a pre-built handle and are excluded.
 *
 * @param ctx - The module context
 * @param parameter - The parameter to test
 */
export const needsRefArg = (ctx: ModuleContext, parameter: GirParameter): boolean => {
    if (parameter.direction !== "out" && parameter.direction !== "inout") return false;
    const passesHandleDirectly =
        (parameter.callerAllocates || parameter.direction === "inout") &&
        parameter.type !== undefined &&
        isHandlePassing(ctx, parameter.type);
    return !passesHandleDirectly;
};

const allocateCallerOut = (
    ctx: ModuleContext,
    parameter: GirParameter,
    index: number,
): { readonly setup: string; readonly callArg: string; readonly returnExpression: string } | undefined => {
    if (parameter.type === undefined || parameter.type.kind !== "named") return undefined;
    const owner = parameter.type.namespaceName ?? ctx.namespace.name;
    const resolved = ctx.repository.resolveNamed(owner, parameter.type.typeName);
    if (resolved === undefined) return undefined;
    if (resolved.kind !== "boxed" && resolved.kind !== "class") return undefined;
    const local = `__out${index}`;
    const classExpression = qualifiedRuntimeReference(ctx, owner, parameter.type.typeName);
    ctx.addRuntimeImport("getHandle");
    return {
        setup: `const ${local} = new ${classExpression}();`,
        callArg: `getHandle(${local})`,
        returnExpression: local,
    };
};

const parameterIdentifier = (parameter: GirParameter, index: number): string => {
    if (parameter.name.length === 0) return `arg${index}`;
    return toIdentifier(toCamelCase(parameter.name));
};

const parameterCallExpression = (ctx: ModuleContext, parameter: GirParameter, index: number): string => {
    const name = parameterIdentifier(parameter, index);
    const ref = parameter.type;
    if (ref === undefined) return name;
    const callback = resolveCallbackType(ctx, ref);
    if (callback !== undefined) return renderCallbackArgument(ctx, callback, name);
    const nullable = parameter.nullable || parameter.optional;
    if (isHandlePassing(ctx, ref)) {
        if (nullable) {
            ctx.addRuntimeImport("tryGetHandle");
            return `tryGetHandle(${name})`;
        }
        ctx.addRuntimeImport("getHandle");
        return `getHandle(${name})`;
    }
    if ((ref.kind === "array" || ref.kind === "list") && isHandlePassing(ctx, ref.element)) {
        ctx.addRuntimeImport("getHandle");
        return nullable ? `${name}?.map((item) => getHandle(item))` : `${name}.map((item) => getHandle(item))`;
    }
    if (ref.kind === "hashtable") {
        if (isHandlePassing(ctx, ref.value)) {
            ctx.addRuntimeImport("tryGetHandle");
            return `${name} ? globalThis.Array.from(${name}).map(([k, v]) => [k, tryGetHandle(v)]) : null`;
        }
        return `${name} ? globalThis.Array.from(${name}) : null`;
    }
    return name;
};

/**
 * The marshalling plan for a callback or signal trampoline's incoming
 * arguments: the rendered comma-separated handler call arguments and the
 * trampoline-arg indices of any out-parameter cells.
 */
export type TrampolineArgPlan = {
    readonly callArgs: string;
    readonly outArgIndices: number[];
};

/**
 * Plans how a callback or signal trampoline forwards its raw arguments to the
 * user handler.
 *
 * In-parameters are wrapped via {@link wrapReturnValue} and joined into the
 * handler call; out-parameters are dropped from the call and their trampoline
 * cell indices collected for write-back. `argOffset` shifts every `args[...]`
 * access: callbacks read from index `0`, while signal trampolines reserve
 * index `0` for the emitting instance and so pass `1`.
 *
 * @param ctx - The module context
 * @param parameters - The callback or signal parameters, varargs excluded
 * @param namespaceName - The namespace the parameter type references resolve against
 * @param argOffset - Added to each parameter's positional index
 */
export const planTrampolineArgs = (
    ctx: ModuleContext,
    parameters: readonly GirParameter[],
    namespaceName: string,
    argOffset: number,
): TrampolineArgPlan => {
    const callArgs = parameters
        .map((parameter, index) =>
            isOutParameter(parameter)
                ? undefined
                : wrapReturnValue(ctx, {
                      ref: qualifyTypeRef(parameter.type, namespaceName),
                      transfer: parameter.transferOwnership,
                      nullable: parameter.nullable,
                      valueExpression: isCellInout(ctx, parameter)
                          ? `args[${index + argOffset}].value`
                          : `args[${index + argOffset}]`,
                  }),
        )
        .filter((expression): expression is string => expression !== undefined)
        .join(", ");
    const outArgIndices = parameters
        .map((parameter, index) => (isOutParameter(parameter) || isCellInout(ctx, parameter) ? index + argOffset : -1))
        .filter((index) => index >= 0);
    return { callArgs, outArgIndices };
};

const renderCallbackArgument = (ctx: ModuleContext, resolved: ResolvedCallback, name: string): string => {
    const { callback, namespaceName } = resolved;
    const { callArgs, outArgIndices } = planTrampolineArgs(ctx, callback.parameters, namespaceName, 0);
    const returnRef = qualifyTypeRef(callback.returnValue.type, namespaceName);
    if (outArgIndices.length > 0) {
        const body = renderTupleWriteback(ctx, `${name}(${callArgs})`, outArgIndices, returnRef);
        return `${name} ? (...args) => {\n    ${body}\n} : null`;
    }
    if (returnRef !== undefined && isHandlePassing(ctx, returnRef)) {
        ctx.addRuntimeImport("getHandle");
        return `${name} ? (...args) => {\n    const _result = ${name}(${callArgs});\n    return _result != null ? getHandle(_result) : null;\n} : null`;
    }
    return `${name} ? (...args) => ${name}(${callArgs}) : null`;
};

/**
 * Renders the body of a native→JS callback wrapper that returns out-parameters
 * as a tuple.
 *
 * The wrapped user function returns `[primary, ...outs]` (or the scalar out
 * alone for a void return with a single out, or an out-only tuple otherwise).
 * This emits `const _result = …;`, writes each out value into its `{ value }`
 * cell's `value` slot (`args[i].value = …`), and returns the primary — keeping the
 * tuple convention entirely in generated code so the native layer only flushes
 * cells through their out-pointers. Shared by signal and callback writers.
 *
 * @param ctx - The module context
 * @param callExpression - The expression that invokes the user function
 * @param outArgIndices - Argument indices of the out-parameter cells
 * @param returnRef - The primary return type, or `undefined` for void
 */
export const renderTupleWriteback = (
    ctx: ModuleContext,
    callExpression: string,
    outArgIndices: readonly number[],
    returnRef: GirTypeRef | undefined,
): string => {
    const lines = [`const _result = ${callExpression};`];
    const isVoid = returnRef === undefined || (returnRef.kind === "primitive" && returnRef.category === "void");
    if (!isVoid) {
        outArgIndices.forEach((argIndex, position) => {
            lines.push(`args[${argIndex}].value = _result[${position + 1}];`);
        });
        if (returnRef !== undefined && isHandlePassing(ctx, returnRef)) {
            ctx.addRuntimeImport("tryGetHandle");
            lines.push("return tryGetHandle(_result[0]);");
        } else {
            lines.push("return _result[0];");
        }
    } else if (outArgIndices.length === 1) {
        lines.push(`args[${outArgIndices[0]}].value = _result;`);
    } else {
        outArgIndices.forEach((argIndex, position) => {
            lines.push(`args[${argIndex}].value = _result[${position}];`);
        });
    }
    return lines.join("\n    ");
};

/**
 * Whether a value of `ref` is passed across the FFI boundary as a native
 * handle (object, interface, boxed, or an alias to one) rather than by value.
 *
 * @param ctx - The module context
 * @param ref - The type reference to test
 */
export const isHandlePassing = (ctx: ModuleContext, ref: GirTypeRef): boolean => {
    if (ref.kind !== "named") return false;
    const owner = ref.namespaceName ?? ctx.namespace.name;
    const resolved = ctx.repository.resolveNamed(owner, ref.typeName);
    if (resolved === undefined) return true;
    switch (resolved.kind) {
        case "class":
        case "interface":
        case "boxed":
            return true;
        case "alias": {
            const target = resolved.targetRef;
            if (target === undefined || target.kind !== "named") return false;
            return isHandlePassing(ctx, target);
        }
        case "enum":
        case "callback":
            return false;
    }
};

const wrapPrimary = (
    ctx: ModuleContext,
    fn: GirFunction,
    valueExpression: string,
    returnAs: ReturnOverride | undefined,
): string => {
    if (returnAs !== undefined) {
        if (returnAs.via === "class") {
            ctx.addRuntimeImport("getNativeObject");
            return `getNativeObject(${valueExpression}, ${returnAs.className})`;
        }
        ctx.addRuntimeImport("getNativeObjectAsInterface");
        return `getNativeObjectAsInterface(${valueExpression}, ${returnAs.className})`;
    }
    return wrapReturnValue(ctx, {
        ref: fn.returnValue.type,
        transfer: fn.returnValue.transferOwnership,
        nullable: fn.returnValue.nullable,
        valueExpression,
    });
};

/**
 * Inputs for {@link wrapReturnValue}.
 */
export type WrapReturnOptions = {
    readonly ref: GirTypeRef | undefined;
    readonly transfer: ParameterTransfer;
    readonly nullable: boolean;
    readonly valueExpression: string;
};

/**
 * Wraps a raw FFI value into its typed JavaScript form.
 *
 * Objects resolve to their runtime-registered wrapper, interfaces to the
 * interface wrapper, boxed values to a typed wrapper, collections recurse per
 * element, and primitives pass through with the appropriate coercion. Shared
 * by return-value handling and signal-handler argument marshalling.
 *
 * @param ctx - The module context
 * @param options - {@link WrapReturnOptions}
 */
export const wrapReturnValue = (ctx: ModuleContext, options: WrapReturnOptions): string => {
    const { ref, nullable, valueExpression } = options;
    if (ref === undefined) return valueExpression;
    switch (ref.kind) {
        case "primitive":
            return wrapPrimitive(ref, nullable, valueExpression);
        case "named":
            return wrapNamed(ctx, ref, valueExpression);
        case "array":
            return wrapCollection(ctx, ref.element, valueExpression);
        case "list":
            return ref.flavor === "gbytearray"
                ? `(${valueExpression} as number[])`
                : wrapCollection(ctx, ref.element, valueExpression);
        case "hashtable":
            return `new globalThis.Map(${valueExpression} as Iterable<readonly [unknown, unknown]>)`;
        case "callback":
        case "varargs":
            return `(${valueExpression} as unknown[])`;
    }
};

/**
 * Wraps a collection return value, mapping each element through the runtime
 * wrapper its type requires.
 *
 * The native layer hands collection returns back as arrays of raw element
 * values; object, interface, and boxed elements must be lifted into their
 * typed JavaScript wrappers (matching the per-element wrapping a scalar
 * return of the same type receives) while primitive and enum elements pass
 * through untouched.
 */
const wrapCollection = (ctx: ModuleContext, element: GirTypeRef | undefined, valueExpression: string): string => {
    const itemExpression = collectionItemWrap(ctx, element);
    if (itemExpression === undefined) return `(${valueExpression} as unknown[])`;
    return `(${valueExpression} as unknown[]).map((item) => ${itemExpression})`;
};

const collectionItemWrap = (ctx: ModuleContext, element: GirTypeRef | undefined): string | undefined => {
    if (element === undefined || element.kind !== "named") return undefined;
    const owner = element.namespaceName ?? ctx.namespace.name;
    const resolved = ctx.repository.resolveNamed(owner, element.typeName);
    if (resolved === undefined) {
        ctx.addRuntimeImport("getNativeObject");
        return "getNativeObject(item)";
    }
    switch (resolved.kind) {
        case "class":
        case "boxed":
            ctx.addRuntimeImport("getNativeObject");
            return "getNativeObject(item)";
        case "interface": {
            ctx.addRuntimeImport("getNativeObjectAsInterface");
            return `getNativeObjectAsInterface(item, ${qualifiedRuntimeReference(ctx, owner, element.typeName)})`;
        }
        case "alias":
            return resolved.target === undefined
                ? undefined
                : collectionItemWrap(ctx, {
                      kind: "named",
                      namespaceName: resolved.namespace.name,
                      typeName: resolved.target,
                      cType: undefined,
                  });
        case "enum":
        case "callback":
            return undefined;
    }
};

const wrapPrimitive = (ref: PrimitiveTypeRef, nullable: boolean, valueExpression: string): string => {
    const category = ref.category;
    if (category === "void") return valueExpression;
    if (category === "string") return `(${valueExpression} as ${nullable ? "string | null" : "string"})`;
    if (category === "boolean") return `Boolean(${valueExpression})`;
    return `(${valueExpression} as number)`;
};

const wrapNamed = (ctx: ModuleContext, ref: NamedTypeRef, valueExpression: string): string => {
    const owner = ref.namespaceName ?? ctx.namespace.name;
    const resolved = ctx.repository.resolveNamed(owner, ref.typeName);
    if (resolved === undefined) {
        ctx.addRuntimeImport("getNativeObject");
        return `getNativeObject(${valueExpression})`;
    }
    return wrapResolved(ctx, resolved, { namespaceName: owner, typeName: ref.typeName, valueExpression });
};

type WrapResolvedTarget = {
    readonly namespaceName: string;
    readonly typeName: string;
    readonly valueExpression: string;
};

const wrapResolved = (ctx: ModuleContext, resolved: ResolvedNamed, target: WrapResolvedTarget): string => {
    const { namespaceName, typeName, valueExpression } = target;
    switch (resolved.kind) {
        case "class": {
            ctx.addRuntimeImport("getNativeObject");
            return `getNativeObject(${valueExpression})`;
        }
        case "interface": {
            const classExpression = qualifiedRuntimeReference(ctx, namespaceName, typeName);
            ctx.addRuntimeImport("getNativeObjectAsInterface");
            return `getNativeObjectAsInterface(${valueExpression}, ${classExpression})`;
        }
        case "boxed": {
            const classExpression = qualifiedRuntimeReference(ctx, namespaceName, typeName);
            ctx.addRuntimeImport("getNativeObject");
            return `getNativeObject(${valueExpression}, ${classExpression})`;
        }
        case "enum":
            return `(${valueExpression} as number)`;
        case "callback":
        case "alias":
            return valueExpression;
    }
};

const qualifiedRuntimeReference = (ctx: ModuleContext, namespaceName: string, typeName: string): string => {
    if (namespaceName === ctx.namespace.name) return typeName;
    const alias = ctx.addCrossNamespaceImport(namespaceName);
    return `${alias}.${typeName}`;
};

const errorClassReference = (ctx: ModuleContext): string => {
    if (ctx.namespace.name === "GLib") return "Error";
    const alias = ctx.addCrossNamespaceImport("GLib");
    return `${alias}.Error`;
};
