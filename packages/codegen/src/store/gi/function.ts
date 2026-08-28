import { toCamelIdentifier } from "@gtkx/utils";
import type { GirFunction } from "../../gir/function.js";
import type { ModuleContext } from "../../writer/context.js";
import { tFn } from "../../analysis/descriptor.js";
import { hasUnmarshalableParam } from "../../analysis/param-capability.js";
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
    });
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
    !hasUnmarshalableParam(context, fn);

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

    if (finishFn === undefined || cIdentifier === undefined || !canEmitNamespaceFunction(context, finishFn)) {
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

const appendInitBootstrap = (context: ModuleContext, exportName: string): void => {
    if (context.isTreeShaken) {
        context.addBootstrapCall(`${exportName}();`, { moduleExports: [exportName] });
    } else {
        context.module.appendRegistration(`${exportName}();`, [exportName]);
    }
};

const appendFinalizeBootstrap = (context: ModuleContext, exportName: string): void => {
    if (context.isTreeShaken) {
        context.addBootstrapCall(`onExit(${exportName});`, {
            moduleExports: [exportName],
            runtimeImports: ["onExit"],
        });
    } else {
        context.addRuntimeImport("onExit");
        context.module.appendRegistration(`onExit(${exportName});`, [exportName]);
    }
};

const appendBootstrapRegistration = (context: ModuleContext, fn: GirFunction, exportName: string): void => {
    if (fn.parameters.length > 0) {
        return;
    }

    if (fn.name === "init") {
        appendInitBootstrap(context, exportName);

        return;
    }

    if (fn.name === "finalize") {
        appendFinalizeBootstrap(context, exportName);
    }
};

export { renderFnExpression, generateNamespaceFunction, namespaceFunctionExportName };
