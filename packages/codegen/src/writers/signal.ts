import { quote, toCamelCase, toPascalCase } from "@gtkx/utils";
import type { ModuleContext } from "../dsl/context.js";
import { indent } from "../dsl/emit.js";
import type { GirClass } from "../gir/class.js";
import type { GirParameter } from "../gir/parameter.js";
import { isOutParameter } from "../gir/parameter.js";
import { qualifyTypeRef } from "../gir/qualify.js";
import type { GirSignal } from "../gir/signal.js";
import type { GirTypeRef, PrimitiveTypeRef } from "../gir/type-ref.js";
import { forEachAncestor, resolveImplementedInterface } from "./inheritance.js";
import { isHandlePassing, planTrampolineArgs, renderTupleWriteback } from "./method.js";
import { isCellInout, writeFfiType } from "./value.js";

const SIGNAL_HANDLER_TYPE = "(...args: any[]) => any";

/**
 * A signal together with the namespace its parameter and return references
 * belong to. Own signals carry the class's namespace; signals flattened from
 * an implemented interface carry the interface's namespace so their references
 * resolve correctly.
 */
type CollectedSignal = {
    readonly signal: GirSignal;
    readonly namespaceName: string;
};

/**
 * Renders the `connect` and `emit` instance methods for a class that owns or
 * inherits-by-interface at least one signal.
 *
 * Both delegate to the runtime signal dispatcher (`connectSignal` /
 * `emitSignal`) and route unknown-signal lookups up the class chain via
 * `super.connect` / `super.emit`. The root `GObject.Object` emits the same
 * shapes without a parent fallback because it bottoms out the hierarchy.
 *
 * Returns an empty array when the class contributes no signals of its own.
 *
 * @param ctx - The module context
 * @param klass - The class whose signal methods to render
 */
export const renderSignalMembers = (ctx: ModuleContext, klass: GirClass): readonly string[] => {
    if (klass.glibGetType === undefined) return [];
    if (collectClassSignals(ctx, klass).length === 0) return [];
    ctx.addRuntimeImport("connectSignal");
    ctx.addRuntimeImport("emitSignal");
    const className = toPascalCase(klass.name);
    const isRootObject = ctx.namespace.name === "GObject" && klass.name === "Object";
    const connectBody = isRootObject
        ? `return connectSignal({ instance: this, cls: ${className} }, signal, handler, { after });`
        : `return connectSignal({ instance: this, cls: ${className} }, signal, handler, { after, parentConnect: (s, h, a) => super.connect(s, h, a) });`;
    const emitBody = isRootObject
        ? `emitSignal({ instance: this, cls: ${className} }, sigName, args);`
        : `emitSignal({ instance: this, cls: ${className} }, sigName, args, (s, ...a) => super.emit(s, ...a));`;
    return [
        `connect(signal: string, handler: ${SIGNAL_HANDLER_TYPE}, after?: boolean): number {\n    ${connectBody}\n}`,
        `emit(sigName: string, ...args: unknown[]): void {\n    ${emitBody}\n}`,
    ];
};

/**
 * Renders the `{ table: new Map([...]), gobject: { … } }` signal-registration
 * fragment for a class or interface descriptor's `signals` field, or
 * `undefined` when the type exposes no signals of its own.
 *
 * Each table entry carries the trampoline FFI descriptor used to connect a
 * handler, an `invoke` closure that marshals trampoline arguments into the user
 * handler, the per-parameter emit types, and the return-value `GType` resolver.
 * The `gobject` field supplies the `GObject` marshalling surface the runtime
 * emit path needs; the class's shared GType comes from the descriptor.
 *
 * @param ctx - The module context
 * @param klass - The class whose signals to bind
 */
export const renderSignalRegistration = (ctx: ModuleContext, klass: GirClass): string | undefined => {
    if (klass.glibGetType === undefined) return undefined;
    const signals = collectClassSignals(ctx, klass);
    if (signals.length === 0) return undefined;
    const entries = signals.map((collected) => renderSignalEntry(ctx, collected));
    const map = entries.length === 0 ? "[]" : `[\n${indent(entries.join(",\n"), 1)},\n]`;
    const gobject = renderGObjectSurface(ctx);
    const body = `table: new globalThis.Map(${map}),\ngobject: ${gobject},`;
    return `{\n${indent(body, 1)}\n}`;
};

const collectClassSignals = (ctx: ModuleContext, klass: GirClass): readonly CollectedSignal[] => {
    const inheritedNames = collectInheritedSignalNames(ctx, klass);
    const seen = new Set<string>();
    const result: CollectedSignal[] = [];
    for (const signal of klass.signals) {
        const name = toCamelCase(signal.name);
        if (inheritedNames.has(name) || seen.has(name)) continue;
        seen.add(name);
        result.push({ signal, namespaceName: ctx.namespace.name });
    }
    for (const implementName of klass.implements) {
        const iface = resolveImplementedInterface(ctx, implementName);
        if (iface === undefined) continue;
        for (const signal of iface.klass.signals) {
            const name = toCamelCase(signal.name);
            if (inheritedNames.has(name) || seen.has(name)) continue;
            seen.add(name);
            result.push({ signal, namespaceName: iface.namespaceName });
        }
    }
    return result;
};

const collectInheritedSignalNames = (ctx: ModuleContext, klass: GirClass): ReadonlySet<string> => {
    const names = new Set<string>();
    forEachAncestor(ctx, klass, (ancestor) => {
        for (const signal of ancestor.klass.signals) names.add(toCamelCase(signal.name));
        for (const implementName of ancestor.klass.implements) {
            const iface = resolveImplementedInterface(ctx, implementName, ancestor.namespaceName);
            if (iface === undefined) continue;
            for (const signal of iface.klass.signals) names.add(toCamelCase(signal.name));
        }
    });
    return names;
};

const renderSignalEntry = (ctx: ModuleContext, collected: CollectedSignal): string => {
    const { signal, namespaceName } = collected;
    const params = signal.parameters.filter((parameter) => !parameter.isVarargs);
    const paramFfi = params.map((parameter) =>
        writeFfiType(ctx, qualifyTypeRef(parameter.type, namespaceName), parameter.transferOwnership),
    );
    const trampolineParamFfi = params.map((parameter, index) =>
        isOutParameter(parameter) || isCellInout(ctx, parameter) ? `t.ref(${paramFfi[index]})` : paramFfi[index],
    );
    const returnRef = qualifyTypeRef(signal.returnValue.type, namespaceName);
    const isVoid = isVoidRef(returnRef);
    const returnFfi = isVoid ? "t.void" : writeFfiType(ctx, returnRef, signal.returnValue.transferOwnership);
    const trampolineArgs = ['t.object("borrowed")', ...trampolineParamFfi, "t.void"].join(", ");
    const trampoline = `t.trampoline([${trampolineArgs}], ${returnFfi}, { hasDestroy: true, userDataIndex: ${params.length + 1} })`;
    const invoke = renderInvokeClosure(ctx, collected, params, isVoid ? undefined : returnRef);
    const emitTypes = `[${paramFfi.join(", ")}]`;
    const returnGType = isVoid || returnRef === undefined ? "null" : `() => ${renderReturnGType(ctx, returnRef)}`;
    const body = [
        `trampoline: ${trampoline},`,
        `invoke: ${invoke},`,
        `emitTypes: ${emitTypes},`,
        `returnGType: ${returnGType},`,
    ].join("\n");
    return `[${quote(signal.name)}, {\n${indent(body, 1)}\n}]`;
};

const renderInvokeClosure = (
    ctx: ModuleContext,
    collected: CollectedSignal,
    params: readonly GirParameter[],
    returnRef: GirTypeRef | undefined,
): string => {
    const { namespaceName } = collected;
    const { callArgs, outArgIndices } = planTrampolineArgs(ctx, params, namespaceName, 1);
    if (outArgIndices.length === 0) {
        if (returnRef !== undefined && isHandlePassing(ctx, returnRef)) {
            ctx.addRuntimeImport("tryGetHandle");
            return `(handler, args) => {\n    const _result = handler(${callArgs});\n    return tryGetHandle(_result);\n}`;
        }
        return `(handler, args) => handler(${callArgs})`;
    }
    return renderOutParamInvoke(ctx, callArgs, outArgIndices, returnRef);
};

/**
 * Renders the invoke closure for a signal with out-parameters.
 *
 * The handler returns its results as the tuple {@link writeMethodReturnType}
 * describes (`[primary, ...outs]` when both exist, the scalar out alone for a
 * void return with a single out, or an out-only tuple otherwise). The shared
 * {@link renderTupleWriteback} destructures that tuple and writes each out
 * value into its trampoline cell's `value` slot — the native side flushes
 * those cells through the matching C out-pointers, so the tuple convention
 * stays entirely in generated code.
 *
 * @param ctx - The module context
 * @param callArgs - The rendered in-parameter call arguments
 * @param outArgIndices - Trampoline-arg indices of the out-parameter cells
 * @param returnRef - The signal's return type, or `undefined` for void
 */
const renderOutParamInvoke = (
    ctx: ModuleContext,
    callArgs: string,
    outArgIndices: readonly number[],
    returnRef: GirTypeRef | undefined,
): string => {
    const body = renderTupleWriteback(ctx, `handler(${callArgs})`, outArgIndices, returnRef);
    return `(handler, args) => {\n    ${body}\n}`;
};

const renderReturnGType = (ctx: ModuleContext, ref: GirTypeRef): string => {
    if (ref.kind === "primitive") {
        return `${typeFromNameReference(ctx)}(${quote(primitiveGTypeName(ref.category))})`;
    }
    if (ref.kind === "named") {
        const owner = ref.namespaceName ?? ctx.namespace.name;
        const resolved = ctx.repository.resolveNamed(owner, ref.typeName);
        if (resolved !== undefined && resolved.kind === "enum") {
            ctx.addRuntimeImport("call");
            ctx.addRuntimeImport("t");
            const lib = resolved.namespace.sharedLibrary ?? "";
            const getter = resolved.value.glibGetType ?? "";
            return `call(${quote(lib)}, ${quote(getter)}, [], t.uint64)`;
        }
        if (
            resolved !== undefined &&
            (resolved.kind === "class" || resolved.kind === "interface" || resolved.kind === "boxed")
        ) {
            const glibTypeName = glibTypeNameOf(resolved.value) ?? ref.typeName;
            return `${typeFromNameReference(ctx)}(${quote(glibTypeName)})`;
        }
    }
    return `${typeFromNameReference(ctx)}("GObject")`;
};

const isVoidRef = (ref: GirTypeRef | undefined): boolean =>
    ref === undefined || (ref.kind === "primitive" && ref.category === "void");

const glibTypeNameOf = (value: {
    readonly glibTypeName?: string | undefined;
    readonly cType?: string | undefined;
}): string | undefined => value.glibTypeName ?? value.cType;

const typeFromNameReference = (ctx: ModuleContext): string => {
    if (ctx.namespace.name === "GObject") return "typeFromName";
    const alias = ctx.addCrossNamespaceImport("GObject");
    return `${alias}.typeFromName`;
};

const renderGObjectSurface = (ctx: ModuleContext): string => {
    ctx.addValueFromFfiImport();
    if (ctx.namespace.name === "GObject") {
        return "{ Value, valueFromFfi, signalEmitv, signalLookup }";
    }
    const alias = ctx.addCrossNamespaceImport("GObject");
    return `{ Value: ${alias}.Value, valueFromFfi, signalEmitv: ${alias}.signalEmitv, signalLookup: ${alias}.signalLookup }`;
};

const primitiveGTypeName = (category: PrimitiveTypeRef["category"]): string => {
    switch (category) {
        case "boolean":
            return "gboolean";
        case "int8":
        case "int16":
        case "int32":
            return "gint";
        case "uint8":
        case "uint16":
        case "uint32":
        case "unichar":
            return "guint";
        case "int64":
            return "gint64";
        case "uint64":
        case "pointer":
            return "guint64";
        case "float32":
            return "gfloat";
        case "float64":
            return "gdouble";
        case "string":
            return "gchararray";
        case "void":
            return "void";
    }
};
