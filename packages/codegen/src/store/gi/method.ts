import { sourceStringLiteral, toCamelCase } from "@gtkx/utils";
import {
    omitsPrimaryReturn,
    renderCallbackType,
    renderDescriptor,
    renderSelfDescriptor,
} from "../../analysis/descriptor-render.js";
import {
    arrayLengthSources,
    closureAndDestroyIndices,
    foldedLengthIndices,
    foldOutParamShape,
    inputParameters,
    parameterIdentifier,
} from "../../analysis/param-structure.js";
import { renderTsType } from "../../analysis/ts-type.js";
import type { GirFunction } from "../../gir/function.js";
import { type GirParameter, isCallerAllocatedOut, isInoutParameter, isOutParameter } from "../../gir/parameter.js";
import type { ModuleContext } from "../../writer/context.js";
import { itemComparatorArgDescriptors, itemComparatorTsType } from "./item-comparators.js";
import { isCollectibleCallerOut, isHandlePassing, passesHandleInPlace } from "./param-marshal.js";

export const methodExportName = (fn: GirFunction): string => toCamelCase(fn.name);

const arrayLengthArgument = (source: GirParameter, sourceIndex: number): string => {
    const identifier = parameterIdentifier(source, sourceIndex);
    return source.nullable || source.optional ? `(${identifier}?.length ?? 0)` : `${identifier}.length`;
};

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
    for (const { parameter, index } of inputParameters(context.library, fn)) {
        if (skip(parameter)) continue;
        const name = parameterIdentifier(parameter, index);
        if (parameter.optional || isOptionalExtra(parameter)) {
            sawOptional = true;
        }
        const annotation =
            itemComparatorTsType(context, fn, parameter) ?? renderTsType(context, parameter.type, parameter.nullable);
        parts.push(sawOptional ? `${name}?: ${annotation}` : `${name}: ${annotation}`);
    }
    return parts.join(", ");
};

export const renderMethodReturnType = (context: ModuleContext, fn: GirFunction): string => {
    const folded = foldedLengthIndices(context.library, fn);
    const outs = fn.parameters.filter(
        (p, index) =>
            (isOutParameter(p) ||
                (isCallerAllocatedOut(p) && isCollectibleCallerOut(context, p)) ||
                isInoutParameter(p)) &&
            !folded.has(index),
    );
    const primaryReturnsValue = !omitsPrimaryReturn(context.library, fn.returnValue);
    if (outs.length === 0) {
        return primaryReturnsValue ? renderTsType(context, fn.returnValue.type, fn.returnValue.nullable) : "void";
    }
    const outTypes = outs.map((parameter) => renderTsType(context, parameter.type, false));
    const primary = primaryReturnsValue
        ? renderTsType(context, fn.returnValue.type, fn.returnValue.nullable)
        : undefined;
    return foldOutParamShape(primary, outTypes);
};

export const renderPromisifiedBody = (
    context: ModuleContext,
    asyncFn: GirFunction,
    finishMember: string,
    bindingExpression: string,
): string => {
    context.addRuntimeImport("promisify");
    const cancellableIndex = findCancellableIndex(context, asyncFn.parameters);
    const closureIndices = closureAndDestroyIndices(asyncFn);
    const lengthFor = arrayLengthSources(context.library, asyncFn);
    const leadingExpressions: string[] = [];
    if (asyncFn.instance !== undefined) {
        context.addRuntimeImport("getHandle");
        leadingExpressions.push("getHandle(this)");
    }
    const promisifyContext: PromisifyContext = { context, asyncFn, closureIndices, lengthFor };
    let cancellableExpression = "null";
    let sawOptional = false;
    asyncFn.parameters.forEach((parameter, index) => {
        if (parameter.isVarargs) return;
        if (index === cancellableIndex) {
            cancellableExpression = parameterIdentifier(parameter, index);
            sawOptional = true;
            return;
        }
        if (skipPromisifiedParameter(promisifyContext, parameter, index)) return;
        if (parameter.optional) sawOptional = true;
        leadingExpressions.push(promisifiedArgument(promisifyContext, parameter, index, sawOptional));
    });
    const leadingArguments = leadingExpressions.length > 0 ? `, ${leadingExpressions.join(", ")}` : "";
    return `return promisify(${bindingExpression}, this.${finishMember}.bind(this), ${cancellableExpression}${leadingArguments});`;
};

type PromisifyContext = {
    context: ModuleContext;
    asyncFn: GirFunction;
    closureIndices: Set<number>;
    lengthFor: Map<number, number>;
};

const skipPromisifiedParameter = (promisify: PromisifyContext, parameter: GirParameter, index: number): boolean =>
    isCallbackParameter(promisify.context, parameter) ||
    promisify.closureIndices.has(index) ||
    (isOutParameter(parameter) && !isCallerAllocatedOut(parameter));

const promisifiedArgument = (
    promisify: PromisifyContext,
    parameter: GirParameter,
    index: number,
    sawOptional: boolean,
): string => {
    const { context, asyncFn, lengthFor } = promisify;
    const sourceIndex = lengthFor.get(index);
    const source = sourceIndex === undefined ? undefined : asyncFn.parameters[sourceIndex];
    if (sourceIndex !== undefined && source !== undefined) return arrayLengthArgument(source, sourceIndex);
    return parameterCallExpression(context, parameter, index, sawOptional);
};

const findCancellableIndex = (context: ModuleContext, parameters: GirParameter[]): number => {
    for (let index = 0; index < parameters.length; index += 1) {
        const parameter = parameters[index];
        if (parameter === undefined) continue;
        if (isCancellable(context, parameter)) return index;
    }
    return -1;
};

export const renderPromisifiedSignature = (
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
    parameter.type !== undefined && context.library.nameOf(parameter.type)?.typeName === "Cancellable";

const isCallbackParameter = (context: ModuleContext, parameter: GirParameter): boolean => {
    const ref = parameter.type;
    if (ref === undefined) return false;
    return context.library.typeOf(ref)?.kind === "callback";
};

type WriteMethodBodyOptions = {
    bindingExpression: string;
    returnTypeOverride?: string | undefined;
};

export const renderMethodBody = (context: ModuleContext, fn: GirFunction, options: WriteMethodBodyOptions): string => {
    const { bindingExpression, returnTypeOverride } = options;
    const inputs = planCallArgs(context, fn)
        .map((arg) => arg.inputExpr)
        .filter((expression): expression is string => expression !== undefined);
    const callExpression = `${bindingExpression}(${inputs.join(", ")})`;
    const annotation = returnTypeOverride ?? renderMethodReturnType(context, fn);
    return annotation === "void" ? `${callExpression};` : `return ${callExpression} as ${annotation};`;
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

const paramDescriptorLiteral = (descriptor: string, options: ParamDescriptorOptions): string => {
    const parts = [`type: ${descriptor}`];
    if (options.direction !== undefined) parts.push(`direction: ${sourceStringLiteral(options.direction)}`);
    if (options.callerAllocated === true) parts.push("callerAllocated: true");
    if (options.consumed === true) parts.push("consumed: true");
    return `{ ${parts.join(", ")} }`;
};

export const renderReturnDescriptor = (context: ModuleContext, fn: GirFunction): string => {
    const instanceOffset = fn.instance === undefined ? 0 : 1;
    return renderDescriptor(context, fn.returnValue.type, fn.returnValue.transferOwnership, {
        argIndexOffset: instanceOffset,
    });
};

export const planCallArgs = (context: ModuleContext, fn: GirFunction): CallArgPlan[] => {
    const plan: CallArgPlan[] = [];
    if (fn.instance !== undefined) {
        context.addRuntimeImport("getHandle");
        plan.push({
            paramLiteral: `{ type: ${renderSelfDescriptor(context, fn.instance)} }`,
            inputExpr: "getHandle(this)",
        });
    }
    const planContext: PlanArgsContext = {
        fn,
        instanceOffset: fn.instance === undefined ? 0 : 1,
        lengthFor: arrayLengthSources(context.library, fn),
        closureIndices: closureAndDestroyIndices(fn),
        folded: foldedLengthIndices(context.library, fn),
    };
    for (const [index, parameter] of fn.parameters.entries()) {
        const entry = planParameter(context, parameter, index, planContext);
        if (entry !== undefined) plan.push(entry);
    }
    return plan;
};

type PlanArgsContext = {
    fn: GirFunction;
    instanceOffset: number;
    lengthFor: Map<number, number>;
    closureIndices: Set<number>;
    folded: Set<number>;
};

const planParameter = (
    context: ModuleContext,
    parameter: GirParameter,
    index: number,
    planContext: PlanArgsContext,
): CallArgPlan | undefined => {
    const { instanceOffset, folded, closureIndices, lengthFor } = planContext;
    if (parameter.isVarargs || closureIndices.has(index)) return undefined;
    if (isOutParameter(parameter)) return planOutParam(context, parameter, instanceOffset, folded.has(index));
    if (isCallerAllocatedOut(parameter)) return planCallerOut(context, parameter, instanceOffset);
    if (isInoutParameter(parameter)) return planInoutArgument(context, parameter, index, planContext);
    const sourceIndex = lengthFor.get(index);
    if (sourceIndex !== undefined) return planLengthArgument(context, parameter, sourceIndex, planContext);
    return planInParam(context, parameter, index, planContext);
};

const planInoutArgument = (
    context: ModuleContext,
    parameter: GirParameter,
    index: number,
    planContext: PlanArgsContext,
): CallArgPlan => {
    const { fn, instanceOffset, folded, lengthFor } = planContext;
    const lengthSourceIndex = lengthFor.get(index);
    const lengthSourceParam = lengthSourceIndex === undefined ? undefined : fn.parameters[lengthSourceIndex];
    const lengthSource =
        lengthSourceIndex !== undefined && lengthSourceParam !== undefined
            ? { source: lengthSourceParam, index: lengthSourceIndex }
            : undefined;
    return planInoutParam(context, parameter, { index, instanceOffset, consumed: folded.has(index), lengthSource });
};

const planLengthArgument = (
    context: ModuleContext,
    parameter: GirParameter,
    sourceIndex: number,
    planContext: PlanArgsContext,
): CallArgPlan => {
    const source = planContext.fn.parameters[sourceIndex];
    const descriptor = renderDescriptor(context, parameter.type, parameter.transferOwnership, {
        argIndexOffset: planContext.instanceOffset,
    });
    return {
        paramLiteral: paramDescriptorLiteral(descriptor, {}),
        inputExpr: source === undefined ? "0" : arrayLengthArgument(source, sourceIndex),
    };
};

const planOutParam = (
    context: ModuleContext,
    parameter: GirParameter,
    instanceOffset: number,
    consumed: boolean,
): CallArgPlan => {
    const descriptor = renderDescriptor(context, parameter.type, parameter.transferOwnership, {
        argIndexOffset: instanceOffset,
    });
    return { paramLiteral: paramDescriptorLiteral(descriptor, { direction: "out", consumed }), inputExpr: undefined };
};

const constructibleName = (
    context: ModuleContext,
    ref: GirParameter["type"],
): { namespaceName: string; typeName: string } | undefined => {
    let current = ref;
    while (current !== undefined) {
        const resolved = context.library.typeOf(current);
        if (resolved?.kind === "alias" && resolved.value.target !== undefined) {
            current = resolved.value.target;
            continue;
        }
        return context.library.nameOf(current);
    }
    return undefined;
};

const planCallerOut = (context: ModuleContext, parameter: GirParameter, instanceOffset: number): CallArgPlan => {
    const descriptor = renderDescriptor(context, parameter.type, "none", { argIndexOffset: instanceOffset });
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
        instanceOffset: number;
        consumed: boolean;
        lengthSource?: { source: GirParameter; index: number } | undefined;
    },
): CallArgPlan => {
    const { index, instanceOffset, consumed, lengthSource } = options;
    if (passesHandleInPlace(context, parameter)) {
        const descriptor = renderDescriptor(context, parameter.type, "none", { argIndexOffset: instanceOffset });
        return {
            paramLiteral: paramDescriptorLiteral(descriptor, { direction: "inout", callerAllocated: true, consumed }),
            inputExpr: parameterIdentifier(parameter, index),
        };
    }
    const descriptor = renderDescriptor(context, parameter.type, parameter.transferOwnership, {
        argIndexOffset: instanceOffset,
    });
    return {
        paramLiteral: paramDescriptorLiteral(descriptor, { direction: "inout", consumed }),
        inputExpr:
            lengthSource !== undefined
                ? arrayLengthArgument(lengthSource.source, lengthSource.index)
                : parameterCallExpression(context, parameter, index),
    };
};

const planInParam = (
    context: ModuleContext,
    parameter: GirParameter,
    index: number,
    planContext: PlanArgsContext,
): CallArgPlan => {
    const { fn, instanceOffset } = planContext;
    const callback = renderCallbackType(
        context,
        parameter.type,
        parameter,
        itemComparatorArgDescriptors(context, fn, parameter),
    );
    const descriptor =
        callback ??
        renderDescriptor(context, parameter.type, parameter.transferOwnership, { argIndexOffset: instanceOffset });
    return {
        paramLiteral: paramDescriptorLiteral(descriptor, {}),
        inputExpr: parameterCallExpression(context, parameter, index),
    };
};

const parameterCallExpression = (
    context: ModuleContext,
    parameter: GirParameter,
    index: number,
    forceNullable = false,
): string => {
    const name = parameterIdentifier(parameter, index);
    const ref = parameter.type;
    if (ref === undefined) return name;
    const nullable = parameter.nullable || parameter.optional || forceNullable;
    if (isHandlePassing(context, ref)) {
        if (nullable) {
            context.addRuntimeImport("tryGetHandle");
            return `tryGetHandle(${name})`;
        }
        context.addRuntimeImport("getHandle");
        return `getHandle(${name})`;
    }
    const type = context.library.typeOf(ref);
    if ((type?.kind === "carray" || type?.kind === "list") && isHandlePassing(context, type.element)) {
        context.addRuntimeImport("getHandle");
        return nullable ? `${name}?.map((item) => getHandle(item))` : `${name}.map((item) => getHandle(item))`;
    }
    if (type?.kind === "hashtable") {
        if (isHandlePassing(context, type.value)) {
            context.addRuntimeImport("tryGetHandle");
            return `${name} ? globalThis.Array.from(${name}).map(([k, v]) => [k, tryGetHandle(v)]) : null`;
        }
        return `${name} ? globalThis.Array.from(${name}) : null`;
    }
    return name;
};
