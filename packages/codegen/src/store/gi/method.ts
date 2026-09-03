import { camelCase, escapeIdentifierStart, sourceStringLiteral } from "@gtkx/utils";
import type { GirFunction } from "../../gir/function.js";
import type { GirType } from "../../gir/type.js";
import type { ModuleContext } from "../../writer/context.js";
import {
    isSkippedPrimaryReturn,
    renderCallbackType,
    renderDescriptor,
    renderSelfDescriptor,
    shouldOmitPrimaryReturn,
} from "../../analysis/descriptor-render.js";
import {
    arrayLengthSources,
    closureAndDestroyIndices,
    emittedArgIndices,
    foldedLengthIndices,
    foldOutParamShape,
    type InputParameter,
    inputParameters,
    parameterIdentifier,
} from "../../analysis/param-structure.js";
import { renderParameterTsType, renderTsType } from "../../analysis/ts-type.js";
import { primitiveCategoryFor } from "../../analysis/type-shape.js";
import { type GirParameter, isCallerAllocatedOut, isInoutParameter, isOutParameter } from "../../gir/parameter.js";
import { hasUnknownArrayLength, type TypeId } from "../../gir/type-id.js";
import { areClosuresInvoked } from "./closure-invocation.js";
import { itemComparatorArgDescriptors, itemComparatorTsType } from "./item-comparators.js";
import {
    isClosureType,
    isCollectibleCallerOut,
    isFixedArrayCallerOut,
    isHandlePassedInPlace,
    isHandlePassing,
    isValueType,
    renderCallerOutInstance,
} from "./param-marshal.js";

type PromisifiedStep = { hasSeenOptional: boolean; expression: string | undefined };

type InputParameterOptions = {
    shouldSkip: (parameter: GirParameter) => boolean;
    isOptionalExtra: (parameter: GirParameter) => boolean;
    isNullableExtra: (parameter: GirParameter) => boolean;
};

type CallExpressionOptions = {
    fn: GirFunction;
    isForcedNullable?: boolean | undefined;
};

type MarshalledArgumentOptions = {
    context: ModuleContext;
    ref: TypeId;
    name: string;
    isNullable: boolean;
    isValueMarshalled: boolean;
};

type PromisifyContext = {
    context: ModuleContext;
    asyncFn: GirFunction;
    closureIndices: Set<number>;
    lengthSources: Map<number, number>;
};

type AdaptedPromisifyContext = PromisifyContext & {
    cancellableIndex: number;
    inputIndices: Set<number>;
};

type WriteMethodBodyOptions = {
    bindingExpression: string;
    returnTypeOverride?: string | undefined;
};

type CallArgPlan = {
    paramLiteral: string;
    inputExpr: string | undefined;
};

type ReturnDescriptorPlan = {
    descriptor: string;
    isSkipped: boolean;
    isUnpacked: boolean;
};

type ParamDescriptorOptions = {
    direction?: "out" | "inout";
    isCallerAllocated?: boolean;
    isConsumed?: boolean;
    isUnpacked?: boolean;
    isRequired?: boolean;
};

type ArgIndexOptions = {
    argIndexOffset: number;
    argIndexMap: Map<number, number>;
};

type PlanArgsContext = {
    fn: GirFunction;
    instanceOffset: number;
    argIndex: ArgIndexOptions;
    lengthSources: Map<number, number>;
    closureIndices: Set<number>;
    folded: Set<number>;
};

const memberName = (girName: string): string => escapeIdentifierStart(camelCase(girName));
const methodExportName = (fn: GirFunction): string => memberName(fn.name);

const arrayLengthArgument = (source: GirParameter, sourceIndex: number): string => {
    const identifier = parameterIdentifier(source, sourceIndex);

    return source.nullable || source.optional ? `(${identifier}?.length ?? 0)` : `${identifier}.length`;
};

const renderMethodSignature = (context: ModuleContext, fn: GirFunction): string =>
    renderInputParameters(context, fn, {
        shouldSkip: () => false,
        isOptionalExtra: () => false,
        isNullableExtra: () => false,
    });

const closureAnnotation = (context: ModuleContext, base: string): string => {
    context.addRuntimeTypeImport("ClosureCallback");

    return `${base} | ClosureCallback`;
};

const requiresClosureMarshal = (context: ModuleContext, fn: GirFunction, ref: TypeId): boolean =>
    isClosureType(context, ref) && areClosuresInvoked(fn);

const requiresClosureAnnotation = (context: ModuleContext, fn: GirFunction, parameter: GirParameter): boolean =>
    parameter.type !== undefined && requiresClosureMarshal(context, fn, parameter.type);

const isValueRead = (parameter: GirParameter): boolean =>
    !isInoutParameter(parameter) && parameter.cType?.includes("const ") === true;

const parameterAnnotation = (
    context: ModuleContext,
    fn: GirFunction,
    parameter: GirParameter,
    isForcedNullable = false,
): string => {
    const comparator = itemComparatorTsType(context, fn, parameter);

    if (comparator !== undefined) {
        return comparator;
    }

    const base = renderParameterTsType(
        context,
        parameter.type,
        parameter.nullable || isForcedNullable,
        isValueRead(parameter),
    );

    return requiresClosureAnnotation(context, fn, parameter) ? closureAnnotation(context, base) : base;
};

const isParameterOptional = (parameter: GirParameter, isOptionalExtra: (parameter: GirParameter) => boolean): boolean =>
    parameter.optional || isOptionalExtra(parameter);

const formatParameterPart = (name: string, annotation: string, isOptional: boolean): string =>
    isOptional ? `${name}?: ${annotation}` : `${name}: ${annotation}`;

const renderInputParameters = (context: ModuleContext, fn: GirFunction, options: InputParameterOptions): string => {
    const parts: string[] = [];
    let hasSeenOptional = false;

    for (const { parameter, index } of inputParameters(context.library, fn)) {
        if (options.shouldSkip(parameter)) {
            continue;
        }

        const name = parameterIdentifier(parameter, index);

        if (isParameterOptional(parameter, options.isOptionalExtra)) {
            hasSeenOptional = true;
        }

        const annotation = parameterAnnotation(context, fn, parameter, options.isNullableExtra(parameter));
        parts.push(formatParameterPart(name, annotation, hasSeenOptional));
    }

    return parts.join(", ");
};

const isInPlaceInout = (context: ModuleContext, parameter: GirParameter): boolean =>
    isInoutParameter(parameter) && isHandlePassedInPlace(context, parameter);

const isReturnedOutParameter = (context: ModuleContext, parameter: GirParameter): boolean =>
    isOutParameter(parameter) ||
    (isCallerAllocatedOut(parameter) &&
        (isCollectibleCallerOut(context, parameter) || isFixedArrayCallerOut(context, parameter))) ||
        (isInoutParameter(parameter) && !isInPlaceInout(context, parameter));

const returnedOutParameters = (context: ModuleContext, fn: GirFunction): InputParameter[] => {
    const folded = foldedLengthIndices(context.library, fn);
    const result: InputParameter[] = [];

    for (const [index, parameter] of fn.parameters.entries()) {
        if (isReturnedOutParameter(context, parameter) && !folded.has(index)) {
            result.push({ parameter, index });
        }
    }

    return result;
};

const isUnwrappedValue = (context: ModuleContext, ref: TypeId | undefined): boolean =>
    ref !== undefined && isValueType(context, ref);

const renderReturnedTsType = (context: ModuleContext, ref: TypeId | undefined, isNullable: boolean): string =>
    isUnwrappedValue(context, ref) ? "unknown" : renderTsType(context, ref, isNullable);

const isUnpackedOutParameter = (context: ModuleContext, parameter: GirParameter): boolean =>
    isCallerAllocatedOut(parameter) &&
    isCollectibleCallerOut(context, parameter) &&
    isUnwrappedValue(context, parameter.type);

const renderOutTsType = (context: ModuleContext, parameter: GirParameter): string =>
    isUnpackedOutParameter(context, parameter)
        ? "unknown"
        : renderTsType(context, parameter.type, parameter.nullable);

const renderMethodReturnType = (context: ModuleContext, fn: GirFunction): string => {
    const outs = returnedOutParameters(context, fn);

    const primary = shouldOmitPrimaryReturn(context.library, fn.returnValue)
        ? undefined
        : renderReturnedTsType(context, fn.returnValue.type, fn.returnValue.nullable);

    if (outs.length === 0) {
        return primary ?? "void";
    }

    const outTypes = outs.map(({ parameter }) => renderOutTsType(context, parameter));

    return foldOutParamShape(primary, outTypes);
};

const classifyPromisifiedParameter = (
    promisify: PromisifyContext,
    parameter: GirParameter,
    index: number,
    state: { cancellableIndex: number; hasSeenOptional: boolean },
): PromisifiedStep => {
    if (parameter.isVarargs) {
        return { hasSeenOptional: state.hasSeenOptional, expression: undefined };
    }

    if (index === state.cancellableIndex) {
        return { hasSeenOptional: true, expression: undefined };
    }

    if (shouldSkipPromisifiedParameter(promisify, parameter, index)) {
        return { hasSeenOptional: state.hasSeenOptional, expression: undefined };
    }

    const hasSeenOptional = state.hasSeenOptional || parameter.optional;

    return { hasSeenOptional, expression: promisifiedArgument(promisify, parameter, index, hasSeenOptional) };
};

const collectPromisifiedArguments = (promisify: PromisifyContext, cancellableIndex: number): string[] => {
    const expressions: string[] = [];
    let hasSeenOptional = false;

    for (const [index, parameter] of promisify.asyncFn.parameters.entries()) {
        const step = classifyPromisifiedParameter(promisify, parameter, index, {
            cancellableIndex,
            hasSeenOptional,
        });

        hasSeenOptional = step.hasSeenOptional;

        if (step.expression !== undefined) {
            expressions.push(step.expression);
        }
    }

    return expressions;
};

const renderCancellableExpression = (parameters: GirParameter[], cancellableIndex: number): string => {
    if (cancellableIndex < 0) {
        return "null";
    }

    const parameter = parameters[cancellableIndex];

    return parameter === undefined ? "null" : parameterIdentifier(parameter, cancellableIndex);
};

const shouldTrimFinishBoolean = (context: ModuleContext, finishFn: GirFunction): boolean =>
    finishFn.throws &&
    !shouldOmitPrimaryReturn(context.library, finishFn.returnValue) &&
    primitiveCategoryFor(context.library, finishFn.returnValue.type) === "boolean" &&
    returnedOutParameters(context, finishFn).length > 0;

const promisifiedFinishExpression = (
    context: ModuleContext,
    finishFn: GirFunction,
    finishExpression: string,
): string => {
    if (!shouldTrimFinishBoolean(context, finishFn)) {
        return finishExpression;
    }

    context.addRuntimeImport("trimFinish");

    return `trimFinish(${finishExpression})`;
};

const renderPromisifiedBody = (
    context: ModuleContext,
    asyncFn: GirFunction,
    finishTarget: { fn: GirFunction; expression: string },
    bindingExpression: string,
): string => {
    if (hasSideCallback(context, asyncFn)) {
        return renderAdaptedPromisifiedBody(context, asyncFn, finishTarget, bindingExpression);
    }

    context.addRuntimeImport("promisify");
    const finish = promisifiedFinishExpression(context, finishTarget.fn, finishTarget.expression);
    const cancellableIndex = findCancellableIndex(context, asyncFn.parameters);

    const promisifyContext: PromisifyContext = {
        context,
        asyncFn,
        closureIndices: closureAndDestroyIndices(asyncFn),
        lengthSources: arrayLengthSources(context.library, asyncFn),
    };

    const leadingExpressions: string[] = [];

    if (asyncFn.instance !== undefined) {
        context.addRuntimeImport("getHandle");
        leadingExpressions.push("getHandle(this)");
    }

    leadingExpressions.push(...collectPromisifiedArguments(promisifyContext, cancellableIndex));
    const cancellableExpression = renderCancellableExpression(asyncFn.parameters, cancellableIndex);
    const leadingArguments = leadingExpressions.length > 0 ? `, ${leadingExpressions.join(", ")}` : "";

    return `return promisify(${bindingExpression}, ${finish}, ${cancellableExpression}${leadingArguments});`;
};

const hasSideCallback = (context: ModuleContext, fn: GirFunction): boolean =>
    fn.parameters.some((parameter) => isSideCallbackParameter(context, parameter));

const adaptedArgument = (
    promisify: AdaptedPromisifyContext,
    parameter: GirParameter,
    index: number,
    hasSeenOptional: boolean,
): string | undefined => {
    if (parameter.isVarargs || promisify.closureIndices.has(index) ||
        (isOutParameter(parameter) && !isCallerAllocatedOut(parameter))) {
        return undefined;
    }

    if (isAsyncReadyCallback(promisify.context, parameter)) {
        return "__callback";
    }

    if (index === promisify.cancellableIndex) {
        return "__cancellable";
    }

    return promisifiedArgument(promisify, parameter, index, hasSeenOptional);
};

const shouldMakeFollowingParametersOptional = (
    promisify: AdaptedPromisifyContext,
    parameter: GirParameter,
    index: number,
): boolean =>
    promisify.inputIndices.has(index) &&
    !isAsyncReadyCallback(promisify.context, parameter) &&
    (index === promisify.cancellableIndex ||
        parameter.optional ||
        isSideCallbackParameter(promisify.context, parameter));

const classifyAdaptedParameter = (
    promisify: AdaptedPromisifyContext,
    parameter: GirParameter,
    index: number,
    hasSeenOptional: boolean,
): PromisifiedStep => {
    const isOptional = hasSeenOptional || shouldMakeFollowingParametersOptional(promisify, parameter, index);

    return { hasSeenOptional: isOptional, expression: adaptedArgument(promisify, parameter, index, isOptional) };
};

const collectAdaptedArguments = (promisify: AdaptedPromisifyContext): string[] => {
    const expressions: string[] = [];
    let hasSeenOptional = false;

    for (const [index, parameter] of promisify.asyncFn.parameters.entries()) {
        const step = classifyAdaptedParameter(promisify, parameter, index, hasSeenOptional);
        hasSeenOptional = step.hasSeenOptional;

        if (step.expression !== undefined) {
            expressions.push(step.expression);
        }
    }

    return expressions;
};

const adaptedArguments = (
    context: ModuleContext,
    asyncFn: GirFunction,
    cancellableIndex: number,
): string[] => {
    const promisify: AdaptedPromisifyContext = {
        context,
        asyncFn,
        cancellableIndex,
        closureIndices: closureAndDestroyIndices(asyncFn),
        inputIndices: new Set(inputParameters(context.library, asyncFn).map(({ index }) => index)),
        lengthSources: arrayLengthSources(context.library, asyncFn),
    };
    const expressions = collectAdaptedArguments(promisify);

    if (asyncFn.instance !== undefined) {
        context.addRuntimeImport("getHandle");
        expressions.unshift("getHandle(this)");
    }

    return expressions;
};

const renderAdaptedPromisifiedBody = (
    context: ModuleContext,
    asyncFn: GirFunction,
    finishTarget: { fn: GirFunction; expression: string },
    bindingExpression: string,
): string => {
    context.addRuntimeImport("promisify");
    const finish = promisifiedFinishExpression(context, finishTarget.fn, finishTarget.expression);
    const cancellableIndex = findCancellableIndex(context, asyncFn.parameters);
    const cancellableExpression = renderCancellableExpression(asyncFn.parameters, cancellableIndex);
    const callArguments = adaptedArguments(context, asyncFn, cancellableIndex).join(", ");
    const adapter = `(__cancellable, __callback) => ${bindingExpression}(${callArguments})`;

    return `return promisify(${adapter}, ${finish}, ${cancellableExpression});`;
};

const finishCallExpression = (asyncFn: GirFunction, finishFn: GirFunction, ownerName: string): string =>
    asyncFn.instance !== undefined && finishFn.instance === undefined
        ? `${ownerName}.${methodExportName(finishFn)}.bind(${ownerName})`
        : `this.${methodExportName(finishFn)}.bind(this)`;

const shouldSkipPromisifiedParameter = (promisify: PromisifyContext, parameter: GirParameter, index: number): boolean =>
    isAsyncReadyCallback(promisify.context, parameter) ||
    promisify.closureIndices.has(index) ||
    (isOutParameter(parameter) && !isCallerAllocatedOut(parameter));

const sideCallbackArgument = (parameter: GirParameter, index: number): string => {
    const name = parameterIdentifier(parameter, index);

    return `${name} ?? (() => {})`;
};

const promisifiedArgument = (
    promisify: PromisifyContext,
    parameter: GirParameter,
    index: number,
    hasSeenOptional: boolean,
): string => {
    const { context, asyncFn, lengthSources } = promisify;
    const sourceIndex = lengthSources.get(index);
    const source = sourceIndex === undefined ? undefined : asyncFn.parameters[sourceIndex];

    if (sourceIndex !== undefined && source !== undefined) {
        return arrayLengthArgument(source, sourceIndex);
    }

    if (isSideCallbackParameter(context, parameter)) {
        return sideCallbackArgument(parameter, index);
    }

    return parameterCallExpression(context, parameter, index, { fn: asyncFn, isForcedNullable: hasSeenOptional });
};

const findCancellableIndex = (context: ModuleContext, parameters: GirParameter[]): number =>
    parameters.findIndex((parameter) => isCancellable(context, parameter));

const renderPromisifiedSignature = (
    context: ModuleContext,
    asyncFn: GirFunction,
    finishFn: GirFunction,
): { signature: string; returnType: string } => {
    const signature = renderInputParameters(context, asyncFn, {
        shouldSkip: (parameter) => isAsyncReadyCallback(context, parameter),
        isOptionalExtra: (parameter) =>
            isCancellable(context, parameter) || isSideCallbackParameter(context, parameter),
        isNullableExtra: (parameter) => isSideCallbackParameter(context, parameter),
    });

    const finishReturn = shouldTrimFinishBoolean(context, finishFn)
        ? foldOutParamShape(
                undefined,
                returnedOutParameters(context, finishFn).map(({ parameter }) => renderOutTsType(context, parameter)),
            )
        : renderMethodReturnType(context, finishFn);

    return { signature, returnType: `Promise<${finishReturn}>` };
};

const isCancellable = (context: ModuleContext, parameter: GirParameter): boolean =>
    parameter.type !== undefined && context.library.nameFor(parameter.type)?.typeName === "Cancellable";

const isCallbackParameter = (context: ModuleContext, parameter: GirParameter): boolean => {
    const ref = parameter.type;

    if (ref === undefined) {
        return false;
    }

    return context.library.typeFor(ref)?.kind === "callback";
};

const isSideCallbackParameter = (context: ModuleContext, parameter: GirParameter): boolean =>
    isCallbackParameter(context, parameter) && !isAsyncReadyCallback(context, parameter);

const isAsyncReadyCallback = (context: ModuleContext, parameter: GirParameter): boolean => {
    const ref = parameter.type;
    const name = ref === undefined ? undefined : context.library.nameFor(ref);

    return ref !== undefined &&
        context.library.typeFor(ref)?.kind === "callback" &&
        name?.namespaceName === "Gio" &&
        name.typeName === "AsyncReadyCallback";
};

const renderMethodBody = (context: ModuleContext, fn: GirFunction, options: WriteMethodBodyOptions): string => {
    const { bindingExpression, returnTypeOverride } = options;

    const inputs = planCallArgs(context, fn)
        .map((arg) => arg.inputExpr)
        .filter((expression): expression is string => expression !== undefined);

    const callExpression = `${bindingExpression}(${inputs.join(", ")})`;
    const annotation = returnTypeOverride ?? renderMethodReturnType(context, fn);

    return annotation === "void" ? `${callExpression};` : `return ${callExpression} as ${annotation};`;
};

const paramDescriptorLiteral = (descriptor: string, options: ParamDescriptorOptions): string => {
    const parts = [`type: ${descriptor}`];

    if (options.direction !== undefined) {
        parts.push(`direction: ${sourceStringLiteral(options.direction)}`);
    }

    if (options.isCallerAllocated === true) {
        parts.push("isCallerAllocated: true");
    }

    if (options.isConsumed === true) {
        parts.push("isConsumed: true");
    }

    if (options.isUnpacked === true) {
        parts.push("isUnpacked: true");
    }

    if (options.isRequired === true) {
        parts.push("isRequired: true");
    }

    return `{ ${parts.join(", ")} }`;
};

const renderReturnDescriptor = (context: ModuleContext, fn: GirFunction): ReturnDescriptorPlan => {
    const instanceOffset = fn.instance === undefined ? 0 : 1;

    const descriptor = renderDescriptor(context, fn.returnValue.type, fn.returnValue.transferOwnership, {
        argIndexOffset: instanceOffset,
        argIndexMap: emittedArgIndices(fn, instanceOffset),
        isNewlyCreated: fn.instance === undefined,
        isReceived: true,
    });

    return {
        descriptor,
        isSkipped: isSkippedPrimaryReturn(context.library, fn.returnValue),
        isUnpacked: isUnwrappedValue(context, fn.returnValue.type),
    };
};

const planCallArgs = (context: ModuleContext, fn: GirFunction): CallArgPlan[] => {
    const plan: CallArgPlan[] = [];

    if (fn.instance !== undefined) {
        context.addRuntimeImport("getHandle");

        plan.push({
            paramLiteral: `{ type: ${renderSelfDescriptor(context, fn.instance)} }`,
            inputExpr: "getHandle(this)",
        });
    }

    const instanceOffset = fn.instance === undefined ? 0 : 1;

    const planContext: PlanArgsContext = {
        fn,
        instanceOffset,
        argIndex: { argIndexOffset: instanceOffset, argIndexMap: emittedArgIndices(fn, instanceOffset) },
        lengthSources: arrayLengthSources(context.library, fn),
        closureIndices: closureAndDestroyIndices(fn),
        folded: foldedLengthIndices(context.library, fn),
    };

    for (const [index, parameter] of fn.parameters.entries()) {
        const entry = planParameter(context, parameter, index, planContext);

        if (entry !== undefined) {
            plan.push(entry);
        }
    }

    return plan;
};

const isSkippedPlanParameter = (parameter: GirParameter, index: number, closureIndices: Set<number>): boolean =>
    parameter.isVarargs || closureIndices.has(index);

const isRequiredParameter = (parameter: GirParameter): boolean => !parameter.nullable && !parameter.optional;

const planParameter = (
    context: ModuleContext,
    parameter: GirParameter,
    index: number,
    planContext: PlanArgsContext,
): CallArgPlan | undefined => {
    const { folded, closureIndices, lengthSources } = planContext;

    if (isSkippedPlanParameter(parameter, index, closureIndices)) {
        return undefined;
    }

    if (isOutParameter(parameter)) {
        return planOutParam(context, parameter, planContext.argIndex, folded.has(index));
    }

    if (isCallerAllocatedOut(parameter)) {
        return planCallerOut(context, parameter, planContext.argIndex);
    }

    if (isInoutParameter(parameter)) {
        return planInoutArgument(context, parameter, index, planContext);
    }

    const sourceIndex = lengthSources.get(index);

    if (sourceIndex !== undefined) {
        return planLengthArgument(context, parameter, sourceIndex, planContext);
    }

    return planInParam(context, parameter, index, planContext);
};

const planInoutArgument = (
    context: ModuleContext,
    parameter: GirParameter,
    index: number,
    planContext: PlanArgsContext,
): CallArgPlan => {
    const { fn, folded, lengthSources } = planContext;
    const lengthSourceIndex = lengthSources.get(index);
    const lengthSourceParam = lengthSourceIndex === undefined ? undefined : fn.parameters[lengthSourceIndex];

    const lengthSource =
        lengthSourceIndex !== undefined && lengthSourceParam !== undefined
            ? { source: lengthSourceParam, index: lengthSourceIndex }
            : undefined;

    return planInoutParam(context, parameter, {
        fn,
        index,
        argIndex: planContext.argIndex,
        isConsumed: folded.has(index),
        lengthSource,
    });
};

const planLengthArgument = (
    context: ModuleContext,
    parameter: GirParameter,
    sourceIndex: number,
    planContext: PlanArgsContext,
): CallArgPlan => {
    const source = planContext.fn.parameters[sourceIndex];
    const descriptor = renderDescriptor(context, parameter.type, parameter.transferOwnership, planContext.argIndex);

    return {
        paramLiteral: paramDescriptorLiteral(descriptor, {}),
        inputExpr: source === undefined ? "0" : arrayLengthArgument(source, sourceIndex),
    };
};

const planOutParam = (
    context: ModuleContext,
    parameter: GirParameter,
    argIndex: ArgIndexOptions,
    isConsumed: boolean,
): CallArgPlan => {
    const descriptor = renderDescriptor(context, parameter.type, parameter.transferOwnership, {
        ...argIndex,
        cursor: parameter.cursor,
        hasOutIndirection: true,
        isReceived: true,
    });

    return {
        paramLiteral: paramDescriptorLiteral(descriptor, { direction: "out", isConsumed }),
        inputExpr: undefined,
    };
};

const planCallerOut = (
    context: ModuleContext,
    parameter: GirParameter,
    argIndex: ArgIndexOptions,
): CallArgPlan => {
    if (isCollectibleCallerOut(context, parameter)) {
        context.addRuntimeImport("getHandle");

        return {
            paramLiteral: paramDescriptorLiteral(renderDescriptor(context, parameter.type, "none", argIndex), {
                direction: "out",
                isCallerAllocated: true,
                isUnpacked: isUnpackedOutParameter(context, parameter),
            }),
            inputExpr: renderCallerOutInstance(context, parameter),
        };
    }

    if (isFixedArrayCallerOut(context, parameter)) {
        const descriptor = renderDescriptor(context, parameter.type, "none", {
            ...argIndex,
            isCallerAllocated: true,
        });

        return {
            paramLiteral: paramDescriptorLiteral(descriptor, { direction: "out" }),
            inputExpr: undefined,
        };
    }

    return {
        paramLiteral: paramDescriptorLiteral(renderDescriptor(context, parameter.type, "none", argIndex), {}),
        inputExpr: "undefined",
    };
};

const planInoutParam = (
    context: ModuleContext,
    parameter: GirParameter,
    options: {
        fn: GirFunction;
        index: number;
        argIndex: ArgIndexOptions;
        isConsumed: boolean;
        lengthSource?: { source: GirParameter; index: number } | undefined;
    },
): CallArgPlan => {
    const { fn, index, argIndex, isConsumed, lengthSource } = options;

    if (isHandlePassedInPlace(context, parameter)) {
        const descriptor = renderDescriptor(context, parameter.type, "none", argIndex);

        return {
            paramLiteral: paramDescriptorLiteral(descriptor, {
                direction: "inout",
                isCallerAllocated: true,
                isConsumed: true,
                isRequired: isRequiredParameter(parameter),
            }),
            inputExpr: parameterIdentifier(parameter, index),
        };
    }

    const descriptor = renderDescriptor(context, parameter.type, parameter.transferOwnership, {
        ...argIndex,
        hasOutIndirection: true,
    });

    return {
        paramLiteral: paramDescriptorLiteral(descriptor, {
            direction: "inout",
            isConsumed,
            isRequired: lengthSource === undefined && isRequiredParameter(parameter),
        }),
        inputExpr:
            lengthSource === undefined
                ? parameterCallExpression(context, parameter, index, { fn })
                : arrayLengthArgument(lengthSource.source, lengthSource.index),
    };
};

const planInParam = (
    context: ModuleContext,
    parameter: GirParameter,
    index: number,
    planContext: PlanArgsContext,
): CallArgPlan => {
    const { fn } = planContext;

    const callback = renderCallbackType(
        context,
        parameter.type,
        parameter,
        itemComparatorArgDescriptors(context, fn, parameter),
    );

    const descriptor =
        callback ??
        renderDescriptor(
            context,
            parameter.type,
            parameter.transferOwnership,
            planContext.argIndex,
        );

    return {
        paramLiteral: paramDescriptorLiteral(descriptor, { isRequired: isRequiredParameter(parameter) }),
        inputExpr: parameterCallExpression(context, parameter, index, { fn }),
    };
};

const nullableHandleExpression = (name: string): string => `${name} == null ? null : getHandle(${name})`;

const handleArgument = (context: ModuleContext, name: string, isNullable: boolean): string => {
    context.addRuntimeImport("getHandle");

    return isNullable ? nullableHandleExpression(name) : `getHandle(${name})`;
};

const closureArgument = (context: ModuleContext, name: string, isNullable: boolean): string => {
    const helper = isNullable ? "tryToClosure" : "toClosure";
    context.addRuntimeImport(helper);

    return `${helper}(${name})`;
};

const valueArgument = (context: ModuleContext, name: string, isNullable: boolean): string => {
    const helper = isNullable ? "tryToValueHandle" : "toValueHandle";
    context.addRuntimeImport(helper);

    return `${helper}(${name})`;
};

const hashtableArgument = (
    context: ModuleContext,
    valueRef: TypeId,
    name: string,
    isValueMarshalled: boolean,
): string => {
    context.addRuntimeImport("toHashTableEntries");

    if (isValueMarshalled && isValueType(context, valueRef)) {
        context.addRuntimeImport("toValueHandle");

        return `toHashTableEntries(${name})?.map(([k, v]) => [k, toValueHandle(v)]) ?? null`;
    }

    if (isHandlePassing(context, valueRef)) {
        context.addRuntimeImport("getHandle");

        return `toHashTableEntries(${name})?.map(([k, v]) => [k, ${nullableHandleExpression("v")}]) ?? null`;
    }

    return `toHashTableEntries(${name})`;
};

const mapItemExpression = (name: string, isNullable: boolean, helper: string): string =>
    isNullable ? `${name}?.map((item) => ${helper}(item))` : `${name}.map((item) => ${helper}(item))`;

const itemHelper = (context: ModuleContext, element: TypeId, isValueMarshalled: boolean): string => {
    const helper = isValueMarshalled && isValueType(context, element) ? "toValueHandle" : "getHandle";
    context.addRuntimeImport(helper);

    return helper;
};

const collectionArgument = (options: MarshalledArgumentOptions & { type: GirType | undefined }): string | undefined => {
    const { context, type, name, isNullable, isValueMarshalled } = options;

    if (type?.kind === "hashtable") {
        return hashtableArgument(context, type.value, name, isValueMarshalled);
    }

    const element = mappableElement(context, type);

    if (element === undefined) {
        return undefined;
    }

    return mapItemExpression(name, isNullable, itemHelper(context, element, isValueMarshalled));
};

const mappableElement = (context: ModuleContext, type: GirType | undefined): TypeId | undefined => {
    if (type?.kind === "carray") {
        return hasUnknownArrayLength(type) ? undefined : mappableRef(context, type.element);
    }

    return type?.kind === "list" ? mappableRef(context, type.element) : undefined;
};

const mappableRef = (context: ModuleContext, element: TypeId): TypeId | undefined =>
    isHandlePassing(context, element) ? element : undefined;

const parameterCallExpression = (
    context: ModuleContext,
    parameter: GirParameter,
    index: number,
    options: CallExpressionOptions,
): string => {
    const { fn, isForcedNullable = false } = options;
    const name = parameterIdentifier(parameter, index);
    const ref = parameter.type;

    if (ref === undefined) {
        return name;
    }

    const isNullable = parameter.nullable || parameter.optional || isForcedNullable;

    if (requiresClosureMarshal(context, fn, ref)) {
        return closureArgument(context, name, isNullable);
    }

    const marshalled = marshalledArgument({
        context,
        ref,
        name,
        isNullable,
        isValueMarshalled: isValueRead(parameter),
    });

    if (marshalled !== undefined) {
        return marshalled;
    }

    const type = context.library.typeFor(ref);

    return (
        collectionArgument({
            context,
            ref,
            type,
            name,
            isNullable,
            isValueMarshalled: isValueRead(parameter),
        }) ?? name
    );
};

const marshalledArgument = (options: MarshalledArgumentOptions): string | undefined => {
    const { context, ref, name, isNullable, isValueMarshalled } = options;

    if (isValueMarshalled && isValueType(context, ref)) {
        return valueArgument(context, name, isNullable);
    }

    return isHandlePassing(context, ref) ? handleArgument(context, name, isNullable) : undefined;
};

export {
    isCallbackParameter,
    memberName,
    methodExportName,
    renderMethodSignature,
    renderMethodReturnType,
    returnedOutParameters,
    renderPromisifiedBody,
    finishCallExpression,
    renderPromisifiedSignature,
    shouldTrimFinishBoolean,
    renderMethodBody,
    renderReturnDescriptor,
    planCallArgs,
};
