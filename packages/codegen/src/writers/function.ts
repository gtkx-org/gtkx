import { quote } from "@gtkx/utils";
import type { ModuleContext } from "../dsl/context.js";
import { arrayLiteral, indent, joinArgs } from "../dsl/emit.js";
import { namespaceFunctionExportName } from "../dsl/identifier.js";
import type { GirFunction } from "../gir/function.js";
import type { GirNamespace } from "../gir/namespace.js";
import type { GirParameter } from "../gir/parameter.js";
import { callableReferencesClassStruct } from "./class-struct-record.js";
import { renderMethodBody, renderMethodReturnType, renderMethodSignature } from "./method.js";
import { closureAndDestroyIndices, needsRefArg } from "./param-classify.js";
import { renderFfiType, renderSelfFfiType, renderTrampolineType } from "./value.js";

/**
 * Renders the FFI argument list for a callable, as a TypeScript array
 * literal suitable as the third argument to `t.fn(...)`.
 *
 * Includes the instance parameter (if any), every regular parameter, and
 * the implicit `GError**` ref when `throws=1`.
 *
 * @param context - The module context
 * @param fn - The callable
 */
const renderArgsLiteral = (context: ModuleContext, fn: GirFunction): string => {
    const args: string[] = [];
    const instanceOffset = fn.instance === undefined ? 0 : 1;
    if (fn.instance !== undefined) {
        context.addRuntimeImport("t");
        args.push(`{ type: ${renderSelfFfiType(context, fn.instance)} }`);
    }
    const closureIndices = closureAndDestroyIndices(fn);
    fn.parameters.forEach((parameter, index) => {
        if (parameter.isVarargs) return;
        if (closureIndices.has(index)) return;
        const optional = parameter.direction === "in" && (parameter.nullable || parameter.optional);
        args.push(argLiteral(context, parameter, optional, instanceOffset));
    });
    if (fn.throws) {
        context.addRuntimeImport("t");
        args.push(`{ type: t.ref(t.boxed("GError", "full", "libgobject-2.0.so.0", "g_error_get_type")) }`);
    }
    return arrayLiteral(args);
};

const argLiteral = (
    context: ModuleContext,
    parameter: GirParameter,
    optional: boolean,
    instanceOffset: number,
): string => {
    const trampoline = renderTrampolineType(context, parameter.type, parameter);
    const inner = trampoline ?? renderFfiType(context, parameter.type, parameter.transferOwnership, instanceOffset);
    const refWrapped = needsRefArg(context, parameter);
    const expression = refWrapped ? `t.ref(${inner})` : inner;
    return optional && !refWrapped ? `{ type: ${expression}, optional: true }` : `{ type: ${expression} }`;
};

/**
 * Renders the `t.fn(library, symbol, args, returnType)` expression for a
 * callable. Returns `undefined` when the callable cannot be bound (no C
 * identifier or missing namespace shared-library).
 *
 * @param context - The module context
 * @param fn - The callable
 */
export const renderFnExpression = (context: ModuleContext, fn: GirFunction): string | undefined => {
    if (fn.cIdentifier === undefined) return undefined;
    const library = context.namespace.sharedLibrary;
    if (library === undefined) return undefined;
    context.addRuntimeImport("t");
    const args = renderArgsLiteral(context, fn);
    const returnType = renderFfiType(
        context,
        fn.returnValue.type,
        fn.returnValue.transferOwnership,
        fn.instance === undefined ? 0 : 1,
    );
    return `t.fn(${joinArgs([quote(library), quote(fn.cIdentifier), args, returnType])})`;
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
    const bindingName = fn.cIdentifier;
    if (bindingName === undefined) return;
    context.module.appendBinding(`const ${bindingName} = ${expression};`, bindingName);

    const exportName = namespaceFunctionExportName(bindingName, fn.name, context.namespace.cSymbolPrefixes);
    const signature = renderMethodSignature(context, fn);
    const returnType = renderMethodReturnType(context, fn);
    const body = renderMethodBody(context, fn, { bindingExpression: bindingName, isStatic: true });
    context.module.appendDeclaration(
        `export function ${exportName}(${signature}): ${returnType} {\n${indent(body, 1)}\n}`,
    );
};

/**
 * Emits a namespace's self-bootstrap statements as module-load side effects:
 * a call to its zero-argument `init` entry point and a `whenStopped`
 * registration for its zero-argument `finalize` entry point.
 *
 * GTK-style libraries expose top-level `init`/`finalize` functions (`gtk_init`,
 * `adw_init`, `gtk_source_finalize`, …). Calling `init()` as the module is
 * imported initializes the library's runtime before any of its types are
 * touched — without it a `Gdk` display lookup can run before `gtk_init`.
 * Deferring `finalize` to `whenStopped` runs it during shutdown.
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
            context.module.imports.addNamed("@gtkx/ffi", "whenStopped");
            context.module.appendRegistration(`whenStopped().then(${exportName});`);
        }
    }
};
