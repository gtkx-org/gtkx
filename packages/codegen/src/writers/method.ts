import { toCamelCase } from "@gtkx/utils";
import type { ModuleContext } from "../dsl/context.js";
import type { GirFunction } from "../gir/function.js";
import { type GirParameter, isCallerAllocatedOut, isInoutParameter, isOutParameter } from "../gir/parameter.js";
import { qualifyTypeRef } from "../gir/qualify.js";
import type { GirTypeRef, NamedTypeRef, PrimitiveTypeRef } from "../gir/type-ref.js";
import {
    arrayLengthSources,
    closureAndDestroyIndices,
    foldedLengthIndices,
    inputParameters,
    isCollectibleCallerOut,
    isHandlePassing,
    parameterIdentifier,
} from "./param-classify.js";
import { handleCast, wrapReturnValue } from "./return-wrap.js";
import { renderTsType } from "./ts-type.js";
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
 * @param context - The module context
 * @param fn - The callable
 */
export const renderMethodSignature = (context: ModuleContext, fn: GirFunction): string =>
    renderInputParameters(
        context,
        fn,
        () => false,
        () => false,
    );

const renderInputParameters = (
    context: ModuleContext,
    fn: GirFunction,
    skip: (parameter: GirParameter) => boolean,
    isOptionalExtra: (parameter: GirParameter) => boolean,
): string => {
    const parts: string[] = [];
    let sawOptional = false;
    for (const { parameter, index } of inputParameters(fn)) {
        if (skip(parameter)) continue;
        const name = parameterIdentifier(parameter, index);
        if (parameter.optional || isOptionalExtra(parameter)) {
            sawOptional = true;
        }
        const annotation = renderTsType(context, parameter.type, parameter.nullable);
        parts.push(sawOptional ? `${name}?: ${annotation}` : `${name}: ${annotation}`);
    }
    return parts.join(", ");
};

/**
 * Renders the TypeScript return-type annotation for a callable.
 *
 * Multi-out callables tuple the primary return with each out-parameter
 * (`[primary, ...outs]`); when the primary return is void the tuple
 * starts at the first out-parameter.
 *
 * @param context - The module context
 * @param fn - The callable
 */
export const renderMethodReturnType = (context: ModuleContext, fn: GirFunction): string => {
    const folded = foldedLengthIndices(fn);
    const outs = fn.parameters.filter(
        (p, index) =>
            (isOutParameter(p) ||
                (isCallerAllocatedOut(p) && isCollectibleCallerOut(context, p)) ||
                isInoutParameter(p)) &&
            !folded.has(index),
    );
    const primaryReturnsValue = !omitsPrimaryReturn(fn);
    if (outs.length === 0) {
        return primaryReturnsValue ? renderTsType(context, fn.returnValue.type, fn.returnValue.nullable) : "void";
    }
    const outTypes = outs.map((parameter) => renderTsType(context, parameter.type, false));
    if (!primaryReturnsValue) {
        return outTypes.length === 1 ? `${outTypes[0]}` : `[${outTypes.join(", ")}]`;
    }
    const primary = renderTsType(context, fn.returnValue.type, fn.returnValue.nullable);
    return `[${primary}, ${outTypes.join(", ")}]`;
};

const isVoidReturn = (fn: GirFunction): boolean => {
    const ref = fn.returnValue.type;
    if (ref === undefined) return true;
    return ref.kind === "primitive" && ref.category === "void";
};

/**
 * Whether the callable's primary return value is dropped from the surfaced
 * result: a `void` return, or a `(skip)`-annotated one whose C value carries
 * nothing a JS caller needs. Either way the rendered return type and body
 * expose only the out-parameters.
 *
 * @param fn - The callable
 */
const omitsPrimaryReturn = (fn: GirFunction): boolean => isVoidReturn(fn) || fn.returnValue.skip;

/**
 * Optional override for the wrapper produced for the primary return value.
 *
 * Constructors use this to force the result to be wrapped as the owning
 * class even when the GIR `<return-value>` is typed as a parent class.
 */
type ReturnOverride =
    | {
          /**
           * Resolve the wrapper from the value's runtime GLib type, so a
           * constructor that hands back a subclass instance (e.g.
           * `ShortcutTrigger.parseString` returning a `KeyvalTrigger`) keeps
           * its concrete class and identity registration.
           */
          readonly via: "gobject";
      }
    | {
          /** Local interface identifier to fall back to when no registered class conforms. */
          readonly className: string;
          /**
           * Resolve the wrapper from the runtime type, walking to the closest
           * registered ancestor that still implements the interface and falling
           * back to the interface class itself — the path interface-typed values
           * take so a private implementation type still exposes the interface.
           */
          readonly via: "interface";
      }
    | {
          /** Local class identifier to pass as the second argument of `getNativeObject`. */
          readonly className: string;
          /**
           * Wrap as the exact value-type class. Boxed records carry no runtime
           * GObject type instance, so the class must be supplied explicitly.
           */
          readonly via: "boxed";
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
 * @param context - The module context
 * @param asyncFn - The `*_async` callable
 * @param finishMember - The camelCase JS name of the companion `*_finish` method
 * @param bindingExpression - Expression that evaluates to the bound async `t.fn` callable
 */
export const renderPromisifiedBody = (
    context: ModuleContext,
    asyncFn: GirFunction,
    finishMember: string,
    bindingExpression: string,
): string => {
    context.addRuntimeImport("promisify");
    const cancellableIndex = findCancellableIndex(asyncFn.parameters);
    const closureIndices = closureAndDestroyIndices(asyncFn);
    const lengthFor = arrayLengthSources(asyncFn);
    const leadingExpressions: string[] = [];
    if (asyncFn.instance !== undefined) {
        context.addRuntimeImport("getHandle");
        leadingExpressions.push("getHandle(this)");
    }
    let cancellableExpression = "null";
    asyncFn.parameters.forEach((parameter, index) => {
        if (parameter.isVarargs) return;
        if (index === cancellableIndex) {
            cancellableExpression = parameterIdentifier(parameter, index);
            return;
        }
        if (isCallbackParameter(context, parameter)) return;
        if (closureIndices.has(index)) return;
        const sourceIndex = lengthFor.get(index);
        if (sourceIndex !== undefined) {
            const source = asyncFn.parameters[sourceIndex];
            if (source !== undefined) {
                leadingExpressions.push(`${parameterIdentifier(source, sourceIndex)}.length`);
                return;
            }
        }
        leadingExpressions.push(parameterCallExpression(context, parameter, index));
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
 * @param context - The module context
 * @param asyncFn - The `*_async` callable
 * @param finishFn - The companion `*_finish` callable
 */
export const renderPromisifiedSignature = (
    context: ModuleContext,
    asyncFn: GirFunction,
    finishFn: GirFunction,
): { readonly signature: string; readonly returnType: string } => {
    const signature = renderInputParameters(
        context,
        asyncFn,
        (parameter) => isCallbackParameter(context, parameter),
        isCancellable,
    );
    const finishReturn = renderMethodReturnType(context, finishFn);
    return { signature, returnType: `Promise<${finishReturn}>` };
};

const isCancellable = (parameter: GirParameter): boolean =>
    parameter.type?.kind === "named" && parameter.type.typeName === "Cancellable";

const isCallbackParameter = (context: ModuleContext, parameter: GirParameter): boolean => {
    const ref = parameter.type;
    if (ref === undefined) return false;
    if (ref.kind === "callback") return true;
    if (ref.kind !== "named") return false;
    const namespaceName = ref.namespaceName ?? context.namespace.name;
    const resolved = context.repository.resolveNamed(namespaceName, ref.typeName);
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
 * @param context - The module context
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
    /**
     * The cell backs an array's folded `length` companion: it is allocated and
     * passed to the FFI so the native marshaller can size the array, but it is
     * dropped from the surfaced return tuple.
     */
    readonly consumed?: boolean;
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

export const renderMethodBody = (context: ModuleContext, fn: GirFunction, options: WriteMethodBodyOptions): string => {
    const { bindingExpression, isStatic, returnAs } = options;
    const builder: BodyBuilder = { callArgs: [], setup: [], outRefs: [] };
    if (!isStatic && fn.instance !== undefined) {
        context.addRuntimeImport("getHandle");
        builder.callArgs.push("getHandle(this)");
    }
    collectParameterArgs(context, fn, builder);
    const errorRef = appendErrorRef(fn, builder);
    const callExpression = `${bindingExpression}(${builder.callArgs.join(", ")})`;
    const lines: string[] = [...builder.setup];
    const returnsValue = !omitsPrimaryReturn(fn);
    lines.push(returnsValue ? `const __result = ${callExpression};` : `${callExpression};`);
    if (errorRef !== undefined) {
        context.addRuntimeImport("checkError");
        lines.push(`checkError(${errorRef}, ${context.qualify("GLib", "Error")});`);
    }
    const primary = returnsValue ? wrapPrimary(context, fn, "__result", returnAs) : undefined;
    appendReturn(context, lines, primary, builder.outRefs);
    return lines.join("\n");
};

const collectParameterArgs = (context: ModuleContext, fn: GirFunction, builder: BodyBuilder): void => {
    const lengthFor = arrayLengthSources(fn);
    const closureIndices = closureAndDestroyIndices(fn);
    const folded = foldedLengthIndices(fn);
    fn.parameters.forEach((parameter, index) => {
        if (parameter.isVarargs) return;
        if (isOutParameter(parameter)) {
            appendOutRef({ context, parameter, index, folded, builder });
            return;
        }
        if (isCallerAllocatedOut(parameter)) {
            appendCallerAllocatedOut(context, parameter, builder);
            return;
        }
        if (isInoutParameter(parameter)) {
            appendInoutParameter({ context, parameter, index, folded, builder });
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
        builder.callArgs.push(parameterCallExpression(context, parameter, index));
    });
};

type AppendOutRefOptions = {
    readonly context: ModuleContext;
    readonly parameter: GirParameter;
    readonly index: number;
    readonly folded: ReadonlySet<number>;
    readonly builder: BodyBuilder;
};

const appendOutRef = (options: AppendOutRefOptions): void => {
    const { context, parameter, builder } = options;
    const refName = `out${builder.outRefs.length}`;
    builder.setup.push(`const ${refName}: { value: unknown } = { value: ${outRefInitial(context, parameter.type)} };`);
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
const outRefInitial = (context: ModuleContext, ref: GirTypeRef | undefined): string => {
    if (ref === undefined) return "null";
    switch (ref.kind) {
        case "primitive":
            return primitiveInitial(ref.category);
        case "named":
            return namedInitial(context, ref);
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

const namedInitial = (context: ModuleContext, ref: NamedTypeRef): string => {
    const owner = ref.namespaceName ?? context.namespace.name;
    const resolved = context.repository.resolveNamed(owner, ref.typeName);
    if (resolved === undefined) return "null";
    if (resolved.kind === "enum") return "0";
    if (resolved.kind === "alias") {
        const qualified = qualifyTypeRef(resolved.targetRef, resolved.namespace.name);
        return qualified === undefined ? "null" : outRefInitial(context, qualified);
    }
    return "null";
};

const appendInoutRef = (options: AppendOutRefOptions): void => {
    const { context, parameter, index, builder } = options;
    const refName = `inout${builder.outRefs.length}`;
    builder.setup.push(
        `const ${refName}: { value: unknown } = { value: ${parameterCallExpression(context, parameter, index)} };`,
    );
    registerRefArg(options, refName);
};

const appendInoutParameter = (options: AppendOutRefOptions): void => {
    const { context, parameter } = options;
    if (parameter.type !== undefined && isHandlePassing(context, parameter.type)) {
        appendInoutHandle(options);
    } else {
        appendInoutRef(options);
    }
};

const appendInoutHandle = (options: AppendOutRefOptions): void => {
    const { context, parameter, index, folded, builder } = options;
    builder.callArgs.push(parameterCallExpression(context, parameter, index));
    builder.outRefs.push({
        name: parameterIdentifier(parameter, index),
        type: parameter.type,
        nullable: parameter.nullable,
        raw: true,
        consumed: folded.has(index),
    });
};

const registerRefArg = (options: AppendOutRefOptions, refName: string): void => {
    const { parameter, index, folded, builder } = options;
    builder.callArgs.push(refName);
    builder.outRefs.push({
        name: refName,
        type: parameter.type,
        nullable: parameter.nullable,
        consumed: folded.has(index),
    });
};

const appendCallerAllocatedOut = (context: ModuleContext, parameter: GirParameter, builder: BodyBuilder): void => {
    const allocated = allocateCallerOut(context, parameter, builder.outRefs.length);
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
    context: ModuleContext,
    lines: string[],
    primary: string | undefined,
    outRefs: readonly OutRef[],
): void => {
    const surfaced = outRefs.filter((ref) => ref.consumed !== true);
    if (surfaced.length === 0) {
        if (primary !== undefined) lines.push(`return ${primary};`);
        return;
    }
    const outExpressions = surfaced.map((ref) =>
        ref.raw === true
            ? ref.name
            : wrapReturnValue(context, {
                  ref: ref.type,
                  nullable: false,
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

const allocateCallerOut = (
    context: ModuleContext,
    parameter: GirParameter,
    index: number,
): { readonly setup: string; readonly callArg: string; readonly returnExpression: string } | undefined => {
    if (parameter.type === undefined || parameter.type.kind !== "named") return undefined;
    if (!isCollectibleCallerOut(context, parameter)) return undefined;
    const owner = parameter.type.namespaceName ?? context.namespace.name;
    const local = `__out${index}`;
    const classExpression = context.qualify(owner, parameter.type.typeName);
    context.addRuntimeImport("getHandle");
    return {
        setup: `const ${local} = new ${classExpression}();`,
        callArg: `getHandle(${local})`,
        returnExpression: local,
    };
};

const parameterCallExpression = (context: ModuleContext, parameter: GirParameter, index: number): string => {
    const name = parameterIdentifier(parameter, index);
    const ref = parameter.type;
    if (ref === undefined) return name;
    const callback = resolveCallbackType(context, ref);
    if (callback !== undefined) return renderCallbackArgument(context, callback, name);
    const nullable = parameter.nullable || parameter.optional;
    if (isHandlePassing(context, ref)) {
        if (nullable) {
            context.addRuntimeImport("tryGetHandle");
            return `tryGetHandle(${name})`;
        }
        context.addRuntimeImport("getHandle");
        return `getHandle(${name})`;
    }
    if ((ref.kind === "array" || ref.kind === "list") && isHandlePassing(context, ref.element)) {
        context.addRuntimeImport("getHandle");
        return nullable ? `${name}?.map((item) => getHandle(item))` : `${name}.map((item) => getHandle(item))`;
    }
    if (ref.kind === "hashtable") {
        if (isHandlePassing(context, ref.value)) {
            context.addRuntimeImport("tryGetHandle");
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
 * @param context - The module context
 * @param parameters - The callback or signal parameters, varargs excluded
 * @param namespaceName - The namespace the parameter type references resolve against
 * @param argOffset - Added to each parameter's positional index
 */
export const planTrampolineArgs = (
    context: ModuleContext,
    parameters: readonly GirParameter[],
    namespaceName: string,
    argOffset: number,
): TrampolineArgPlan => {
    const callArgs = parameters
        .map((parameter, index) =>
            isOutParameter(parameter)
                ? undefined
                : wrapReturnValue(context, {
                      ref: qualifyTypeRef(parameter.type, namespaceName),
                      nullable: parameter.nullable,
                      valueExpression: isCellInout(context, parameter)
                          ? `args[${index + argOffset}].value`
                          : `args[${index + argOffset}]`,
                  }),
        )
        .filter((expression): expression is string => expression !== undefined)
        .join(", ");
    const outArgIndices = parameters
        .map((parameter, index) =>
            isOutParameter(parameter) || isCellInout(context, parameter) ? index + argOffset : -1,
        )
        .filter((index) => index >= 0);
    return { callArgs, outArgIndices };
};

const renderCallbackArgument = (context: ModuleContext, resolved: ResolvedCallback, name: string): string => {
    const { callback, namespaceName } = resolved;
    const { callArgs, outArgIndices } = planTrampolineArgs(context, callback.parameters, namespaceName, 0);
    const returnRef = qualifyTypeRef(callback.returnValue.type, namespaceName);
    if (outArgIndices.length > 0) {
        const body = renderTupleWriteback(context, `${name}(${callArgs})`, outArgIndices, returnRef);
        return `${name} ? (...args: unknown[]) => {\n    ${body}\n} : null`;
    }
    if (returnRef !== undefined && isHandlePassing(context, returnRef)) {
        context.addRuntimeImport("getHandle");
        return `${name} ? (...args: unknown[]) => {\n    const _result = ${name}(${callArgs});\n    return _result != null ? getHandle(_result) : null;\n} : null`;
    }
    return `${name} ? (...args: unknown[]) => ${name}(${callArgs}) : null`;
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
 * @param context - The module context
 * @param callExpression - The expression that invokes the user function
 * @param outArgIndices - Argument indices of the out-parameter cells
 * @param returnRef - The primary return type, or `undefined` for void
 */
export const renderTupleWriteback = (
    context: ModuleContext,
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
        if (returnRef !== undefined && isHandlePassing(context, returnRef)) {
            context.addRuntimeImport("tryGetHandle");
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

const wrapPrimary = (
    context: ModuleContext,
    fn: GirFunction,
    valueExpression: string,
    returnAs: ReturnOverride | undefined,
): string => {
    if (returnAs !== undefined) {
        const handle = handleCast(context, valueExpression, false);
        if (returnAs.via === "gobject") {
            context.addRuntimeImport("getNativeObject");
            return `getNativeObject(${handle})`;
        }
        if (returnAs.via === "boxed") {
            context.addRuntimeImport("getNativeObject");
            return `getNativeObject(${handle}, ${returnAs.className})`;
        }
        context.addRuntimeImport("getNativeObjectAsInterface");
        return `getNativeObjectAsInterface(${handle}, ${returnAs.className})`;
    }
    return wrapReturnValue(context, {
        ref: fn.returnValue.type,
        nullable: fn.returnValue.nullable,
        valueExpression,
    });
};
