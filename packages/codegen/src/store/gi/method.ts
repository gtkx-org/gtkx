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
import { isCollectibleCallerOut, isHandlePassing, passesHandleInPlace } from "./param-marshal.js";

export const methodExportName = (fn: GirFunction): string => toCamelCase(fn.name);

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
        const annotation = renderTsType(context, parameter.type, parameter.nullable);
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
    const leadingArguments = leadingExpressions.length > 0 ? `, ${leadingExpressions.join(", ")}` : "";
    return `return promisify(${bindingExpression}, this.${finishMember}.bind(this), ${cancellableExpression}${leadingArguments});`;
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
    const instanceOffset = fn.instance === undefined ? 0 : 1;
    const lengthFor = arrayLengthSources(context.library, fn);
    const closureIndices = closureAndDestroyIndices(fn);
    const folded = foldedLengthIndices(context.library, fn);
    fn.parameters.forEach((parameter, index) => {
        if (parameter.isVarargs) return;
        if (closureIndices.has(index)) return;
        if (isOutParameter(parameter)) {
            plan.push(planOutParam(context, parameter, instanceOffset, folded.has(index)));
            return;
        }
        if (isCallerAllocatedOut(parameter)) {
            plan.push(planCallerOut(context, parameter, instanceOffset));
            return;
        }
        if (isInoutParameter(parameter)) {
            plan.push(planInoutParam(context, parameter, { index, instanceOffset, consumed: folded.has(index) }));
            return;
        }
        const sourceIndex = lengthFor.get(index);
        if (sourceIndex !== undefined) {
            const source = fn.parameters[sourceIndex];
            const descriptor = renderDescriptor(context, parameter.type, parameter.transferOwnership, {
                argIndexOffset: instanceOffset,
            });
            plan.push({
                paramLiteral: paramDescriptorLiteral(descriptor, {}),
                inputExpr: source === undefined ? "0" : `${parameterIdentifier(source, sourceIndex)}.length`,
            });
            return;
        }
        plan.push(planInParam(context, parameter, index, instanceOffset));
    });
    return plan;
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

const planCallerOut = (context: ModuleContext, parameter: GirParameter, instanceOffset: number): CallArgPlan => {
    const descriptor = renderDescriptor(context, parameter.type, "none", { argIndexOffset: instanceOffset });
    const name = parameter.type === undefined ? undefined : context.library.nameOf(parameter.type);
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
    options: { index: number; instanceOffset: number; consumed: boolean },
): CallArgPlan => {
    const { index, instanceOffset, consumed } = options;
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
        inputExpr: parameterCallExpression(context, parameter, index),
    };
};

const planInParam = (
    context: ModuleContext,
    parameter: GirParameter,
    index: number,
    instanceOffset: number,
): CallArgPlan => {
    const callback = renderCallbackType(context, parameter.type, parameter);
    const descriptor =
        callback ??
        renderDescriptor(context, parameter.type, parameter.transferOwnership, { argIndexOffset: instanceOffset });
    return {
        paramLiteral: paramDescriptorLiteral(descriptor, {}),
        inputExpr: parameterCallExpression(context, parameter, index),
    };
};

const parameterCallExpression = (context: ModuleContext, parameter: GirParameter, index: number): string => {
    const name = parameterIdentifier(parameter, index);
    const ref = parameter.type;
    if (ref === undefined) return name;
    const nullable = parameter.nullable || parameter.optional;
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
