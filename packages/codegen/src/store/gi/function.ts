import { toCamelIdentifier } from "@gtkx/utils";
import type { GirFunction } from "../../gir/function.js";
import type { GirNamespace } from "../../gir/namespace.js";
import type { ModuleContext } from "../../writer/context.js";
import { tFn } from "../../analysis/descriptor.js";
import { hasCallerAllocatedArrayLength } from "../../analysis/param-structure.js";
import { renderJsDoc } from "../../writer/doc.js";
import { arrayLiteral, renderBlock } from "../../writer/emit.js";
import { matchAsyncFinish } from "./async.js";
import {
    planCallArgs,
    renderMethodBody,
    renderMethodReturnType,
    renderMethodSignature,
    renderPromisifiedBody,
    renderPromisifiedSignature,
    renderReturnDescriptor,
} from "./method.js";

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
    const ret = renderReturnDescriptor(context, fn);

    return tFn(library, fn.cIdentifier, { args: arrayLiteral(params), returns: ret, canThrow: fn.throws });
};

const isMovedOntoEmittedMember = (context: ModuleContext, fn: GirFunction): boolean => {
    const [typeName, memberName] = fn.movedTo?.split(".") ?? [];

    if (typeName === undefined || memberName === undefined) {
        return false;
    }

    const resolved = context.library.resolveType(context.namespace.name, typeName);

    if (resolved?.kind !== "class" && resolved?.kind !== "interface" && resolved?.kind !== "record") {
        return false;
    }

    const members = [...resolved.value.methods, ...resolved.value.functions, ...resolved.value.constructors];

    return members.some((member) => member.name === memberName);
};

const canEmitNamespaceFunction = (context: ModuleContext, fn: GirFunction): boolean =>
    fn.introspectable &&
    !isMovedOntoEmittedMember(context, fn) &&
    fn.shadowedBy === undefined &&
    fn.cIdentifier !== undefined &&
    !hasCallerAllocatedArrayLength(context.library, fn);

const generateNamespaceFunction = (context: ModuleContext, fn: GirFunction): void => {
    if (!canEmitNamespaceFunction(context, fn)) {
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

    const bindingName = toCamelIdentifier(cIdentifier);
    context.module.appendBinding(`const ${bindingName} = ${expression};`, cIdentifier);
    const exportName = namespaceFunctionExportName(cIdentifier, fn.name, context.namespace.cSymbolPrefixes);
    const declaration = renderNamespaceFunctionDeclaration(context, fn, exportName, bindingName);
    context.module.appendDeclaration(`${renderJsDoc(fn.doc)}${declaration}`);
};

const renderNamespaceFunctionDeclaration = (
    context: ModuleContext,
    fn: GirFunction,
    exportName: string,
    bindingName: string,
): string => {
    const finishFn = matchAsyncFinish(context.library, fn, context.namespace.functions);
    const finishCIdentifier = finishFn?.cIdentifier;

    if (finishFn !== undefined && finishCIdentifier !== undefined && canEmitNamespaceFunction(context, finishFn)) {
        const finishExport = namespaceFunctionExportName(
            finishCIdentifier,
            finishFn.name,
            context.namespace.cSymbolPrefixes,
        );

        const { signature, returnType } = renderPromisifiedSignature(context, fn, finishFn);
        const body = renderPromisifiedBody(context, fn, finishExport, bindingName);

        return renderBlock(`export function ${exportName}(${signature}): ${returnType}`, body);
    }

    const signature = renderMethodSignature(context, fn);
    const returnType = renderMethodReturnType(context, fn);
    const body = renderMethodBody(context, fn, { bindingExpression: bindingName });

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

const isBootstrapFunction = (fn: GirFunction): boolean =>
    fn.parameters.length === 0 && fn.introspectable && fn.shadowedBy === undefined && fn.cIdentifier !== undefined;

const appendBootstrapRegistration = (context: ModuleContext, fn: GirFunction, exportName: string): void => {
    if (fn.name === "init") {
        context.module.appendRegistration(`${exportName}();`);

        return;
    }

    if (fn.name === "finalize") {
        context.addRuntimeImport("onExit");
        context.module.appendRegistration(`onExit(${exportName});`);
    }
};

const generateNamespaceBootstrap = (context: ModuleContext, namespace: GirNamespace): void => {
    for (const fn of namespace.functions) {
        if (!isBootstrapFunction(fn) || fn.cIdentifier === undefined) {
            continue;
        }

        const exportName = namespaceFunctionExportName(fn.cIdentifier, fn.name, context.namespace.cSymbolPrefixes);
        appendBootstrapRegistration(context, fn, exportName);
    }
};

export { renderFnExpression, generateNamespaceFunction, namespaceFunctionExportName, generateNamespaceBootstrap };
