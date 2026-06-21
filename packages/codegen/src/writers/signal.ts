import { quote, toCamelCase, toPascalCase } from "@gtkx/utils";
import type { ModuleContext } from "../dsl/context.js";
import { indent, renderBlock, renderBracedOrEmpty } from "../dsl/emit.js";
import type { GirClass } from "../gir/class.js";
import type { GirParameter } from "../gir/parameter.js";
import { isCallerAllocatedOut, isOutParameter } from "../gir/parameter.js";
import type { GirProperty } from "../gir/property.js";
import type { GirSignal } from "../gir/signal.js";
import { splitOptionalNamespace } from "../gir/type-ref.js";
import { tCallback, tObject, tVoid } from "./descriptor.js";
import {
    collectInterfaceProperties,
    forEachAncestor,
    resolveImplementedInterface,
    resolvePrerequisiteReference,
} from "./inheritance.js";
import { isBoxedCallerOut, isBoxedInout } from "./param-marshal.js";
import { renderHandlerParameters } from "./param-structure.js";
import { foldOutParamShape } from "./return-shape.js";
import { renderTsType } from "./ts-type.js";
import { isCellInout, omitsPrimaryReturn, renderFfiType, renderHandlerArgType } from "./value.js";

const SIGNAL_HANDLER_TYPE = "(...args: any[]) => any";

type CollectedSignal = {
    signal: GirSignal;
};

export const renderSignalMembers = (context: ModuleContext, klass: GirClass): string[] => {
    if (klass.glibGetType === undefined) return [];
    const signals = collectClassSignals(context, klass);
    if (signals.length === 0) return [];
    const isRootObject = context.namespace.name === "GObject" && klass.name === "Object";

    context.addRuntimeImport("connectGobjectSignal");
    context.addRuntimeImport("signalBaseName");
    context.addRuntimeImport("t");

    const connectCases = signals.map((collected) => renderConnectCase(context, collected));
    const emitCases = signals.map((collected) => renderEmitCase(context, collected));
    const connectDefault = isRootObject
        ? `default:\n    throw new globalThis.Error("Unknown signal '" + signal + "'");`
        : "default:\n    return super.connect(signal, handler, after);";
    const emitDefault = isRootObject
        ? `default:\n    throw new globalThis.Error("Unknown signal '" + sigName + "'");`
        : "default:\n    return super.emit(sigName, ...args);";

    const connectSwitch = `switch (signalBaseName(signal)) {\n${indent([...connectCases, connectDefault].join("\n"), 1)}\n}`;
    const emitSwitch = `switch (signalBaseName(sigName)) {\n${indent([...emitCases, emitDefault].join("\n"), 1)}\n}`;

    return [
        renderBlock(`connect(signal: string, handler: ${SIGNAL_HANDLER_TYPE}, after?: boolean): number`, connectSwitch),
        renderBlock(`emit(sigName: string, ...args: unknown[]): unknown`, emitSwitch),
    ];
};

const SIGNAL_HANDLERS_SUFFIX = "SignalHandlers";
const SIGNAL_EMIT_SUFFIX = "SignalEmit";

export const renderSignalDeclarations = (
    context: ModuleContext,
    klass: GirClass,
    className: string,
    parentlessExtendsObject: boolean,
): string[] => {
    const base = { context, klass, className, parentlessExtendsObject };
    const declarations = [
        renderSignalMap({ ...base, suffix: SIGNAL_HANDLERS_SUFFIX, renderEntry: renderSignalHandlerType }),
        renderSignalMap({ ...base, suffix: SIGNAL_EMIT_SUFFIX, renderEntry: renderSignalEmitEntry }),
    ];
    if (
        klass.glibGetType !== undefined &&
        (collectClassSignals(context, klass).length > 0 || collectNotifyDetails(context, klass).length > 0)
    ) {
        const isRootObject = context.namespace.name === "GObject" && klass.name === "Object";
        declarations.push(renderSignalConnectInterface(className, isRootObject));
    }
    return declarations;
};

type SignalMapSpec = {
    context: ModuleContext;
    klass: GirClass;
    className: string;
    parentlessExtendsObject: boolean;
    suffix: string;
    renderEntry: (context: ModuleContext, collected: CollectedSignal) => string;
};

const renderSignalMap = (spec: SignalMapSpec): string => {
    const { context, klass, className, parentlessExtendsObject, suffix, renderEntry } = spec;
    const extendsRefs = signalMapParentRefs(context, klass, parentlessExtendsObject, suffix);
    const extendsClause = extendsRefs.length === 0 ? "" : ` extends ${extendsRefs.join(", ")}`;
    const signalEntries = collectClassSignals(context, klass).map(
        (collected) => `${quote(collected.signal.name)}: ${renderEntry(context, collected)};`,
    );
    const entries = [...signalEntries, ...renderNotifyDetailEntries(context, klass, suffix)];
    const body = entries.length === 0 ? "" : `\n${indent(entries.join("\n"), 1)}\n`;
    return `export interface ${className}${suffix}${extendsClause} {${body}}`;
};

const renderNotifyDetailEntries = (context: ModuleContext, klass: GirClass, suffix: string): string[] => {
    const notifyValue = `${gobjectObjectMapRef(context, suffix)}["notify"]`;
    return collectNotifyDetails(context, klass).map((name) => `${quote(`notify::${name}`)}: ${notifyValue};`);
};

const signalMapParentRefs = (
    context: ModuleContext,
    klass: GirClass,
    parentlessExtendsObject: boolean,
    suffix: string,
): string[] => {
    if (klass.parent !== undefined) {
        const [parentNamespace, typeName] = splitOptionalNamespace(klass.parent);
        const namespaceName = parentNamespace ?? context.namespace.name;
        const name = `${toPascalCase(typeName)}${suffix}`;
        if (namespaceName === context.namespace.name) return [name];
        return [`${context.addCrossNamespaceImport(namespaceName)}.${name}`];
    }
    if (!parentlessExtendsObject) return [];
    const prerequisiteRefs = klass.prerequisites
        .map((name) => resolvePrerequisiteReference(context, name))
        .filter((entry): entry is string => entry !== undefined)
        .map((entry) => `${entry}${suffix}`);
    if (prerequisiteRefs.length > 0) return prerequisiteRefs;
    return [gobjectObjectMapRef(context, suffix)];
};

const gobjectObjectMapRef = (context: ModuleContext, suffix: string): string => {
    if (context.namespace.name === "GObject") return `Object${suffix}`;
    return `${context.addCrossNamespaceImport("GObject")}.Object${suffix}`;
};

const renderSignalConnectInterface = (className: string, isRootObject: boolean): string => {
    const map = `${className}${SIGNAL_HANDLERS_SUFFIX}`;
    const emitMap = `${className}${SIGNAL_EMIT_SUFFIX}`;
    const lines = [
        `__signals__?: ${map};`,
        `connect<K extends keyof ${map}>(signal: K, handler: ${map}[K], after?: boolean): number;`,
        `connect(signal: string, handler: ${SIGNAL_HANDLER_TYPE}, after?: boolean): number;`,
        `emit<K extends keyof ${emitMap}>(sigName: K, ...args: ${emitMap}[K]["args"]): ${emitMap}[K]["result"];`,
        "emit(sigName: string, ...args: unknown[]): unknown;",
    ];
    if (!isRootObject) {
        for (const method of ["on", "once", "addEventListener"]) {
            lines.push(
                `${method}<K extends keyof ${map}>(signal: K, handler: ${map}[K], after?: boolean): this;`,
                `${method}(signal: string, handler: ${SIGNAL_HANDLER_TYPE}, after?: boolean): this;`,
            );
        }
        for (const method of ["off", "removeEventListener"]) {
            lines.push(
                `${method}<K extends keyof ${map}>(signal: K, handler: ${map}[K]): this;`,
                `${method}(signal: string, handler: ${SIGNAL_HANDLER_TYPE}): this;`,
            );
        }
    }
    return renderBracedOrEmpty(`export interface ${className}`, lines.join("\n"));
};

const renderSignalHandlerType = (context: ModuleContext, collected: CollectedSignal): string => {
    const { signal } = collected;
    const params = renderHandlerParameters(signal.parameters, (ref, nullable) => renderTsType(context, ref, nullable));
    return `(${params.join(", ")}) => ${renderResultType(context, collected, false, true)}`;
};

const assembleSignalResult = (primary: string | undefined, outTypes: string[], optOut: boolean): string => {
    if (outTypes.length === 0) {
        if (primary === undefined) return "void";
        return optOut ? `${primary} | undefined` : primary;
    }
    return foldOutParamShape({ primary, outTypes, hasPrimary: primary !== undefined });
};

const renderResultType = (
    context: ModuleContext,
    collected: CollectedSignal,
    includeCallerAllocated: boolean,
    optOut: boolean,
): string => {
    const { signal } = collected;
    const primary = omitsPrimaryReturn(context.repository, signal.returnValue)
        ? undefined
        : renderTsType(context, signal.returnValue.type, signal.returnValue.nullable);
    const outTypes = signal.parameters
        .filter(
            (parameter) =>
                !parameter.isVarargs &&
                (isOutParameter(parameter) ||
                    isCellInout(context, parameter) ||
                    (includeCallerAllocated && isCallerAllocatedOut(parameter))),
        )
        .map((parameter) => renderTsType(context, parameter.type, false));
    return assembleSignalResult(primary, outTypes, optOut);
};

const renderSignalEmitEntry = (context: ModuleContext, collected: CollectedSignal): string => {
    const { signal } = collected;
    const args = renderHandlerParameters(
        signal.parameters,
        (ref, nullable) => renderTsType(context, ref, nullable),
        isCallerAllocatedOut,
    );
    const result = renderResultType(context, collected, true, false);
    return `{ args: [${args.join(", ")}]; result: ${result} }`;
};

const renderConnectCase = (context: ModuleContext, collected: CollectedSignal): string => {
    const { signal } = collected;
    const callback = renderCallback(context, collected);
    const body = `return connectGobjectSignal(this, signal, { callback: ${callback}, handler, after: after ?? false });`;
    return renderBlock(`case ${quote(signal.name)}:`, body);
};

const renderEmitCase = (context: ModuleContext, collected: CollectedSignal): string => {
    const { signal } = collected;
    const params = signal.parameters.filter((parameter) => !parameter.isVarargs);
    if (params.some((parameter) => isCallerAllocatedOut(parameter) && !isBoxedCallerOut(context, parameter))) {
        return renderUnsupportedEmitCase(signal);
    }
    context.addRuntimeImport("emitGobjectSignal");

    let argIndex = 0;
    const argLiterals = params.map((parameter) => {
        const ffi = renderFfiType(context, parameter.type, parameter.transferOwnership);
        if (isOutParameter(parameter)) {
            return `{ ffi: ${ffi}, direction: "out" }`;
        }
        if (isCellInout(context, parameter)) {
            return `{ ffi: ${ffi}, direction: "inout", value: args[${argIndex++}] }`;
        }
        if (isCallerAllocatedOut(parameter)) {
            return `{ ffi: ${ffi}, direction: "out", callerAllocates: true, value: ${renderCallerOutAllocation(context, parameter)} }`;
        }
        if (isBoxedInout(context, parameter)) {
            return `{ ffi: ${ffi}, direction: "inout", callerAllocates: true, value: args[${argIndex++}] }`;
        }
        return `{ ffi: ${ffi}, value: args[${argIndex++}] }`;
    });

    const isVoid = omitsPrimaryReturn(context.repository, signal.returnValue);
    const returnArg = isVoid
        ? ""
        : `, ${renderFfiType(context, signal.returnValue.type, signal.returnValue.transferOwnership)}`;
    const body = `return emitGobjectSignal(this, sigName, [${argLiterals.join(", ")}]${returnArg});`;

    return renderBlock(`case ${quote(signal.name)}:`, body);
};

const renderUnsupportedEmitCase = (signal: GirSignal): string => {
    const message = `emit() cannot allocate the caller-allocated out-parameter of '${signal.name}'`;
    return renderBlock(`case ${quote(signal.name)}:`, `throw new globalThis.Error(${quote(message)});`);
};

const renderCallerOutAllocation = (context: ModuleContext, parameter: GirParameter): string => {
    const name = parameter.type === undefined ? undefined : context.repository.nameOf(parameter.type);
    if (name === undefined) {
        throw new Error("renderCallerOutAllocation: expected a named caller-allocated out-parameter");
    }
    return `new ${context.qualify(name.namespaceName, name.typeName)}()`;
};

const renderCallback = (context: ModuleContext, collected: CollectedSignal): string => {
    const { signal } = collected;
    const params = signal.parameters.filter((parameter) => !parameter.isVarargs);
    const callbackParamFfi = params.map((parameter) => renderHandlerArgType(context, parameter, parameter.type));
    const isVoid = omitsPrimaryReturn(context.repository, signal.returnValue);
    const returnFfi = isVoid
        ? tVoid
        : renderFfiType(context, signal.returnValue.type, signal.returnValue.transferOwnership);
    const callbackArgs = [tObject("borrowed"), ...callbackParamFfi, tVoid];
    return tCallback(callbackArgs, returnFfi, `{ hasDestroy: true, userDataIndex: ${params.length + 1} }`);
};

const collectClassSignals = (context: ModuleContext, klass: GirClass): CollectedSignal[] => {
    const inheritedNames = collectInheritedSignalNames(context, klass);
    const seen = new Set<string>();
    const result: CollectedSignal[] = [];
    const consider = (signal: GirSignal): void => {
        const name = toCamelCase(signal.name);
        if (inheritedNames.has(name) || seen.has(name)) return;
        seen.add(name);
        result.push({ signal });
    };
    for (const signal of klass.signals) consider(signal);
    for (const implementName of klass.implements) {
        const iface = resolveImplementedInterface(context, implementName);
        if (iface === undefined) continue;
        for (const signal of iface.klass.signals) consider(signal);
    }
    return result;
};

type NamedMember = { name: string };

const collectInheritedMemberNames = (
    context: ModuleContext,
    klass: GirClass,
    select: (source: GirClass) => NamedMember[],
): Set<string> => {
    const names = new Set<string>();
    forEachAncestor(context, klass, (ancestor, interfaces) => {
        for (const member of select(ancestor.klass)) names.add(toCamelCase(member.name));
        for (const iface of interfaces) {
            for (const member of select(iface.klass)) names.add(toCamelCase(member.name));
        }
    });
    return names;
};

const collectInheritedSignalNames = (context: ModuleContext, klass: GirClass): Set<string> =>
    collectInheritedMemberNames(context, klass, (source) => source.signals);

const collectNotifyDetails = (context: ModuleContext, klass: GirClass): string[] => {
    const inherited = collectInheritedMemberNames(context, klass, (source) => source.properties);
    const seen = new Set<string>();
    const result: string[] = [];
    const consider = (property: GirProperty): void => {
        const name = toCamelCase(property.name);
        if (inherited.has(name) || seen.has(name)) return;
        seen.add(name);
        result.push(property.name);
    };
    for (const property of klass.properties) consider(property);
    for (const property of collectInterfaceProperties(context, klass)) consider(property);
    return result;
};
