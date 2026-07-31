import { camelCase, sourceStringLiteral } from "@gtkx/utils";
import type { GirFunction } from "../../gir/function.js";
import type { GirType } from "../../gir/type.js";
import type { ModuleContext } from "../../writer/context.js";
import {
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
    inputParameters,
    parameterIdentifier,
} from "../../analysis/param-structure.js";
import { renderTsType } from "../../analysis/ts-type.js";
import { type GirParameter, isCallerAllocatedOut, isInoutParameter, isOutParameter } from "../../gir/parameter.js";
import { hasUnknownArrayLength, type TypeId } from "../../gir/type-id.js";
import { itemComparatorArgDescriptors, itemComparatorTsType } from "./item-comparators.js";
import { isCollectibleCallerOut, isHandlePassedInPlace, isHandlePassing } from "./param-marshal.js";

type PromisifiedStep = { sawOptional: boolean; expression: string | undefined };

type PromisifyContext = {
    context: ModuleContext;
    asyncFn: GirFunction;
    closureIndices: Set<number>;
    lengthSources: Map<number, number>;
};

type WriteMethodBodyOptions = {
    bindingExpression: string;
    returnTypeOverride?: string | undefined;
};

type CallArgPlan = {
    paramLiteral: string;
    inputExpr: string | undefined;
};

type ParamDescriptorOptions = {
    direction?: "out" | "inout";
    callerAllocated?: boolean;
    consumed?: boolean;
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

const methodExportName = (fn: GirFunction): string => camelCase(fn.name);

const arrayLengthArgument = (source: GirParameter, sourceIndex: number): string => {
    const identifier = parameterIdentifier(source, sourceIndex);

    return source.nullable || source.optional ? `(${identifier}?.length ?? 0)` : `${identifier}.length`;
};

const renderMethodSignature = (context: ModuleContext, fn: GirFunction): string =>
    renderInputParameters(
        context,
        fn,
        () => false,
        () => false,
    );

const parameterAnnotation = (context: ModuleContext, fn: GirFunction, parameter: GirParameter): string =>
    itemComparatorTsType(context, fn, parameter) ?? renderTsType(context, parameter.type, parameter.nullable);

const isParameterOptional = (parameter: GirParameter, isOptionalExtra: (parameter: GirParameter) => boolean): boolean =>
    parameter.optional || isOptionalExtra(parameter);

const formatParameterPart = (name: string, annotation: string, isOptional: boolean): string =>
    isOptional ? `${name}?: ${annotation}` : `${name}: ${annotation}`;

const renderInputParameters = (
    context: ModuleContext,
    fn: GirFunction,
    shouldSkip: (parameter: GirParameter) => boolean,
    isOptionalExtra: (parameter: GirParameter) => boolean,
): string => {
    const parts: string[] = [];
    let isSawOptional = false;

    for (const { parameter, index } of inputParameters(context.library, fn)) {
        if (shouldSkip(parameter)) {
            continue;
        }

        const name = parameterIdentifier(parameter, index);

        if (isParameterOptional(parameter, isOptionalExtra)) {
            isSawOptional = true;
        }

        parts.push(formatParameterPart(name, parameterAnnotation(context, fn, parameter), isSawOptional));
    }

    return parts.join(", ");
};

const isReturnedOutParameter = (context: ModuleContext, parameter: GirParameter): boolean =>
    isOutParameter(parameter) ||
    (isCallerAllocatedOut(parameter) && isCollectibleCallerOut(context, parameter)) ||
    isInoutParameter(parameter);

const renderMethodReturnType = (context: ModuleContext, fn: GirFunction): string => {
    const folded = foldedLengthIndices(context.library, fn);
    const outs = fn.parameters.filter((p, index) => isReturnedOutParameter(context, p) && !folded.has(index));

    const primary = shouldOmitPrimaryReturn(context.library, fn.returnValue)
        ? undefined
        : renderTsType(context, fn.returnValue.type, fn.returnValue.nullable);

    if (outs.length === 0) {
        return primary ?? "void";
    }

    const outTypes = outs.map((parameter) => renderTsType(context, parameter.type, parameter.nullable));

    return foldOutParamShape(primary, outTypes);
};

const classifyPromisifiedParameter = (
    promisify: PromisifyContext,
    parameter: GirParameter,
    index: number,
    state: { cancellableIndex: number; sawOptional: boolean },
): PromisifiedStep => {
    if (parameter.isVarargs) {
        return { sawOptional: state.sawOptional, expression: undefined };
    }

    if (index === state.cancellableIndex) {
        return { sawOptional: true, expression: undefined };
    }

    if (shouldSkipPromisifiedParameter(promisify, parameter, index)) {
        return { sawOptional: state.sawOptional, expression: undefined };
    }

    const isSawOptional = state.sawOptional || parameter.optional;

    return { sawOptional: isSawOptional, expression: promisifiedArgument(promisify, parameter, index, isSawOptional) };
};

const collectPromisifiedArguments = (promisify: PromisifyContext, cancellableIndex: number): string[] => {
    const expressions: string[] = [];
    let isSawOptional = false;

    for (const [index, parameter] of promisify.asyncFn.parameters.entries()) {
        const step = classifyPromisifiedParameter(promisify, parameter, index, {
            cancellableIndex,
            sawOptional: isSawOptional,
        });

        isSawOptional = step.sawOptional;

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

const renderPromisifiedBody = (
    context: ModuleContext,
    asyncFn: GirFunction,
    finishExpression: string,
    bindingExpression: string,
): string => {
    context.addRuntimeImport("promisify");
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

    return `return promisify(${bindingExpression}, ${finishExpression}, ${cancellableExpression}${leadingArguments});`;
};

const finishCallExpression = (asyncFn: GirFunction, finishFn: GirFunction, ownerName: string): string =>
    asyncFn.instance !== undefined && finishFn.instance === undefined
        ? `${ownerName}.${methodExportName(finishFn)}.bind(${ownerName})`
        : `this.${methodExportName(finishFn)}.bind(this)`;

const shouldSkipPromisifiedParameter = (promisify: PromisifyContext, parameter: GirParameter, index: number): boolean =>
    isCallbackParameter(promisify.context, parameter) ||
    promisify.closureIndices.has(index) ||
    (isOutParameter(parameter) && !isCallerAllocatedOut(parameter));

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

    return parameterCallExpression(context, parameter, index, hasSeenOptional);
};

const findCancellableIndex = (context: ModuleContext, parameters: GirParameter[]): number =>
    parameters.findIndex((parameter) => isCancellable(context, parameter));

const renderPromisifiedSignature = (
    context: ModuleContext,
    asyncFn: GirFunction,
    finishFn: GirFunction,
): { signature: string; returnType: string } => {
    const signature = renderInputParameters(
        context,
        asyncFn,
        (parameter) => isCallbackParameter(context, parameter),
        (parameter) => isCancellable(context, parameter),
    );

    const finishReturn = renderMethodReturnType(context, finishFn);

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

    if (options.callerAllocated === true) {
        parts.push("callerAllocated: true");
    }

    if (options.consumed === true) {
        parts.push("consumed: true");
    }

    return `{ ${parts.join(", ")} }`;
};

const renderReturnDescriptor = (context: ModuleContext, fn: GirFunction): string => {
    const instanceOffset = fn.instance === undefined ? 0 : 1;

    return renderDescriptor(context, fn.returnValue.type, fn.returnValue.transferOwnership, {
        argIndexOffset: instanceOffset,
        argIndexMap: emittedArgIndices(fn, instanceOffset),
        isNewlyCreated: fn.instance === undefined,
    });
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
        index,
        argIndex: planContext.argIndex,
        consumed: folded.has(index),
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
    const descriptor = renderDescriptor(context, parameter.type, parameter.transferOwnership, argIndex);

    return {
        paramLiteral: paramDescriptorLiteral(descriptor, { direction: "out", consumed: isConsumed }),
        inputExpr: undefined,
    };
};

const constructibleName = (
    context: ModuleContext,
    ref: GirParameter["type"],
): { namespaceName: string; typeName: string } | undefined => {
    let current = ref;

    while (current !== undefined) {
        const resolved = context.library.typeFor(current);

        if (resolved?.kind === "alias" && resolved.value.target !== undefined) {
            current = resolved.value.target;
            continue;
        }

        return context.library.nameFor(current);
    }

    return undefined;
};

const planCallerOut = (
    context: ModuleContext,
    parameter: GirParameter,
    argIndex: ArgIndexOptions,
): CallArgPlan => {
    const descriptor = renderDescriptor(context, parameter.type, "none", argIndex);
    const name = constructibleName(context, parameter.type);

    if (name !== undefined && isCollectibleCallerOut(context, parameter)) {
        context.addRuntimeImport("getHandle");
        const classExpression = context.qualify(name.namespaceName, name.typeName);

        return {
            paramLiteral: paramDescriptorLiteral(descriptor, { direction: "out", callerAllocated: true }),
            inputExpr: `new ${classExpression}()`,
        };
    }

    return { paramLiteral: paramDescriptorLiteral(descriptor, {}), inputExpr: "undefined" };
};

const planInoutParam = (
    context: ModuleContext,
    parameter: GirParameter,
    options: {
        index: number;
        argIndex: ArgIndexOptions;
        consumed: boolean;
        lengthSource?: { source: GirParameter; index: number } | undefined;
    },
): CallArgPlan => {
    const { index, argIndex, consumed, lengthSource } = options;

    if (isHandlePassedInPlace(context, parameter)) {
        const descriptor = renderDescriptor(context, parameter.type, "none", argIndex);

        return {
            paramLiteral: paramDescriptorLiteral(descriptor, { direction: "inout", callerAllocated: true, consumed }),
            inputExpr: parameterIdentifier(parameter, index),
        };
    }

    const descriptor = renderDescriptor(context, parameter.type, parameter.transferOwnership, argIndex);

    return {
        paramLiteral: paramDescriptorLiteral(descriptor, { direction: "inout", consumed }),
        inputExpr:
            lengthSource === undefined
                ? parameterCallExpression(context, parameter, index)
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
        paramLiteral: paramDescriptorLiteral(descriptor, {}),
        inputExpr: parameterCallExpression(context, parameter, index),
    };
};

const handleArgument = (context: ModuleContext, name: string, isNullable: boolean): string => {
    if (isNullable) {
        context.addRuntimeImport("tryGetHandle");

        return `tryGetHandle(${name})`;
    }

    context.addRuntimeImport("getHandle");

    return `getHandle(${name})`;
};

const hashtableArgument = (context: ModuleContext, valueRef: TypeId, name: string): string => {
    if (isHandlePassing(context, valueRef)) {
        context.addRuntimeImport("tryGetHandle");

        return `${name} ? globalThis.Array.from(${name}).map(([k, v]) => [k, tryGetHandle(v)]) : null`;
    }

    return `${name} ? globalThis.Array.from(${name}) : null`;
};

const mapHandleExpression = (name: string, isNullable: boolean): string =>
    isNullable ? `${name}?.map((item) => getHandle(item))` : `${name}.map((item) => getHandle(item))`;

const collectionArgument = (
    context: ModuleContext,
    type: GirType | undefined,
    name: string,
    isNullable: boolean,
): string | undefined => {
    if (type?.kind === "hashtable") {
        return hashtableArgument(context, type.value, name);
    }

    if (!isMappableSequence(context, type)) {
        return undefined;
    }

    context.addRuntimeImport("getHandle");

    return mapHandleExpression(name, isNullable);
};

const isMappableSequence = (context: ModuleContext, type: GirType | undefined): boolean => {
    if (type?.kind === "carray") {
        return !hasUnknownArrayLength(type) && isHandlePassing(context, type.element);
    }

    return type?.kind === "list" && isHandlePassing(context, type.element);
};

const parameterCallExpression = (
    context: ModuleContext,
    parameter: GirParameter,
    index: number,
    isForcedNullable = false,
): string => {
    const name = parameterIdentifier(parameter, index);
    const ref = parameter.type;

    if (ref === undefined) {
        return name;
    }

    const isNullable = parameter.nullable || parameter.optional || isForcedNullable;

    if (isHandlePassing(context, ref)) {
        return handleArgument(context, name, isNullable);
    }

    const type = context.library.typeFor(ref);

    return collectionArgument(context, type, name, isNullable) ?? name;
};

export {
    methodExportName,
    renderMethodSignature,
    renderMethodReturnType,
    renderPromisifiedBody,
    finishCallExpression,
    renderPromisifiedSignature,
    renderMethodBody,
    renderReturnDescriptor,
    planCallArgs,
};
