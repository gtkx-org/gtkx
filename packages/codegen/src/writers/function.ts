import type { ModuleContext } from "../dsl/context.js";
import { arrayLiteral, indent, joinArgs, quote } from "../dsl/emit.js";
import { namespaceFunctionExportName } from "../dsl/identifier.js";
import type { GirFunction } from "../gir/function.js";
import type { GirNamespace } from "../gir/namespace.js";
import type { GirParameter } from "../gir/parameter.js";
import { callableReferencesClassStruct } from "./class-struct-record.js";
import {
    closureAndDestroyIndices,
    needsRefArg,
    writeMethodBody,
    writeMethodReturnType,
    writeMethodSignature,
} from "./method.js";
import { writeFfiType, writeSelfFfiType, writeTrampolineType } from "./value.js";

/**
 * Renders the FFI argument list for a callable, as a TypeScript array
 * literal suitable as the third argument to `t.fn(...)`.
 *
 * Includes the instance parameter (if any), every regular parameter, and
 * the implicit `GError**` ref when `throws=1`.
 *
 * @param ctx - The module context
 * @param fn - The callable
 */
export const writeArgsLiteral = (ctx: ModuleContext, fn: GirFunction): string => {
    const args: string[] = [];
    const instanceOffset = fn.instance === undefined ? 0 : 1;
    if (fn.instance !== undefined) {
        ctx.addRuntimeImport("t");
        args.push(`{ type: ${writeSelfFfiType(ctx, fn.instance)} }`);
    }
    const closureIndices = closureAndDestroyIndices(fn);
    fn.parameters.forEach((parameter, index) => {
        if (parameter.isVarargs) return;
        if (closureIndices.has(index)) return;
        const optional = parameter.direction === "in" && (parameter.nullable || parameter.optional);
        args.push(argLiteral(ctx, parameter, optional, instanceOffset));
    });
    if (fn.throws) {
        ctx.addRuntimeImport("t");
        args.push(`{ type: t.ref(t.boxed("GError", "full", "libgobject-2.0.so.0", "g_error_get_type")) }`);
    }
    return arrayLiteral(args);
};

const argLiteral = (ctx: ModuleContext, parameter: GirParameter, optional: boolean, instanceOffset: number): string => {
    const trampoline = writeTrampolineType(ctx, parameter.type, parameter);
    const inner = trampoline ?? writeFfiType(ctx, parameter.type, parameter.transferOwnership, instanceOffset);
    const refWrapped = needsRefArg(ctx, parameter);
    const expression = refWrapped ? `t.ref(${inner})` : inner;
    return optional && !refWrapped ? `{ type: ${expression}, optional: true }` : `{ type: ${expression} }`;
};

/**
 * Renders the `t.fn(library, symbol, args, returnType)` expression for a
 * callable. Returns `undefined` when the callable cannot be bound (no C
 * identifier or missing namespace shared-library).
 *
 * @param ctx - The module context
 * @param fn - The callable
 */
export const writeFnExpression = (ctx: ModuleContext, fn: GirFunction): string | undefined => {
    if (fn.cIdentifier === undefined) return undefined;
    const library = ctx.namespace.sharedLibrary;
    if (library === undefined) return undefined;
    ctx.addRuntimeImport("t");
    const args = writeArgsLiteral(ctx, fn);
    const returnType = writeFfiType(
        ctx,
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
 * Silently skipped when {@link writeFnExpression} cannot bind the callable
 * (e.g. macros, unintrospectable signatures) or when the GIR marks the
 * callable as `introspectable="0"`.
 *
 * @param ctx - The module context
 * @param fn - The callable
 */
export const emitNamespaceFunction = (ctx: ModuleContext, fn: GirFunction): void => {
    if (!fn.introspectable) return;
    if (fn.shadowedBy !== undefined) return;
    if (callableReferencesClassStruct(ctx, fn)) return;
    const expression = writeFnExpression(ctx, fn);
    if (expression === undefined) return;
    const bindingName = fn.cIdentifier;
    if (bindingName === undefined) return;
    ctx.module.appendBinding(`const ${bindingName} = ${expression};`, bindingName);

    const exportName = namespaceFunctionExportName(bindingName, fn.name, ctx.namespace.cSymbolPrefixes);
    const signature = writeMethodSignature(ctx, fn);
    const returnType = writeMethodReturnType(ctx, fn);
    const body = writeMethodBody(ctx, fn, { bindingExpression: bindingName, isStatic: true });
    ctx.module.appendDeclaration(`export function ${exportName}(${signature}): ${returnType} {\n${indent(body, 1)}\n}`);
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
 * @param ctx - The module context
 * @param namespace - The namespace being generated
 */
export const emitNamespaceBootstrap = (ctx: ModuleContext, namespace: GirNamespace): void => {
    for (const fn of namespace.functions) {
        if (fn.parameters.length > 0) continue;
        if (!fn.introspectable || fn.shadowedBy !== undefined || fn.cIdentifier === undefined) continue;
        const exportName = namespaceFunctionExportName(fn.cIdentifier, fn.name, ctx.namespace.cSymbolPrefixes);
        if (fn.name === "init") {
            ctx.module.appendRegistration(`${exportName}();`);
        } else if (fn.name === "finalize") {
            ctx.module.imports.addNamed("../../lifecycle.js", "whenStopped");
            ctx.module.appendRegistration(`whenStopped().then(${exportName});`);
        }
    }
};
