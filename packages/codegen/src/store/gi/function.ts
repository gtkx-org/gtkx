import { toCamelIdentifier } from "@gtkx/utils";
import type { GirFunction } from "../../gir/function.js";
import type { ModuleContext } from "../../writer/context.js";
import { tFn } from "../../analysis/descriptor.js";
import { hasUnmarshalableParam } from "../../analysis/param-capability.js";
import { inputParameters } from "../../analysis/param-structure.js";
import { arrayLiteral, renderBlock } from "../../writer/emit.js";
import { matchAsyncFinish } from "./async.js";
import { callableDoc } from "./callable-doc.js";
import {
    planCallArgs,
    renderMethodBody,
    renderMethodReturnType,
    renderMethodSignature,
    renderPromisifiedBody,
    renderPromisifiedSignature,
    renderReturnDescriptor,
} from "./method.js";

type NamespaceFinish = {
    fn: GirFunction;
    exportName: string;
};

type NamespaceFunctionOptions = {
    context: ModuleContext;
    fn: GirFunction;
    finish: NamespaceFinish | undefined;
    exportName: string;
    bindingName: string;
};

const DESCRIPTOR_FREE_PROPERTY_SPEC_FACTORIES: Set<string> = new Set([
    "g_param_spec_boolean",
    "g_param_spec_char",
    "g_param_spec_double",
    "g_param_spec_enum",
    "g_param_spec_flags",
    "g_param_spec_float",
    "g_param_spec_gtype",
    "g_param_spec_int",
    "g_param_spec_int64",
    "g_param_spec_long",
    "g_param_spec_object",
    "g_param_spec_param",
    "g_param_spec_string",
    "g_param_spec_uchar",
    "g_param_spec_uint",
    "g_param_spec_uint64",
    "g_param_spec_ulong",
    "g_param_spec_variant",
]);

const CALLBACK_OWNER_FACTORIES: Set<string> = new Set(["gtk_custom_layout_new"]);

const renderFnExpression = (context: ModuleContext, fn: GirFunction): string | undefined => {
    if (fn.cIdentifier === undefined) {
        return undefined;
    }

    const library = context.namespace.sharedLibrary;

    if (library === undefined) {
        return undefined;
    }

    context.addRuntimeImport("t");
    const params = planCallArgs(context, fn).map((arg) => arg.paramLiteral);
    const returnPlan = renderReturnDescriptor(context, fn);

    return tFn(library, fn.cIdentifier, {
        args: arrayLiteral(params),
        returns: returnPlan.descriptor,
        isReturnSkipped: returnPlan.isSkipped,
        isReturnUnpacked: returnPlan.isUnpacked,
        canThrow: fn.throws,
        returnsCallbackOwner: CALLBACK_OWNER_FACTORIES.has(fn.cIdentifier),
    });
};

const isEmittableNamespaceFunction = (context: ModuleContext, fn: GirFunction): boolean =>
    fn.introspectable &&
    fn.shadowedBy === undefined &&
    fn.cIdentifier !== undefined &&
    !hasUnmarshalableParam(context, fn);

type EnumStaticFunction = {
    name: string;
    exportName: string;
    fn: GirFunction;
};

/**
 * Namespace functions GIR moves onto an enumeration or error domain, which become its statics under
 * the member name, as in GJS, while keeping their namespace export.
 */
const enumStaticFunctions = (context: ModuleContext, enumName: string): EnumStaticFunction[] => {
    const statics: EnumStaticFunction[] = [];

    for (const fn of context.namespace.functions) {
        const [typeName, memberName] = fn.movedTo?.split(".") ?? [];
        const cIdentifier = fn.cIdentifier;

        if (
            typeName !== enumName ||
            memberName === undefined ||
            cIdentifier === undefined ||
            context.namespace.sharedLibrary === undefined ||
            !isEmittableNamespaceFunction(context, fn)
        ) {
            continue;
        }

        const exportName = namespaceFunctionExportName(cIdentifier, fn.name, context.namespace.cSymbolPrefixes);

        if (exportName.length > 0) {
            statics.push({ name: toCamelIdentifier(memberName), exportName, fn });
        }
    }

    return statics;
};

const generateNamespaceFunction = (context: ModuleContext, fn: GirFunction): void => {
    if (!isEmittableNamespaceFunction(context, fn)) {
        return;
    }

    const expression = renderFnExpression(context, fn);

    if (expression === undefined) {
        return;
    }

    const cIdentifier = fn.cIdentifier;

    if (cIdentifier === undefined) {
        return;
    }

    const exportName = namespaceFunctionExportName(cIdentifier, fn.name, context.namespace.cSymbolPrefixes);

    if (exportName.length === 0) {
        return;
    }

    const bindingName = namespaceBindingName(cIdentifier, exportName);
    context.module.appendBinding(`const ${bindingName} = ${expression};`, cIdentifier);
    const finish = matchNamespaceFinish(context, fn);
    const declaration = renderNamespaceFunctionDeclaration({ context, fn, finish, exportName, bindingName });
    const doc = callableDoc(context, fn, { finishFn: finish?.fn });
    context.declare({ name: exportName, code: `${doc}${declaration}` });
    appendBootstrapRegistration(context, fn, exportName);
};

const namespaceBindingName = (cIdentifier: string, exportName: string): string => {
    const bindingName = toCamelIdentifier(cIdentifier);

    return bindingName === exportName ? `_${bindingName}` : bindingName;
};

const matchNamespaceFinish = (context: ModuleContext, fn: GirFunction): NamespaceFinish | undefined => {
    const finishFn = matchAsyncFinish(context.library, fn, context.namespace.functions);
    const cIdentifier = finishFn?.cIdentifier;

    if (finishFn === undefined || cIdentifier === undefined || !isEmittableNamespaceFunction(context, finishFn)) {
        return undefined;
    }

    return {
        fn: finishFn,
        exportName: namespaceFunctionExportName(cIdentifier, finishFn.name, context.namespace.cSymbolPrefixes),
    };
};

const renderPromisifiedNamespaceFunction = (options: NamespaceFunctionOptions, finish: NamespaceFinish): string => {
    const { context, fn, exportName, bindingName } = options;
    const { signature, returnType } = renderPromisifiedSignature(context, fn, finish.fn);
    const body = renderPromisifiedBody(context, fn, { fn: finish.fn, expression: finish.exportName }, bindingName);

    return renderBlock(`export function ${exportName}(${signature}): ${returnType}`, body);
};

const renderNamespaceFunctionDeclaration = (options: NamespaceFunctionOptions): string => {
    const { context, fn, finish, exportName, bindingName } = options;

    if (finish !== undefined) {
        return renderPromisifiedNamespaceFunction(options, finish);
    }

    const signature = renderMethodSignature(context, fn);
    const renderedReturnType = renderMethodReturnType(context, fn);
    const descriptorFreeSpec = DESCRIPTOR_FREE_PROPERTY_SPEC_FACTORIES.has(fn.cIdentifier ?? "")
        ? context.addRuntimeInternalTypeImport("DescriptorFreePropertySpec")
        : undefined;
    const returnType =
        descriptorFreeSpec === undefined ? renderedReturnType : `${descriptorFreeSpec}<${renderedReturnType}>`;
    const body = renderMethodBody(context, fn, { bindingExpression: bindingName, returnTypeOverride: returnType });

    return renderBlock(`export function ${exportName}(${signature}): ${returnType}`, body);
};

const namespaceFunctionExportName = (cIdentifier: string, girName: string, symbolPrefixes: string[]): string => {
    if (girName.length > 0) {
        return toCamelIdentifier(girName);
    }

    const stripped = stripLongestPrefix(cIdentifier, symbolPrefixes);

    return toCamelIdentifier(stripped);
};

const stripLongestPrefix = (input: string, prefixes: string[]): string => {
    let best = "";

    for (const prefix of prefixes) {
        const candidate = `${prefix}_`;

        if (input.startsWith(candidate) && candidate.length > best.length) {
            best = candidate;
        }
    }

    return best.length === 0 ? input : input.slice(best.length);
};

const appendInitBootstrap = (context: ModuleContext, exportName: string): void => {
    context.addBootstrapCall(`${exportName}();`, { moduleExports: [exportName] });
};

const isCallableWithoutArguments = (context: ModuleContext, fn: GirFunction): boolean =>
    inputParameters(context.library, fn).every(({ parameter }) => parameter.optional);

const appendBootstrapRegistration = (context: ModuleContext, fn: GirFunction, exportName: string): void => {
    if (fn.name === "init" && isCallableWithoutArguments(context, fn)) {
        appendInitBootstrap(context, exportName);
    }
};

export {
    enumStaticFunctions,
    type EnumStaticFunction,
    renderFnExpression,
    generateNamespaceFunction,
    isEmittableNamespaceFunction,
    namespaceFunctionExportName,
};
