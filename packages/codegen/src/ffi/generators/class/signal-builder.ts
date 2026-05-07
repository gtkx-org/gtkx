/**
 * Signal Builder
 *
 * Builds signal connection code for classes.
 * Generates switch-case statements with inlined type info for own signals,
 * delegating inherited signals to super.connect().
 */

import type { GirClass, GirParameter, GirRepository, GirSignal } from "@gtkx/gir";
import type { Writer } from "../../../builders/writer.js";
import type { FfiGeneratorOptions } from "../../../core/generator-types.js";
import type { FfiMapper } from "../../../core/type-system/ffi-mapper.js";
import type { FfiTypeDescriptor, MappedType } from "../../../core/type-system/ffi-types.js";
import { collectDirectMembers, collectParentSignalNames } from "../../../core/utils/class-traversal.js";
import { filterVarargs } from "../../../core/utils/filtering.js";
import { normalizeClassName, toCamelCase, toValidIdentifier } from "../../../core/utils/naming.js";
import { splitQualifiedName } from "../../../core/utils/qualified-name.js";
import { CallExpressionBuilder } from "../../../core/writers/call-expression-builder.js";
import type { FfiDescriptorRegistry } from "../../../core/writers/descriptor-registry.js";
import { writeFfiTypeExpression } from "../../../core/writers/ffi-type-expression.js";
import {
    addTypeImports,
    createMethodBodyWriter,
    type ImportCollector,
    type MethodBodyWriter,
    type MethodStructure,
} from "../../../core/writers/index.js";
import {
    needsParamWrap,
    needsReturnUnwrap,
    type ParamWrapInfo,
    writeWrapExpression,
} from "../../../core/writers/param-wrap-writer.js";

type SignalParamData = {
    mapped: MappedType;
    paramName: string;
    wrapInfo: ParamWrapInfo;
};

/**
 * Builds signal connection code for a class.
 */
export class SignalBuilder {
    private readonly className: string;
    private readonly callExpression: CallExpressionBuilder;
    private readonly methodBody: MethodBodyWriter;

    constructor(
        private readonly cls: GirClass,
        private readonly ffiMapper: FfiMapper,
        private readonly imports: ImportCollector,
        private readonly repository: GirRepository,
        private readonly options: FfiGeneratorOptions,
        private readonly selfNames: ReadonlySet<string> = new Set(),
    ) {
        this.className = normalizeClassName(cls.name);
        const descriptors = (imports as { descriptors?: FfiDescriptorRegistry }).descriptors;
        this.callExpression = new CallExpressionBuilder(descriptors, imports);
        this.methodBody = createMethodBodyWriter(ffiMapper, imports, {
            sharedLibrary: options.sharedLibrary,
            glibLibrary: options.glibLibrary,
            selfNames,
        });
    }

    buildConnectMethodStructures(): MethodStructure[] {
        const ownSignals = this.collectOwnSignals();
        const hasSignalConnect = ownSignals.length > 0;

        if (!hasSignalConnect) {
            return [];
        }

        this.imports.addTypeImport("../../object.js", ["NativeHandle"]);
        this.imports.addImport("../../registry.js", ["getNativeObject"]);
        if (this.options.namespace === "GObject") {
            this.imports.addImport("./param-spec.js", ["ParamSpec"]);
        } else {
            this.imports.addNamespaceImport("../gobject/index.js", "GObject");
        }

        const overloads = this.buildOverloads(ownSignals);
        const isRootGObject = this.options.namespace === "GObject" && this.cls.name === "Object";

        const emitOverloads = this.buildEmitOverloads(ownSignals);

        const structures: MethodStructure[] = [
            {
                name: "connect",
                parameters: [
                    { name: "signal", type: "string" },
                    { name: "handler", type: "(...args: any[]) => any" },
                    { name: "after", type: "boolean", optional: true },
                ],
                returnType: "number",
                docs: [
                    {
                        description: `Connects a handler to a signal on this ${this.className}.\n\n@param signal - The signal name to connect to\n@param handler - Callback function invoked when signal is emitted\n@param after - If true, handler is called after default handler\n@returns Connection ID for disconnecting`,
                    },
                ],
                statements: this.writeConnectMethodBody(ownSignals),
                overloads,
            },
            {
                name: "emit",
                parameters: [
                    { name: "signal", type: "string" },
                    { name: "args", type: "any[]", isRestParameter: true },
                ],
                returnType: "any",
                docs: [
                    {
                        description: `Synchronously emits a signal on this ${this.className}.\n\nArguments are auto-marshalled into GValues based on the signal's GIR-defined parameter types.\nReturns the unmarshalled return value, or undefined for void-return signals.\n\n@param signal - The signal name to emit\n@param args - Arguments matching the signal's parameter list\n@returns The signal's return value, or undefined if it returns void`,
                    },
                ],
                statements: this.writeEmitMethodBody(ownSignals),
                overloads: emitOverloads,
            },
        ];

        if (!isRootGObject) {
            const onOverloads = this.buildAliasOverloads(ownSignals, "this", { withAfter: true });
            const offOverloads = this.buildAliasOverloads(ownSignals, "this", { withAfter: false });

            structures.push(
                {
                    name: "on",
                    parameters: [
                        { name: "signal", type: "string" },
                        { name: "handler", type: "(...args: any[]) => any" },
                        { name: "after", type: "boolean", optional: true },
                    ],
                    returnType: "this",
                    docs: [
                        {
                            description: `Connects a callback to a signal on this ${this.className}, tracked for later removal via off().\n\n@param signal - The signal name\n@param handler - Callback function\n@param after - If true, run after the default handler\n@returns This object, for chaining`,
                        },
                    ],
                    statements: (writer) => {
                        writer.writeLine("return super.on(signal, handler, after);");
                    },
                    overloads: onOverloads,
                },
                {
                    name: "once",
                    parameters: [
                        { name: "signal", type: "string" },
                        { name: "handler", type: "(...args: any[]) => any" },
                        { name: "after", type: "boolean", optional: true },
                    ],
                    returnType: "this",
                    docs: [
                        {
                            description: `Connects a one-shot callback to a signal on this ${this.className}.\n\n@param signal - The signal name\n@param handler - Callback function\n@param after - If true, run after the default handler\n@returns This object, for chaining`,
                        },
                    ],
                    statements: (writer) => {
                        writer.writeLine("return super.once(signal, handler, after);");
                    },
                    overloads: onOverloads,
                },
                {
                    name: "off",
                    parameters: [
                        { name: "signal", type: "string" },
                        { name: "handler", type: "(...args: any[]) => any" },
                    ],
                    returnType: "this",
                    docs: [
                        {
                            description: `Disconnects a callback previously registered with on() or once() on this ${this.className}.\n\n@param signal - The signal name\n@param handler - The exact callback reference\n@returns This object, for chaining`,
                        },
                    ],
                    statements: (writer) => {
                        writer.writeLine("return super.off(signal, handler);");
                    },
                    overloads: offOverloads,
                },
            );
        }

        return structures;
    }

    private buildAliasOverloads(
        allSignals: GirSignal[],
        returnType: string,
        opts: { withAfter: boolean },
    ): NonNullable<MethodStructure["overloads"]> {
        const overloads: NonNullable<MethodStructure["overloads"]> = [];
        for (const signal of allSignals) {
            const params = this.buildHandlerParams(signal);
            let signalReturnType = "void";
            if (signal.returnType) {
                const mapped = this.ffiMapper.mapType(signal.returnType, true, signal.returnType.transferOwnership);
                addTypeImports(this.imports, mapped.imports, this.selfNames);
                signalReturnType = mapped.ts;
            }
            const overloadParams = [
                { name: "signal", type: `"${signal.name}"` },
                { name: "handler", type: `(${params}) => ${signalReturnType}` },
            ];
            if (opts.withAfter) {
                overloadParams.push({ name: "after", type: "boolean", optional: true } as {
                    name: string;
                    type: string;
                    optional?: boolean;
                });
            }
            overloads.push({ params: overloadParams, returnType });
        }
        const fallbackParams = [
            { name: "signal", type: "string" },
            { name: "handler", type: "(...args: any[]) => any" },
        ];
        if (opts.withAfter) {
            fallbackParams.push({ name: "after", type: "boolean", optional: true } as {
                name: string;
                type: string;
                optional?: boolean;
            });
        }
        overloads.push({ params: fallbackParams, returnType });
        return overloads;
    }

    collectOwnSignals(): GirSignal[] {
        const directSignals = collectDirectMembers({
            cls: this.cls,
            repo: this.repository,
            getClassMembers: (c) => c.signals,
            getInterfaceMembers: (i) => i.signals,
            getParentNames: collectParentSignalNames,
            transformName: toCamelCase,
        });
        return directSignals.filter((signal) => !this.isUnsafeSignal(signal));
    }

    private isUnsafeSignal(signal: GirSignal): boolean {
        return (
            this.methodBody.hasUnsupportedCallbacks(signal.parameters) ||
            this.methodBody.isReturnTypeUnsafe(signal.returnType)
        );
    }

    private addNewSignals(signals: readonly GirSignal[], seen: Set<string>, all: GirSignal[]): void {
        for (const signal of signals) {
            if (!seen.has(signal.name)) {
                seen.add(signal.name);
                all.push(signal);
            }
        }
    }

    private collectInterfaceSignals(seen: Set<string>, all: GirSignal[]): void {
        for (const ifaceQualifiedName of this.cls.implements) {
            const iface = this.repository.resolveInterface(ifaceQualifiedName);
            if (!iface) continue;
            this.addNewSignals(iface.signals, seen, all);
        }
    }

    private collectParentSignals(seen: Set<string>, all: GirSignal[]): boolean {
        let parent = this.cls.getParent();
        while (parent) {
            if (this.cls.parent?.includes(".")) {
                const { namespace: parentNs } = splitQualifiedName(this.cls.parent);
                if (parentNs !== this.options.namespace) {
                    return true;
                }
            }
            this.addNewSignals(parent.signals, seen, all);
            parent = parent.getParent();
        }
        return false;
    }

    collectAllSignals(): { allSignals: GirSignal[]; hasCrossNamespaceParent: boolean } {
        const allSignals: GirSignal[] = [];
        const seenSignals = new Set<string>();

        for (const signal of this.cls.signals) {
            seenSignals.add(signal.name);
            allSignals.push(signal);
        }

        this.collectInterfaceSignals(seenSignals, allSignals);
        const hasCrossNamespaceParent = this.collectParentSignals(seenSignals, allSignals);

        return { allSignals, hasCrossNamespaceParent };
    }

    private buildOverloads(allSignals: GirSignal[]): MethodStructure["overloads"] {
        const overloads: NonNullable<MethodStructure["overloads"]> = [];

        for (const signal of allSignals) {
            const params = this.buildHandlerParams(signal);
            let returnType = "void";
            if (signal.returnType) {
                const mapped = this.ffiMapper.mapType(signal.returnType, true, signal.returnType.transferOwnership);
                addTypeImports(this.imports, mapped.imports, this.selfNames);
                returnType = mapped.ts;
            }

            overloads.push({
                params: [
                    { name: "signal", type: `"${signal.name}"` },
                    { name: "handler", type: `(${params}) => ${returnType}` },
                    { name: "after", type: "boolean", optional: true },
                ],
                returnType: "number",
            });
        }

        overloads.push({
            params: [
                { name: "signal", type: "string" },
                { name: "handler", type: "(...args: any[]) => any" },
                { name: "after", type: "boolean", optional: true },
            ],
            returnType: "number",
        });

        return overloads;
    }

    private writeConnectMethodBody(ownSignals: GirSignal[]): (writer: Writer) => void {
        const isRootGObject = this.options.namespace === "GObject" && this.cls.name === "Object";

        return (writer) => {
            if (ownSignals.length === 0) {
                writer.writeLine("return super.connect(signal, handler, after);");
                return;
            }

            writer.writeLine("switch (signal) {");
            writer.withIndent(() => {
                for (const signal of ownSignals) {
                    this.writeSignalCase(writer, signal);
                }
                this.writeDefaultCase(writer, isRootGObject);
            });
            writer.writeLine("}");
        };
    }

    private writeSignalCase(writer: Writer, signal: GirSignal): void {
        const filteredParams = filterVarargs(signal.parameters);
        const paramData = this.buildParamData(filteredParams);

        const returnMapped = signal.returnType
            ? this.ffiMapper.mapType(signal.returnType, true, signal.returnType.transferOwnership)
            : null;
        const returnUnwrapInfo = needsReturnUnwrap(returnMapped);

        writer.writeLine(`case "${signal.name}": {`);
        writer.withIndent(() => {
            this.writeWrappedHandler(writer, paramData, returnUnwrapInfo.needsUnwrap);
            this.writeCallExpression(writer, signal, paramData);
        });
        writer.writeLine("}");
    }

    private buildParamData(params: GirParameter[]): SignalParamData[] {
        return params.map((p) => {
            const mapped = this.ffiMapper.mapParameter(p);
            mapped.ffi = this.ffiMapper.enrichStructWithSize(mapped.ffi, String(p.type.name));
            addTypeImports(this.imports, mapped.imports, this.selfNames);
            if (mapped.ffi.type === "ref") {
                this.imports.addImport("@gtkx/native", ["Ref"]);
            }
            const wrapInfo = needsParamWrap(mapped);
            if (wrapInfo.isInterface) {
                this.imports.addImport("../../registry.js", ["getNativeObjectAsInterface"]);
            }
            return {
                mapped,
                paramName: toValidIdentifier(toCamelCase(p.name)),
                wrapInfo,
            };
        });
    }

    private writeRefDeclarations(writer: Writer, paramData: SignalParamData[]): void {
        for (const [i, p] of paramData.entries()) {
            if (p.mapped.ffi.type === "ref") {
                const innerType = p.mapped.innerTsType ?? "unknown";
                writer.writeLine(`const _ref${i} = { value: args[${i + 1}] as ${innerType} };`);
            }
        }
    }

    private writeHandlerArgs(writer: Writer, paramData: SignalParamData[], useRefVars: boolean): void {
        writer.writeLine(`getNativeObject(args[0] as NativeHandle) as ${this.className},`);
        paramData.forEach((p, index) => {
            if (useRefVars && p.mapped.ffi.type === "ref") {
                writer.write(`_ref${index}`);
            } else {
                const argAccess = `args[${index + 1}]`;
                writer.write(writeWrapExpression(argAccess, p.wrapInfo));
            }
            if (index < paramData.length - 1) {
                writer.write(",");
            }
            writer.newLine();
        });
    }

    private writeRefReturnTuple(writer: Writer, paramData: SignalParamData[], needsReturnUnwrap: boolean): void {
        const returnExpr = needsReturnUnwrap ? "_result?.handle" : "_result";
        writer.write(`return [${returnExpr}`);
        for (const [i, p] of paramData.entries()) {
            if (p.mapped.ffi.type === "ref") {
                writer.write(`, _ref${i}.value`);
            }
        }
        writer.writeLine("];");
    }

    private writeRefHandlerBody(writer: Writer, paramData: SignalParamData[], needsReturnUnwrap: boolean): void {
        this.writeRefDeclarations(writer, paramData);
        writer.write("const _result = handler(");
        writer.newLine();
        writer.withIndent(() => this.writeHandlerArgs(writer, paramData, true));
        writer.writeLine(");");
        this.writeRefReturnTuple(writer, paramData, needsReturnUnwrap);
    }

    private writeSimpleHandlerBody(writer: Writer, paramData: SignalParamData[], needsReturnUnwrap: boolean): void {
        writer.write(needsReturnUnwrap ? "const _result = handler(" : "return handler(");
        writer.newLine();
        writer.withIndent(() => this.writeHandlerArgs(writer, paramData, false));
        writer.writeLine(");");
        if (needsReturnUnwrap) {
            writer.writeLine("return _result?.handle;");
        }
    }

    private writeWrappedHandler(writer: Writer, paramData: SignalParamData[], needsReturnUnwrap: boolean): void {
        const hasRefParams = paramData.some((p) => p.mapped.ffi.type === "ref");

        writer.writeLine("const wrappedHandler = (...args: unknown[]) => {");
        writer.withIndent(() => {
            if (hasRefParams) {
                this.writeRefHandlerBody(writer, paramData, needsReturnUnwrap);
            } else {
                this.writeSimpleHandlerBody(writer, paramData, needsReturnUnwrap);
            }
        });
        writer.writeLine("};");
    }

    private writeCallExpression(writer: Writer, signal: GirSignal, paramData: SignalParamData[]): void {
        const userDataIndex = 1 + paramData.length;
        const argTypes: FfiTypeDescriptor[] = [
            { type: "gobject", ownership: "borrowed" },
            ...paramData.map((p) => p.mapped.ffi),
            { type: "void" },
        ];
        const returnType: FfiTypeDescriptor = signal.returnType
            ? this.ffiMapper.mapType(signal.returnType, true, signal.returnType.transferOwnership).ffi
            : { type: "void" };
        const trampolineType: FfiTypeDescriptor = {
            type: "trampoline",
            argTypes,
            returnType,
            hasDestroy: true,
            userDataIndex,
        };
        this.writeTrampolineSignalConnectCall(writer, trampolineType);
    }

    private writeDefaultCase(writer: Writer, isRootGObject: boolean): void {
        writer.writeLine("default:");
        writer.withIndent(() => {
            if (isRootGObject) {
                this.writeFallbackImplementation(writer);
            } else {
                writer.writeLine("return super.connect(signal, handler, after);");
            }
        });
    }

    private writeFallbackImplementation(writer: Writer): void {
        writer.writeLine("const wrappedHandler = (...args: unknown[]) => {");
        writer.withIndent(() => {
            writer.writeLine(
                `return handler(getNativeObject(args[0] as NativeHandle) as ${this.className}, ...args.slice(1));`,
            );
        });
        writer.writeLine("};");
        const callbackType: FfiTypeDescriptor = {
            type: "callback",
            kind: "closure",
            argTypes: [{ type: "gobject", ownership: "borrowed" }],
            returnType: { type: "void" },
        };
        this.writeClosureSignalConnectCall(writer, callbackType);
    }

    private writeTrampolineSignalConnectCall(writer: Writer, trampolineType: FfiTypeDescriptor): void {
        const callWriter = this.callExpression.toWriter({
            sharedLibrary: this.options.sharedLibrary,
            cIdentifier: "g_signal_connect_data",
            args: [
                { type: { type: "gobject", ownership: "borrowed" }, value: "this.handle" },
                { type: { type: "string", ownership: "borrowed" }, value: "signal" },
                { type: trampolineType, value: "wrappedHandler" },
                { type: { type: "uint32" }, value: "after ? 1 : 0" },
            ],
            returnType: { type: "uint64" },
        });
        writer.write("return ");
        callWriter(writer);
        writer.writeLine(" as number;");
    }

    private writeClosureSignalConnectCall(writer: Writer, callbackType: FfiTypeDescriptor): void {
        const callWriter = this.callExpression.toWriter({
            sharedLibrary: this.options.sharedLibrary,
            cIdentifier: "g_signal_connect_closure",
            args: [
                { type: { type: "gobject", ownership: "borrowed" }, value: "this.handle" },
                { type: { type: "string", ownership: "borrowed" }, value: "signal" },
                { type: callbackType, value: "wrappedHandler" },
                { type: { type: "boolean" }, value: "after ?? false" },
            ],
            returnType: { type: "uint64" },
        });
        writer.write("return ");
        callWriter(writer);
        writer.writeLine(" as number;");
    }

    private buildHandlerParams(signal: GirSignal): string {
        const params: string[] = [`self: ${this.className}`];

        for (const param of filterVarargs(signal.parameters)) {
            const mapped = this.ffiMapper.mapParameter(param);
            addTypeImports(this.imports, mapped.imports, this.selfNames);
            if (mapped.ffi.type === "ref") {
                this.imports.addImport("@gtkx/native", ["Ref"]);
            }
            const paramName = toValidIdentifier(toCamelCase(param.name));
            params.push(`${paramName}: ${mapped.ts}`);
        }

        return params.join(", ");
    }

    private buildEmitOverloads(ownSignals: GirSignal[]): NonNullable<MethodStructure["overloads"]> {
        const overloads: NonNullable<MethodStructure["overloads"]> = [];

        for (const signal of ownSignals) {
            const paramData = this.buildParamData(filterVarargs(signal.parameters));
            const returnTs = this.resolveReturnTsType(signal);
            const params: NonNullable<MethodStructure["overloads"]>[number]["params"] = [
                { name: "signal", type: `"${signal.name}"` },
            ];
            for (const p of paramData) {
                params.push({ name: p.paramName, type: p.mapped.ts });
            }
            overloads.push({ params, returnType: returnTs });
        }

        overloads.push({
            params: [
                { name: "signal", type: "string" },
                { name: "args", type: "any[]", isRestParameter: true },
            ],
            returnType: "any",
        });

        return overloads;
    }

    private resolveReturnTsType(signal: GirSignal): string {
        if (!signal.returnType) return "void";
        const mapped = this.ffiMapper.mapType(signal.returnType, true, signal.returnType.transferOwnership);
        addTypeImports(this.imports, mapped.imports, this.selfNames);
        return mapped.ts === "void" ? "void" : mapped.ts;
    }

    private writeEmitMethodBody(ownSignals: GirSignal[]): (writer: Writer) => void {
        const isRootGObject = this.options.namespace === "GObject" && this.cls.name === "Object";
        const gobjectPrefix = this.options.namespace === "GObject" ? "" : "GObject.";

        if (this.options.namespace === "GObject") {
            this.imports.addImport("./functions.js", ["signalEmitv", "signalLookup", "typeFromName"]);
            this.imports.addImport("./value.js", ["Value"]);
        }

        if (ownSignals.length > 0) {
            this.imports.addImport("../../native.js", ["t"]);
        }

        const needsCallImport = ownSignals.some((s) => {
            if (!s.returnType) return false;
            const mapped = this.ffiMapper.mapType(s.returnType, true, s.returnType.transferOwnership);
            return mapped.ffi.type === "enum" || mapped.ffi.type === "flags";
        });
        if (needsCallImport) {
            this.imports.addImport("../../native.js", ["call", "t"]);
        }

        return (writer) => {
            if (ownSignals.length === 0) {
                writer.writeLine("return super.emit(signal, ...args);");
                return;
            }

            writer.writeLine("switch (signal) {");
            writer.withIndent(() => {
                for (const signal of ownSignals) {
                    this.writeEmitSignalCase(writer, signal, gobjectPrefix);
                }
                writer.writeLine("default:");
                writer.withIndent(() => {
                    if (isRootGObject) {
                        writer.writeLine(`throw new Error(\`Unknown signal '\${signal}' on ${this.className}\`);`);
                    } else {
                        writer.writeLine("return super.emit(signal, ...args);");
                    }
                });
            });
            writer.writeLine("}");
        };
    }

    private writeEmitSignalCase(writer: Writer, signal: GirSignal, gobjectPrefix: string): void {
        const paramData = this.buildParamData(filterVarargs(signal.parameters));
        const returnMapped = signal.returnType
            ? this.ffiMapper.mapType(signal.returnType, true, signal.returnType.transferOwnership)
            : null;
        const hasReturnValue = returnMapped !== null && returnMapped.ts !== "void";

        writer.writeLine(`case "${signal.name}": {`);
        writer.withIndent(() => {
            writer.writeLine(`const __values: ${gobjectPrefix}Value[] = [`);
            writer.withIndent(() => {
                writer.write(`${gobjectPrefix}Value.newFrom(`);
                writeFfiTypeExpression(writer, { type: "gobject", ownership: "full" });
                writer.writeLine(", this),");
                paramData.forEach((p, index) => {
                    writer.write(`${gobjectPrefix}Value.newFrom(`);
                    writeFfiTypeExpression(writer, p.mapped.ffi);
                    writer.writeLine(`, args[${index}] as ${p.mapped.ts}),`);
                });
            });
            writer.writeLine("];");
            writer.writeLine(
                `const __signalId = ${gobjectPrefix}signalLookup("${signal.name}", ${this.className}.getGType());`,
            );

            if (hasReturnValue && returnMapped) {
                writer.writeLine(`const __returnValue = new ${gobjectPrefix}Value();`);
                writer.writeLine(`__returnValue.init(${this.gtypeInitExpression(returnMapped.ffi, gobjectPrefix)});`);
                writer.writeLine(`${gobjectPrefix}signalEmitv(__values, __signalId, 0, __returnValue);`);
                writer.writeLine(`return __returnValue.toJS() as ${returnMapped.ts};`);
            } else {
                writer.writeLine(`${gobjectPrefix}signalEmitv(__values, __signalId, 0);`);
                writer.writeLine("return undefined;");
            }
        });
        writer.writeLine("}");
    }

    private gtypeInitExpression(ffiType: FfiTypeDescriptor, gobjectPrefix: string): string {
        switch (ffiType.type) {
            case "boolean":
                return `${gobjectPrefix}typeFromName("gboolean")`;
            case "int8":
            case "int16":
            case "int32":
                return `${gobjectPrefix}typeFromName("gint")`;
            case "uint8":
            case "uint16":
            case "uint32":
                return `${gobjectPrefix}typeFromName("guint")`;
            case "int64":
                return `${gobjectPrefix}typeFromName("gint64")`;
            case "uint64":
                return `${gobjectPrefix}typeFromName("guint64")`;
            case "float32":
                return `${gobjectPrefix}typeFromName("gfloat")`;
            case "float64":
                return `${gobjectPrefix}typeFromName("gdouble")`;
            case "string":
                return `${gobjectPrefix}typeFromName("gchararray")`;
            case "gobject":
                return `${gobjectPrefix}typeFromName("GObject")`;
            case "boxed":
                return `${gobjectPrefix}typeFromName(${JSON.stringify(ffiType.innerType)})`;
            case "fundamental":
                return ffiType.typeName
                    ? `${gobjectPrefix}typeFromName(${JSON.stringify(ffiType.typeName)})`
                    : `${gobjectPrefix}typeFromName("GObject")`;
            case "enum":
            case "flags":
                return `(call(${JSON.stringify(ffiType.library)}, ${JSON.stringify(ffiType.getTypeFn)}, [], t.uint64) as number)`;
            default:
                return `${gobjectPrefix}typeFromName("GObject")`;
        }
    }
}
