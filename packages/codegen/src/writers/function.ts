import type { ModuleContext } from "../dsl/context.js";
import { arrayLiteral, renderBlock } from "../dsl/emit.js";
import { bindingIdentifier, namespaceFunctionExportName } from "../dsl/identifier.js";
import type { GirFunction } from "../gir/function.js";
import type { GirNamespace } from "../gir/namespace.js";
import { callableReferencesClassStruct } from "./class-struct-record.js";
import { tFn } from "./descriptor.js";
import {
    planCallArgs,
    renderMethodBody,
    renderMethodReturnType,
    renderMethodSignature,
    renderReturnDescriptor,
} from "./method.js";

export const renderFnExpression = (context: ModuleContext, fn: GirFunction): string | undefined => {
    if (fn.cIdentifier === undefined) return undefined;
    const library = context.namespace.sharedLibrary;
    if (library === undefined) return undefined;
    context.addRuntimeImport("t");
    const params = planCallArgs(context, fn).map((arg) => arg.paramLiteral);
    const ret = renderReturnDescriptor(context, fn);
    return tFn(library, fn.cIdentifier, { args: arrayLiteral(params), returns: ret, throws: fn.throws });
};

export const emitNamespaceFunction = (context: ModuleContext, fn: GirFunction): void => {
    if (!fn.introspectable) return;
    if (fn.shadowedBy !== undefined) return;
    if (callableReferencesClassStruct(context, fn)) return;
    const expression = renderFnExpression(context, fn);
    if (expression === undefined) return;
    const cIdentifier = fn.cIdentifier;
    if (cIdentifier === undefined) return;
    const bindingName = bindingIdentifier(cIdentifier);
    context.module.appendBinding(`const ${bindingName} = ${expression};`, cIdentifier);

    const exportName = namespaceFunctionExportName(cIdentifier, fn.name, context.namespace.cSymbolPrefixes);
    const signature = renderMethodSignature(context, fn);
    const returnType = renderMethodReturnType(context, fn);
    const body = renderMethodBody(context, fn, { bindingExpression: bindingName });
    context.module.appendDeclaration(renderBlock(`export function ${exportName}(${signature}): ${returnType}`, body));
};

export const emitNamespaceBootstrap = (context: ModuleContext, namespace: GirNamespace): void => {
    for (const fn of namespace.functions) {
        if (fn.parameters.length > 0) continue;
        if (!fn.introspectable || fn.shadowedBy !== undefined || fn.cIdentifier === undefined) continue;
        const exportName = namespaceFunctionExportName(fn.cIdentifier, fn.name, context.namespace.cSymbolPrefixes);
        if (fn.name === "init") {
            context.module.appendRegistration(`${exportName}();`);
        } else if (fn.name === "finalize") {
            context.addRuntimeImport("onExit");
            context.module.appendRegistration(`onExit(${exportName});`);
        }
    }
};
