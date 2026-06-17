import { quote } from "@gtkx/utils";
import type { ModuleContext } from "../dsl/context.js";
import { arrayLiteral, indent } from "../dsl/emit.js";
import { bindingIdentifier, namespaceFunctionExportName } from "../dsl/identifier.js";
import type { GirFunction } from "../gir/function.js";
import type { GirNamespace } from "../gir/namespace.js";
import { callableReferencesClassStruct } from "./class-struct-record.js";
import {
    planCallArgs,
    renderMethodBody,
    renderMethodReturnType,
    renderMethodSignature,
    renderReturnDescriptor,
} from "./method.js";

/**
 * Renders the `t.fn(library, symbol, params, return, options?)` expression
 * for a callable. Returns `undefined` when the callable cannot be bound (no C
 * identifier or missing namespace shared-library).
 *
 * The parameter array carries each argument's FFI type and its role (out or
 * inout, optionally caller-allocated), the return descriptor carries the
 * primary return's FFI type and wrapper class, and a throwing callable adds the
 * `throws` option; the bound callable owns out-parameter tupling, `GError`
 * handling, and result wrapping at call time.
 *
 * @param context - The module context
 * @param fn - The callable
 */
export const renderFnExpression = (context: ModuleContext, fn: GirFunction): string | undefined => {
    if (fn.cIdentifier === undefined) return undefined;
    const library = context.namespace.sharedLibrary;
    if (library === undefined) return undefined;
    context.addRuntimeImport("t");
    const params = planCallArgs(context, fn).map((arg) => arg.paramLiteral);
    const ret = renderReturnDescriptor(context, fn);
    const options = fn.throws ? ", { throws: true }" : "";
    return `t.fn(${quote(library)}, ${quote(fn.cIdentifier)}, ${arrayLiteral(params)}, ${ret}${options})`;
};

/**
 * Emits both the bound `const fooBinding = t.fn(...)` and the
 * `export function camelName(...)` wrapper for a namespace-level callable.
 *
 * Silently skipped when {@link renderFnExpression} cannot bind the callable
 * (e.g. macros, unintrospectable signatures) or when the GIR marks the
 * callable as `introspectable="0"`.
 *
 * @param context - The module context
 * @param fn - The callable
 */
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
    const body = renderMethodBody(context, fn, { bindingExpression: bindingName, isStatic: true });
    context.module.appendDeclaration(
        `export function ${exportName}(${signature}): ${returnType} {\n${indent(body, 1)}\n}`,
    );
};

/**
 * Emits a namespace's self-bootstrap statements as module-load side effects:
 * a call to its zero-argument `init` entry point and an `onExit` registration
 * for its zero-argument `finalize` entry point.
 *
 * GTK-style libraries expose top-level `init`/`finalize` functions (`gtk_init`,
 * `adw_init`, `gtk_source_finalize`, …). Calling `init()` as the module is
 * imported initializes the library's runtime before any of its types are
 * touched — without it a `Gdk` display lookup can run before `gtk_init`.
 * Registering `finalize` with `onExit` runs it during shutdown.
 *
 * @param context - The module context
 * @param namespace - The namespace being generated
 */
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
