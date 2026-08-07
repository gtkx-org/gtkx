import { camelCase, sourceStringLiteral } from "@gtkx/utils";
import type { GirClass } from "../../gir/class.js";
import type { GirCallable, GirParameter } from "../../gir/parameter.js";
import type { GirProperty } from "../../gir/property.js";
import type { ModuleContext } from "../../writer/context.js";
import {
    isCellInout,
    renderDescriptor,
    renderParamDescriptor,
    shouldOmitPrimaryReturn,
} from "../../analysis/descriptor-render.js";
import { tCallback, tObject, tVoid } from "../../analysis/descriptor.js";
import {
    collectInterfaceProperties,
    forEachAncestor,
    resolvePrerequisiteReference,
} from "../../analysis/inheritance.js";
import { renderHandlerParameters, renderHandlerResultType } from "../../analysis/param-structure.js";
import { renderTsType } from "../../analysis/ts-type.js";
import { resolveInterfaces } from "../../gir/ancestry.js";
import { isCallerAllocatedOut, isOutParameter } from "../../gir/parameter.js";
import { renderJsDoc } from "../../writer/doc.js";
import { indent, renderBlock, renderBracedOrEmpty } from "../../writer/emit.js";
import { parentCompanionRef } from "./companion.js";
import { getDoc, handlerSpec } from "./doc-spec.js";
import { isRecordCallerOut, isRecordInout } from "./param-marshal.js";

type SignalMapSpec = {
    context: ModuleContext;
    klass: GirClass;
    className: string;
    isParentlessObjectSubclass: boolean;
    suffix: string;
    renderEntry: (context: ModuleContext, signal: GirCallable) => string;
};

type EmitArgOptions = {
    context: ModuleContext;
    parameter: GirParameter;
    descriptor: string;
    argIndex: number;
};

type NamedMember = { name: string };

const SIGNAL_HANDLER_TYPE = "(...args: any[]) => any";
const SIGNALS_SUFFIX = "Signals";
const SIGNAL_EMIT_SUFFIX = "SignalEmit";

const renderSignalMembers = (context: ModuleContext, klass: GirClass): string[] => {
    if (klass.glibGetType === undefined) {
        return [];
    }

    const signals = collectClassSignals(context, klass);

    if (signals.length === 0) {
        return [];
    }

    const isRootObject = context.namespace.name === "GObject" && klass.name === "Object";
    context.addRuntimeImport("connectSignal");
    context.addRuntimeImport("getSignalBaseName");
    context.addRuntimeImport("t");
    const connectCases = signals.map((signal) => renderConnectCase(context, signal));
    const emitCases = signals.map((signal) => renderEmitCase(context, signal));

    const connectDefault = isRootObject
        ? "default:\n    throw new globalThis.Error(\"Unknown signal '\" + signal + \"'\");"
        : "default:\n    return super.connect(signal, handler, isAfter);";

    const emitDefault = isRootObject
        ? "default:\n    throw new globalThis.Error(\"Unknown signal '\" + sigName + \"'\");"
        : "default:\n    return super.emit(sigName, ...args);";

    const connectBody = indent([...connectCases, connectDefault].join("\n"), 1);
    const connectSwitch = `switch (getSignalBaseName(signal)) {\n${connectBody}\n}`;
    const emitBody = indent([...emitCases, emitDefault].join("\n"), 1);
    const emitSwitch = `switch (getSignalBaseName(sigName)) {\n${emitBody}\n}`;

    return [
        renderBlock(
            `connect(signal: string, handler: ${SIGNAL_HANDLER_TYPE}, isAfter?: boolean): number`,
            connectSwitch,
        ),
        renderBlock("emit(sigName: string, ...args: unknown[]): unknown", emitSwitch),
    ];
};

const renderSignalDeclarations = (
    context: ModuleContext,
    klass: GirClass,
    className: string,
    isParentlessObjectSubclass: boolean,
): string[] => {
    const base = { context, klass, className, isParentlessObjectSubclass };

    const declarations = [
        renderSignalMap({ ...base, suffix: SIGNALS_SUFFIX, renderEntry: renderSignalHandlerType }),
        renderSignalMap({ ...base, suffix: SIGNAL_EMIT_SUFFIX, renderEntry: renderSignalEmitEntry }),
    ];

    if (
        klass.glibGetType !== undefined &&
        (collectClassSignals(context, klass).length > 0 ||
            collectNotifyDetails(context, klass).length > 0 ||
            klass.implements.length > 0)
    ) {
        const isRootObject = context.namespace.name === "GObject" && klass.name === "Object";
        declarations.push(renderSignalConnectInterface(className, isRootObject));
    }

    return declarations;
};

const renderSignalMap = (spec: SignalMapSpec): string => {
    const { context, klass, className, isParentlessObjectSubclass, suffix, renderEntry } = spec;
    const extendsRefs = signalMapParentRefs(context, klass, isParentlessObjectSubclass, suffix);
    const extendsClause = extendsRefs.length === 0 ? "" : ` extends ${extendsRefs.join(", ")}`;

    const signalEntries = collectClassSignals(context, klass).map(
        (signal) => `${signalDoc(signal)}${sourceStringLiteral(signal.name)}: ${renderEntry(context, signal)};`,
    );

    const entries = [...signalEntries, ...renderNotifyDetailEntries(context, klass, suffix)];

    return renderBracedOrEmpty(`export interface ${className}${suffix}${extendsClause}`, entries.join("\n"));
};

const signalDoc = (signal: GirCallable): string =>
    renderJsDoc(signal.doc, undefined, handlerSpec(signal, signal.parameters));

const renderNotifyDetailEntries = (context: ModuleContext, klass: GirClass, suffix: string): string[] => {
    const notifyValue = `${gobjectObjectMapRef(context, suffix)}["notify"]`;

    return collectNotifyDetails(context, klass).map((property) => {
        const detailedSignal = `notify::${property.name}`;
        const doc = getDoc(property);

        return `${doc}${sourceStringLiteral(detailedSignal)}: ${notifyValue};`;
    });
};

const signalMapParentRefs = (
    context: ModuleContext,
    klass: GirClass,
    isParentlessObjectSubclass: boolean,
    suffix: string,
): string[] => {
    const parentRef = parentCompanionRef(context, klass, suffix);

    if (parentRef !== undefined) {
        return [parentRef];
    }

    if (!isParentlessObjectSubclass) {
        return [];
    }

    const prerequisiteRefs = klass.prerequisites
        .map((name) => resolvePrerequisiteReference(context, name))
        .filter((entry): entry is string => entry !== undefined)
        .map((entry) => `${entry}${suffix}`);

    if (prerequisiteRefs.length > 0) {
        return prerequisiteRefs;
    }

    return [gobjectObjectMapRef(context, suffix)];
};

const gobjectObjectMapRef = (context: ModuleContext, suffix: string): string => {
    if (context.namespace.name === "GObject") {
        return `Object${suffix}`;
    }

    return `${context.addCrossNamespaceImport("GObject")}.Object${suffix}`;
};

const renderSignalConnectInterface = (className: string, isRootObject: boolean): string => {
    const map = `${className}${SIGNALS_SUFFIX}`;
    const emitMap = `${className}${SIGNAL_EMIT_SUFFIX}`;

    const lines = [
        `__signals__?: ${map};`,
        `connect<K extends keyof ${map}>(signal: K, handler: ${map}[K], isAfter?: boolean): number;`,
        `connect(signal: string, handler: ${SIGNAL_HANDLER_TYPE}, isAfter?: boolean): number;`,
        `emit<K extends keyof ${emitMap}>(sigName: K, ...args: ${emitMap}[K]["args"]): ${emitMap}[K]["result"];`,
        "emit(sigName: string, ...args: unknown[]): unknown;",
    ];

    if (!isRootObject) {
        const chainable = (methods: string[], trailing: string): void => {
            for (const method of methods) {
                lines.push(
                    `${method}<K extends keyof ${map}>(signal: K, handler: ${map}[K]${trailing}): this;`,
                    `${method}(signal: string, handler: ${SIGNAL_HANDLER_TYPE}${trailing}): this;`,
                );
            }
        };

        chainable(["on", "once", "addEventListener"], ", isAfter?: boolean");
        chainable(["off", "removeEventListener"], "");
    }

    return renderBracedOrEmpty(`export interface ${className}`, lines.join("\n"));
};

const renderSignalHandlerType = (context: ModuleContext, signal: GirCallable): string => {
    const params = renderHandlerParameters(signal.parameters, (ref, nullable) => renderTsType(context, ref, nullable));

    return `(${params.join(", ")}) => ${renderResultType(context, signal, false, true)}`;
};

const renderResultType = (
    context: ModuleContext,
    signal: GirCallable,
    shouldIncludeCallerAllocated: boolean,
    isOptOut: boolean,
): string =>
    renderHandlerResultType({
        library: context.library,
        signal,
        renderType: (ref, nullable) => renderTsType(context, ref, nullable),
        shouldIncludeCallerAllocated,
        isOptOut,
    });

const renderSignalEmitEntry = (context: ModuleContext, signal: GirCallable): string => {
    const args = renderHandlerParameters(
        signal.parameters,
        (ref, nullable) => renderTsType(context, ref, nullable),
        isCallerAllocatedOut,
    );

    const result = renderResultType(context, signal, true, false);

    return `{ args: [${args.join(", ")}]; result: ${result} }`;
};

const nonVarargParameters = (signal: GirCallable): GirParameter[] =>
    signal.parameters.filter((parameter) => !parameter.isVarargs);

const renderConnectCase = (context: ModuleContext, signal: GirCallable): string => {
    const callback = renderCallback(context, signal);
    const body = `return connectSignal(this, signal, { callback: ${callback}, handler, isAfter: isAfter ?? false });`;

    return renderBlock(`case ${sourceStringLiteral(signal.name)}:`, body);
};

const renderEmitArgLiteral = (options: EmitArgOptions): { literal: string; nextArgIndex: number } => {
    const { context, parameter, descriptor, argIndex } = options;

    if (isOutParameter(parameter)) {
        return { literal: `{ type: ${descriptor}, direction: "out" }`, nextArgIndex: argIndex };
    }

    if (isCellInout(context.library, parameter)) {
        return {
            literal: `{ type: ${descriptor}, direction: "inout", value: args[${String(argIndex)}] }`,
            nextArgIndex: argIndex + 1,
        };
    }

    if (isCallerAllocatedOut(parameter)) {
        const value = renderCallerOutAllocation(context, parameter);

        return {
            literal: `{ type: ${descriptor}, direction: "out", isCallerAllocated: true, value: ${value} }`,
            nextArgIndex: argIndex,
        };
    }

    if (isRecordInout(context, parameter)) {
        return {
            literal:
                `{ type: ${descriptor}, direction: "inout", isCallerAllocated: true, ` +
                `value: args[${String(argIndex)}] }`,
            nextArgIndex: argIndex + 1,
        };
    }

    return { literal: `{ type: ${descriptor}, value: args[${String(argIndex)}] }`, nextArgIndex: argIndex + 1 };
};

const renderEmitCase = (context: ModuleContext, signal: GirCallable): string => {
    const params = nonVarargParameters(signal);

    if (params.some((parameter) => isCallerAllocatedOut(parameter) && !isRecordCallerOut(context, parameter))) {
        return renderUnsupportedEmitCase(signal);
    }

    context.addRuntimeImport("emitSignal");
    let argIndex = 0;

    const argLiterals = params.map((parameter) => {
        const descriptor = renderDescriptor(context, parameter.type, parameter.transferOwnership);
        const rendered = renderEmitArgLiteral({ context, parameter, descriptor, argIndex });
        argIndex = rendered.nextArgIndex;

        return rendered.literal;
    });

    const isVoid = shouldOmitPrimaryReturn(context.library, signal.returnValue);

    const returnArg = isVoid
        ? ""
        : `, ${renderDescriptor(context, signal.returnValue.type, signal.returnValue.transferOwnership)}`;

    const body = `return emitSignal(this, sigName, [${argLiterals.join(", ")}]${returnArg});`;

    return renderBlock(`case ${sourceStringLiteral(signal.name)}:`, body);
};

const renderUnsupportedEmitCase = (signal: GirCallable): string => {
    const message = `emit() cannot allocate the caller-allocated out-parameter of '${signal.name}'`;

    return renderBlock(
        `case ${sourceStringLiteral(signal.name)}:`,
        `throw new globalThis.Error(${sourceStringLiteral(message)});`,
    );
};

const renderCallerOutAllocation = (context: ModuleContext, parameter: GirParameter): string => {
    const name = parameter.type === undefined ? undefined : context.library.nameFor(parameter.type);

    if (name === undefined) {
        throw new Error("renderCallerOutAllocation: expected a named caller-allocated out-parameter");
    }

    return `new ${context.qualify(name.namespaceName, name.typeName)}()`;
};

const renderCallback = (context: ModuleContext, signal: GirCallable): string => {
    const params = nonVarargParameters(signal);

    const callbackParamDescriptors = params.map((parameter) =>
        renderParamDescriptor(context, parameter, parameter.type, { argIndexOffset: 1 }),
    );

    const isVoid = shouldOmitPrimaryReturn(context.library, signal.returnValue);

    const returnDescriptor = isVoid
        ? tVoid
        : renderDescriptor(context, signal.returnValue.type, signal.returnValue.transferOwnership);

    const callbackArgs = [tObject("borrowed"), ...callbackParamDescriptors, tVoid];
    const userDataIndex = String(params.length + 1);
    const destroy = "hasDestroy: true, destroyKind: \"closureNotify\"";

    return tCallback(
        callbackArgs,
        returnDescriptor,
        `{ ${destroy}, hasUserData: true, userDataIndex: ${userDataIndex} }`,
    );
};

const forEachInterfaceSignal = (
    context: ModuleContext,
    klass: GirClass,
    consider: (signal: GirCallable) => void,
): void => {
    for (const iface of resolveInterfaces(context.library, context.namespace.name, klass.implements)) {
        for (const signal of iface.klass.signals) {
            consider(signal);
        }
    }
};

const collectClassSignals = (context: ModuleContext, klass: GirClass): GirCallable[] => {
    const inheritedNames = collectInheritedSignalNames(context, klass);
    const seen: Set<string> = new Set();
    const result: GirCallable[] = [];

    const consider = (signal: GirCallable): void => {
        const name = camelCase(signal.name);

        if (!signal.introspectable || inheritedNames.has(name) || seen.has(name)) {
            return;
        }

        seen.add(name);
        result.push(signal);
    };

    for (const signal of klass.signals) {
        consider(signal);
    }

    forEachInterfaceSignal(context, klass, consider);

    return result;
};

const addMemberNames = (target: Set<string>, source: GirClass, select: (source: GirClass) => NamedMember[]): void => {
    for (const member of select(source)) {
        target.add(camelCase(member.name));
    }
};

const collectInheritedMemberNames = (
    context: ModuleContext,
    klass: GirClass,
    select: (source: GirClass) => NamedMember[],
): Set<string> => {
    const names: Set<string> = new Set();

    forEachAncestor(context, klass, (ancestor, interfaces) => {
        addMemberNames(names, ancestor.klass, select);

        for (const iface of interfaces) {
            addMemberNames(names, iface.klass, select);
        }
    });

    return names;
};

const collectInheritedSignalNames = (context: ModuleContext, klass: GirClass): Set<string> =>
    collectInheritedMemberNames(context, klass, (source) => source.signals);

const collectNotifyDetails = (context: ModuleContext, klass: GirClass): GirProperty[] => {
    const inherited = collectInheritedMemberNames(context, klass, (source) => source.properties);
    const seen: Set<string> = new Set();
    const result: GirProperty[] = [];

    const consider = (property: GirProperty): void => {
        const name = camelCase(property.name);

        if (inherited.has(name) || seen.has(name)) {
            return;
        }

        seen.add(name);
        result.push(property);
    };

    for (const property of klass.properties) {
        consider(property);
    }

    for (const { property } of collectInterfaceProperties(context, klass)) {
        consider(property);
    }

    return result;
};

export { renderSignalMembers, renderSignalDeclarations };
