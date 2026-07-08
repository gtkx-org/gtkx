import { toCamelIdentifier } from "@gtkx/utils";
import { tFn } from "../../analysis/descriptor.js";
import { hasCallerAllocatedArrayLength } from "../../analysis/param-structure.js";
import type { GirFunction } from "../../gir/function.js";
import type { GirNamespace } from "../../gir/namespace.js";
import type { ModuleContext } from "../../writer/context.js";
import { renderJsDoc } from "../../writer/doc.js";
import { arrayLiteral, renderBlock } from "../../writer/emit.js";
import { callableReferencesClassStruct } from "./class-struct-record.js";
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

export const generateNamespaceFunction = (context: ModuleContext, fn: GirFunction): void => {
    if (!fn.introspectable) return;
    if (fn.shadowedBy !== undefined) return;
    if (callableReferencesClassStruct(context, fn)) return;
    if (hasCallerAllocatedArrayLength(context.library, fn)) return;
    const expression = renderFnExpression(context, fn);
    if (expression === undefined) return;
    const cIdentifier = fn.cIdentifier;
    if (cIdentifier === undefined) return;
    const bindingName = toCamelIdentifier(cIdentifier);
    context.module.appendBinding(`const ${bindingName} = ${expression};`, cIdentifier);

    const exportName = namespaceFunctionExportName(cIdentifier, fn.name, context.namespace.cSymbolPrefixes);
    const signature = renderMethodSignature(context, fn);
    const returnType = renderMethodReturnType(context, fn);
    const body = renderMethodBody(context, fn, { bindingExpression: bindingName });
    context.module.appendDeclaration(
        `${renderJsDoc(fn.doc)}${renderBlock(`export function ${exportName}(${signature}): ${returnType}`, body)}`,
    );
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

export const generateNamespaceBootstrap = (context: ModuleContext, namespace: GirNamespace): void => {
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
