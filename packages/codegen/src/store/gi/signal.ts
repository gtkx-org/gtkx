import { sourceStringLiteral, toCamelCase, toPascalCase } from "@gtkx/utils";
import { tCallback, tObject, tVoid } from "../../analysis/descriptor.js";
import {
    isCellInout,
    omitsPrimaryReturn,
    renderDescriptor,
    renderParamDescriptor,
} from "../../analysis/descriptor-render.js";
import {
    collectInterfaceProperties,
    forEachAncestor,
    resolveImplementedInterface,
    resolvePrerequisiteReference,
} from "../../analysis/inheritance.js";
import { renderHandlerParameters, renderHandlerResultType } from "../../analysis/param-structure.js";
import { renderTsType } from "../../analysis/ts-type.js";
import type { GirClass } from "../../gir/class.js";
import type { GirParameter, GirSignal } from "../../gir/parameter.js";
import { isCallerAllocatedOut, isOutParameter } from "../../gir/parameter.js";
import type { GirProperty } from "../../gir/property.js";
import { splitOptionalNamespace } from "../../gir/type-ref.js";
import type { ModuleContext } from "../../writer/context.js";
import { indent, renderBlock, renderBracedOrEmpty } from "../../writer/emit.js";
import { isRecordCallerOut, isRecordInout } from "./param-marshal.js";

const SIGNAL_HANDLER_TYPE = "(...args: any[]) => any";

export const renderSignalMembers = (context: ModuleContext, klass: GirClass): string[] => {
    if (klass.glibGetType === undefined) return [];
    const signals = collectClassSignals(context, klass);
    if (signals.length === 0) return [];
    const isRootObject = context.namespace.name === "GObject" && klass.name === "Object";

    context.addRuntimeImport("connectSignal");
    context.addRuntimeImport("getSignalBaseName");
    context.addRuntimeImport("t");

    const connectCases = signals.map((signal) => renderConnectCase(context, signal));
    const emitCases = signals.map((signal) => renderEmitCase(context, signal));
    const connectDefault = isRootObject
        ? `default:\n    throw new globalThis.Error("Unknown signal '" + signal + "'");`
        : "default:\n    return super.connect(signal, handler, after);";
    const emitDefault = isRootObject
        ? `default:\n    throw new globalThis.Error("Unknown signal '" + sigName + "'");`
        : "default:\n    return super.emit(sigName, ...args);";

    const connectSwitch = `switch (getSignalBaseName(signal)) {\n${indent([...connectCases, connectDefault].join("\n"), 1)}\n}`;
    const emitSwitch = `switch (getSignalBaseName(sigName)) {\n${indent([...emitCases, emitDefault].join("\n"), 1)}\n}`;

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
    renderEntry: (context: ModuleContext, signal: GirSignal) => string;
};

const renderSignalMap = (spec: SignalMapSpec): string => {
    const { context, klass, className, parentlessExtendsObject, suffix, renderEntry } = spec;
    const extendsRefs = signalMapParentRefs(context, klass, parentlessExtendsObject, suffix);
    const extendsClause = extendsRefs.length === 0 ? "" : ` extends ${extendsRefs.join(", ")}`;
    const signalEntries = collectClassSignals(context, klass).map(
        (signal) => `${sourceStringLiteral(signal.name)}: ${renderEntry(context, signal)};`,
    );
    const entries = [...signalEntries, ...renderNotifyDetailEntries(context, klass, suffix)];
    return renderBracedOrEmpty(`export interface ${className}${suffix}${extendsClause}`, entries.join("\n"));
};

const renderNotifyDetailEntries = (context: ModuleContext, klass: GirClass, suffix: string): string[] => {
    const notifyValue = `${gobjectObjectMapRef(context, suffix)}["notify"]`;
    return collectNotifyDetails(context, klass).map(
        (name) => `${sourceStringLiteral(`notify::${name}`)}: ${notifyValue};`,
    );
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

const renderSignalHandlerType = (context: ModuleContext, signal: GirSignal): string => {
    const params = renderHandlerParameters(signal.parameters, (ref, nullable) => renderTsType(context, ref, nullable));
    return `(${params.join(", ")}) => ${renderResultType(context, signal, false, true)}`;
};

const renderResultType = (
    context: ModuleContext,
    signal: GirSignal,
    includeCallerAllocated: boolean,
    optOut: boolean,
): string =>
    renderHandlerResultType({
        library: context.library,
        signal,
        renderType: (ref, nullable) => renderTsType(context, ref, nullable),
        includeCallerAllocated,
        optOut,
    });

const renderSignalEmitEntry = (context: ModuleContext, signal: GirSignal): string => {
    const args = renderHandlerParameters(
        signal.parameters,
        (ref, nullable) => renderTsType(context, ref, nullable),
        isCallerAllocatedOut,
    );
    const result = renderResultType(context, signal, true, false);
    return `{ args: [${args.join(", ")}]; result: ${result} }`;
};

const renderConnectCase = (context: ModuleContext, signal: GirSignal): string => {
    const callback = renderCallback(context, signal);
    const body = `return connectSignal(this, signal, { callback: ${callback}, handler, after: after ?? false });`;
    return renderBlock(`case ${sourceStringLiteral(signal.name)}:`, body);
};

const renderEmitCase = (context: ModuleContext, signal: GirSignal): string => {
    const params = signal.parameters.filter((parameter) => !parameter.isVarargs);
    if (params.some((parameter) => isCallerAllocatedOut(parameter) && !isRecordCallerOut(context, parameter))) {
        return renderUnsupportedEmitCase(signal);
    }
    context.addRuntimeImport("emitSignal");

    let argIndex = 0;
    const argLiterals = params.map((parameter) => {
        const descriptor = renderDescriptor(context, parameter.type, parameter.transferOwnership);
        if (isOutParameter(parameter)) {
            return `{ type: ${descriptor}, direction: "out" }`;
        }
        if (isCellInout(context.library, parameter)) {
            return `{ type: ${descriptor}, direction: "inout", value: args[${argIndex++}] }`;
        }
        if (isCallerAllocatedOut(parameter)) {
            return `{ type: ${descriptor}, direction: "out", callerAllocated: true, value: ${renderCallerOutAllocation(context, parameter)} }`;
        }
        if (isRecordInout(context, parameter)) {
            return `{ type: ${descriptor}, direction: "inout", callerAllocated: true, value: args[${argIndex++}] }`;
        }
        return `{ type: ${descriptor}, value: args[${argIndex++}] }`;
    });

    const isVoid = omitsPrimaryReturn(context.library, signal.returnValue);
    const returnArg = isVoid
        ? ""
        : `, ${renderDescriptor(context, signal.returnValue.type, signal.returnValue.transferOwnership)}`;
    const body = `return emitSignal(this, sigName, [${argLiterals.join(", ")}]${returnArg});`;

    return renderBlock(`case ${sourceStringLiteral(signal.name)}:`, body);
};

const renderUnsupportedEmitCase = (signal: GirSignal): string => {
    const message = `emit() cannot allocate the caller-allocated out-parameter of '${signal.name}'`;
    return renderBlock(
        `case ${sourceStringLiteral(signal.name)}:`,
        `throw new globalThis.Error(${sourceStringLiteral(message)});`,
    );
};

const renderCallerOutAllocation = (context: ModuleContext, parameter: GirParameter): string => {
    const name = parameter.type === undefined ? undefined : context.library.nameOf(parameter.type);
    if (name === undefined) {
        throw new Error("renderCallerOutAllocation: expected a named caller-allocated out-parameter");
    }
    return `new ${context.qualify(name.namespaceName, name.typeName)}()`;
};

const renderCallback = (context: ModuleContext, signal: GirSignal): string => {
    const params = signal.parameters.filter((parameter) => !parameter.isVarargs);
    const callbackParamDescriptors = params.map((parameter) =>
        renderParamDescriptor(context, parameter, parameter.type),
    );
    const isVoid = omitsPrimaryReturn(context.library, signal.returnValue);
    const returnDescriptor = isVoid
        ? tVoid
        : renderDescriptor(context, signal.returnValue.type, signal.returnValue.transferOwnership);
    const callbackArgs = [tObject("borrowed"), ...callbackParamDescriptors, tVoid];
    return tCallback(callbackArgs, returnDescriptor, `{ hasDestroy: true, userDataIndex: ${params.length + 1} }`);
};

const collectClassSignals = (context: ModuleContext, klass: GirClass): GirSignal[] => {
    const inheritedNames = collectInheritedSignalNames(context, klass);
    const seen = new Set<string>();
    const result: GirSignal[] = [];
    const consider = (signal: GirSignal): void => {
        const name = toCamelCase(signal.name);
        if (inheritedNames.has(name) || seen.has(name)) return;
        seen.add(name);
        result.push(signal);
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
