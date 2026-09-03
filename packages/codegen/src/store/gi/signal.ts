import { camelCase, sourceStringLiteral } from "@gtkx/utils";
import type { GirClass, GirSignal } from "../../gir/class.js";
import type { GirCallable, GirParameter, GirReturnValue } from "../../gir/parameter.js";
import type { GirProperty } from "../../gir/property.js";
import type { ModuleContext } from "../../writer/context.js";
import type { Declaration } from "../../writer/module.js";
import {
    isCellInout,
    primaryReturnKind,
    renderDescriptor,
    renderParamDescriptor,
} from "../../analysis/descriptor-render.js";
import { tCallback, tObject, tVoid } from "../../analysis/descriptor.js";
import {
    collectInterfaceProperties,
    effectiveNaturalSignalMemberNames,
    forEachAncestor,
    hasNaturalMember,
    resolvePrerequisiteReference,
} from "../../analysis/inheritance.js";
import { renderHandlerParameters, renderHandlerResultType } from "../../analysis/param-structure.js";
import { renderParameterTsType, renderTsType } from "../../analysis/ts-type.js";
import { resolveInterfaces } from "../../gir/ancestry.js";
import { isCallerAllocatedOut, isOutParameter } from "../../gir/parameter.js";
import { renderJsDoc } from "../../writer/doc.js";
import { indent, renderBlock, renderBracedOrEmpty } from "../../writer/emit.js";
import { parentCompanionRef } from "./companion.js";
import { getDoc, handlerSpec } from "./doc-spec.js";
import { isAllocatableCallerOut, isRecordInout, renderCallerOutInstance } from "./param-marshal.js";

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

type SignalMemberMetadataOptions = {
    context: ModuleContext;
    klass: GirClass;
    map: string;
    emitMap: string;
    lines: string[];
};

type NamedMember = { name: string };

const SIGNAL_HANDLER_TYPE = "(...args: any[]) => any";
const SIGNALS_SUFFIX = "Signals";
const SIGNAL_EMIT_SUFFIX = "SignalEmit";

const renderSignalMembers = (context: ModuleContext, klass: GirClass): string[] => {
    if (context.namespace.name !== "GObject" || klass.name !== "Object") {
        return [];
    }

    context.addRuntimeInternalImport("connectSignalByName");
    context.addRuntimeInternalImport("emitSignalByName");
    context.addRuntimeInternalImport("signalEmitMapOverride");
    context.addRuntimeInternalImport("signalMapOverride");
    const receiver = context.addRuntimeInternalTypeImport("SignalMethodReceiver");
    const effectiveEmissionMap =
        "(TThis extends { [signalEmitMapOverride]?: infer TResolver } " +
        `? TResolver extends () => infer TMap ? NonNullable<TMap> : Object${SIGNAL_EMIT_SUFFIX} ` +
        `: Object${SIGNAL_EMIT_SUFFIX})`;
    const effectiveHandlerMap =
        "(TThis extends { [signalMapOverride]?: infer TResolver } " +
        `? TResolver extends () => infer TMap ? NonNullable<TMap> : Object${SIGNALS_SUFFIX} ` +
        `: Object${SIGNALS_SUFFIX})`;

    return [
        renderBlock(
            `connect<TThis, K extends keyof ${effectiveHandlerMap}>(` +
            `this: TThis & ${receiver}<TThis, "connect">, ` +
            `signal: K, handler: ${effectiveHandlerMap}[K], isAfter?: boolean): number`,
            "return connectSignalByName(this, signal, handler, isAfter);",
        ),
        renderBlock(
            `emit<TThis, K extends keyof ${effectiveEmissionMap}>(` +
            `this: TThis & ${receiver}<TThis, "emit">, ` +
            `sigName: K, ...args: ${effectiveEmissionMap}[K]["args"]): ` +
            `${effectiveEmissionMap}[K]["result"]`,
            "return emitSignalByName(this, sigName, args);",
        ),
    ];
};

const renderSyntheticSignalMarker = (
    context: ModuleContext,
    klass: GirClass,
    targetName: string,
): string | undefined => {
    if (context.namespace.name !== "GObject" || klass.name !== "Object") {
        return undefined;
    }

    context.addRuntimeInternalImport("markSyntheticSignalMembers");

    return `markSyntheticSignalMembers(${targetName}, ["connect", "disconnect", "emit", "off", "on", "once"]);`;
};

const renderSignalRegistration = (
    context: ModuleContext,
    klass: GirClass,
    targetName: string,
): string | undefined => {
    if (klass.glibGetType === undefined) {
        return undefined;
    }

    const signals = klass.signals.filter((signal) => signal.introspectable);
    const marker = renderSyntheticSignalMarker(context, klass, targetName);

    if (signals.length === 0) {
        return marker;
    }

    context.addRuntimeImport("connectSignal");
    context.addRuntimeImport("emitSignal");
    context.addRuntimeInternalImport("canonicalSignalName");
    context.addRuntimeInternalImport("installSignalDispatch");
    context.addRuntimeImport("t");
    const connectCases = signals.map((signal) => renderConnectCase(context, signal));
    const emitCases = signals.map((signal) => renderEmitCase(context, signal));
    const connectDefault = "default:\n    throw new globalThis.Error(\"Unknown signal '\" + signal + \"'\");";
    const emitDefault = "default:\n    throw new globalThis.Error(\"Unknown signal '\" + sigName + \"'\");";
    const connectBody = indent([...connectCases, connectDefault].join("\n"), 1);
    const connectSwitch = `switch (canonicalSignalName(signal)) {\n${connectBody}\n}`;
    const emitBody = indent([...emitCases, emitDefault].join("\n"), 1);
    const emitSwitch = `switch (canonicalSignalName(sigName)) {\n${emitBody}\n}`;
    const members = [
        renderBlock(
            `connect(instance: object, signal: string, handler: ${SIGNAL_HANDLER_TYPE}, isAfter?: boolean): number`,
            connectSwitch,
        ),
        renderBlock("emit(instance: object, sigName: string, args: unknown[]): unknown", emitSwitch),
    ];
    const names = signals.map((signal) => sourceStringLiteral(signal.name.replaceAll("_", "-"))).join(", ");

    const registration =
        `installSignalDispatch(${targetName}, [${names}], {\n` +
        `${indent(members.join(",\n\n"), 1)}\n});`;

    return marker === undefined ? registration : `${marker}\n${registration}`;
};

const renderSignalDeclarations = (
    context: ModuleContext,
    klass: GirClass,
    className: string,
    isParentlessObjectSubclass: boolean,
): Declaration[] => {
    const base = { context, klass, className, isParentlessObjectSubclass };

    const declarations: Declaration[] = [
        {
            name: `${className}${SIGNALS_SUFFIX}`,
            code: renderSignalMap({ ...base, suffix: SIGNALS_SUFFIX, renderEntry: renderSignalHandlerType }),
        },
        {
            name: `${className}${SIGNAL_EMIT_SUFFIX}`,
            code: renderSignalMap({ ...base, suffix: SIGNAL_EMIT_SUFFIX, renderEntry: renderSignalEmitEntry }),
        },
    ];

    if (
        klass.glibGetType !== undefined &&
        (collectClassSignals(context, klass).length > 0 ||
            collectNotifyDetails(context, klass).length > 0 ||
            klass.implements.length > 0 ||
            effectiveNaturalSignalMemberNames(context, klass).length > 0)
    ) {
        declarations.push({
            name: className,
            code: renderSignalConnectInterface(context, klass, className),
        });
    }

    return declarations;
};

const renderSignalMap = (spec: SignalMapSpec): string => {
    const { context, klass, className, isParentlessObjectSubclass, suffix, renderEntry } = spec;
    const extendsRefs = signalMapParentRefs(context, klass, isParentlessObjectSubclass, suffix);
    const extendsClause = extendsRefs.length === 0 ? "" : ` extends ${extendsRefs.join(", ")}`;
    const signals = collectClassSignals(context, klass);

    const signalEntries = signals.flatMap((signal) => {
        const value = renderEntry(context, signal);
        const entry = `${signalDoc(signal)}${sourceStringLiteral(signal.name)}: ${value};`;

        if (!signal.isDetailed) {
            return [entry];
        }

        return [entry, `[detail: \`${signal.name}::\${string}\`]: ${value};`];
    });

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

const renderSignalConnectInterface = (
    context: ModuleContext,
    klass: GirClass,
    className: string,
): string => {
    const map = `${className}${SIGNALS_SUFFIX}`;
    const emitMap = `${className}${SIGNAL_EMIT_SUFFIX}`;

    const lines = [
        `__signals__?: ${map};`,
        `__signalEmit__?: ${emitMap};`,
    ];
    appendSignalMemberMetadata({ context, klass, map, emitMap, lines });
    const receiver = context.addRuntimeInternalTypeImport("SignalMethodReceiver");

    if (!hasNaturalMember(context, klass, "connect")) {
        lines.push(
            `connect<TThis, K extends keyof ${map}>(this: TThis & ${receiver}<TThis, "connect">, ` +
            `signal: K, handler: ${map}[K], isAfter?: boolean): number;`,
        );
    }

    if (!hasNaturalMember(context, klass, "emit")) {
        lines.push(
            `emit<K extends keyof ${emitMap}, TThis = this>(this: TThis & ${receiver}<TThis, "emit">, ` +
            `sigName: K, ...args: ${emitMap}[K]["args"]): ${emitMap}[K]["result"];`,
        );
    }

    const chainable = (methods: string[], trailing: string): void => {
        for (const method of methods) {
            if (!hasNaturalMember(context, klass, method)) {
                lines.push(
                    `${method}<TThis, K extends keyof ${map}>(` +
                    `this: TThis & ${receiver}<TThis, ${sourceStringLiteral(method)}>, ` +
                    `signal: K, handler: ${map}[K]${trailing}): TThis;`,
                );
            }
        }
    };

    chainable(["on", "once"], ", isAfter?: boolean");
    chainable(["off"], "");

    return renderBracedOrEmpty(`export interface ${className}`, lines.join("\n"));
};

const classSignalMemberNames = (context: ModuleContext, klass: GirClass): string[] => {
    if (klass.isInterface) {
        return [];
    }

    const names: Set<string> = new Set();
    const addSignals = (owner: GirClass): void => {
        for (const signal of owner.signals) {
            if (signal.introspectable) {
                names.add(signal.name.replaceAll("_", "-"));
            }
        }
    };

    addSignals(klass);
    forEachAncestor(context, klass, (ancestor) => {
        addSignals(ancestor.klass);
    });

    return [...names];
};

const renderMemberRecord = (names: string[]): string =>
    `Record<${names.map((name) => sourceStringLiteral(name)).join(" | ")}, true>`;

const appendSignalMemberMetadata = (options: SignalMemberMetadataOptions): void => {
    const { context, klass, map, emitMap, lines } = options;
    context.addRuntimeInternalImport("signalEmitMapOverride");
    context.addRuntimeInternalImport("signalMapOverride");
    lines.push(`[signalMapOverride]?: () => ${map};`, `[signalEmitMapOverride]?: () => ${emitMap};`);
    const naturalMembers = effectiveNaturalSignalMemberNames(context, klass);

    if (naturalMembers.length > 0) {
        context.addRuntimeInternalImport("naturalSignalMember");
        lines.push(`[naturalSignalMember]?: ${renderMemberRecord(naturalMembers)};`);
    }

    const classSignals = classSignalMemberNames(context, klass);

    if (classSignals.length > 0) {
        context.addRuntimeInternalImport("classSignalMember");
        lines.push(`[classSignalMember]?: ${renderMemberRecord(classSignals)};`);
    }
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
        (ref, nullable) => renderParameterTsType(context, ref, nullable),
        isCallerAllocatedOut,
    );

    const result = renderResultType(context, signal, true, false);

    return `{ args: [${args.join(", ")}]; result: ${result} }`;
};

const nonVarargParameters = (signal: GirCallable): GirParameter[] =>
    signal.parameters.filter((parameter) => !parameter.isVarargs);

const renderConnectCase = (context: ModuleContext, signal: GirCallable): string => {
    const callback = renderCallback(context, signal);
    const body =
        "return connectSignal(instance, signal, " +
        `{ callback: ${callback}, handler, isAfter: isAfter ?? false });`;

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
        const value = renderCallerOutInstance(context, parameter);

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

const renderEmitReturnArg = (context: ModuleContext, returnValue: GirReturnValue): string => {
    if (primaryReturnKind(context.library, returnValue) === "void") {
        return "";
    }

    return `, ${renderDescriptor(context, returnValue.type, returnValue.transferOwnership, { isReceived: true })}`;
};

const renderEmitCase = (context: ModuleContext, signal: GirCallable): string => {
    const params = nonVarargParameters(signal);

    if (params.some((parameter) => isCallerAllocatedOut(parameter) && !isAllocatableCallerOut(context, parameter))) {
        return renderUnsupportedEmitCase(signal);
    }

    let argIndex = 0;

    const argLiterals = params.map((parameter) => {
        const descriptor = renderDescriptor(context, parameter.type, parameter.transferOwnership, {
            isReceived: true,
        });

        const rendered = renderEmitArgLiteral({ context, parameter, descriptor, argIndex });
        argIndex = rendered.nextArgIndex;

        return rendered.literal;
    });

    const returnArg = renderEmitReturnArg(context, signal.returnValue);
    const body = `return emitSignal(instance, sigName, [${argLiterals.join(", ")}]${returnArg});`;

    return renderBlock(`case ${sourceStringLiteral(signal.name)}:`, body);
};

const renderUnsupportedEmitCase = (signal: GirCallable): string => {
    const message = `emit() cannot allocate the caller-allocated out-parameter of '${signal.name}'`;

    return renderBlock(
        `case ${sourceStringLiteral(signal.name)}:`,
        `throw new globalThis.Error(${sourceStringLiteral(message)});`,
    );
};

const receivedSignalParameter = (context: ModuleContext, parameter: GirParameter): GirParameter => {
    const isProduced =
        isOutParameter(parameter) || isCallerAllocatedOut(parameter) || isCellInout(context.library, parameter);

    return isProduced ? parameter : { ...parameter, transferOwnership: "none" };
};

const renderCallback = (context: ModuleContext, signal: GirCallable): string => {
    const params = nonVarargParameters(signal);

    const callbackParamDescriptors = params.map((parameter) =>
        renderParamDescriptor(context, receivedSignalParameter(context, parameter), parameter.type, {
            argIndexOffset: 1,
        }),
    );

    const callbackArgs = [tObject("borrowed"), ...callbackParamDescriptors, tVoid];
    const userDataIndex = String(params.length + 1);

    return tCallback({
        argTypes: callbackArgs,
        returns: renderDescriptor(context, signal.returnValue.type, signal.returnValue.transferOwnership, {
            isReceived: true,
        }),
        options: [
            "hasDestroy: true",
            "destroyKind: \"closureNotify\"",
            "hasUserData: true",
            `userDataIndex: ${userDataIndex}`,
        ],
    });
};

const forEachInterfaceSignal = (
    context: ModuleContext,
    klass: GirClass,
    consider: (signal: GirSignal) => void,
): void => {
    for (const iface of resolveInterfaces(context.library, context.namespace.name, klass.implements)) {
        for (const signal of iface.klass.signals) {
            consider(signal);
        }
    }
};

const collectClassSignals = (context: ModuleContext, klass: GirClass): GirSignal[] => {
    const inheritedNames = collectInheritedSignalNames(context, klass);
    const seen: Set<string> = new Set();
    const result: GirSignal[] = [];

    const consider = (signal: GirSignal): void => {
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

export { renderSignalDeclarations, renderSignalMembers, renderSignalRegistration };
