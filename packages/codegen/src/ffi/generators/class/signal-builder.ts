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
import type { MappedType } from "../../../core/type-system/ffi-types.js";
import { collectDirectMembers, collectParentSignalNames } from "../../../core/utils/class-traversal.js";
import { filterVarargs } from "../../../core/utils/filtering.js";
import { normalizeClassName, toCamelCase, toValidIdentifier } from "../../../core/utils/naming.js";
import { splitQualifiedName } from "../../../core/utils/qualified-name.js";
import { addTypeImports, type ImportCollector, type MethodStructure } from "../../../core/writers/index.js";
import { type ParamWrapInfo, ParamWrapWriter } from "../../../core/writers/param-wrap-writer.js";

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
    private readonly paramWrapWriter = new ParamWrapWriter();

    constructor(
        private readonly cls: GirClass,
        private readonly ffiMapper: FfiMapper,
        private readonly imports: ImportCollector,
        private readonly repository: GirRepository,
        private readonly options: FfiGeneratorOptions,
        private readonly selfNames: ReadonlySet<string> = new Set(),
    ) {
        this.className = normalizeClassName(cls.name);
    }

    buildConnectMethodStructures(): MethodStructure[] {
        const ownSignals = this.collectOwnSignals();
        const hasSignalConnect = ownSignals.length > 0;

        if (!hasSignalConnect) {
            return [];
        }

        this.imports.addImport("../../native.js", ["call"]);
        this.imports.addTypeImport("../../object.js", ["NativeHandle"]);
        this.imports.addImport("../../registry.js", ["getNativeObject"]);
        if (this.options.namespace !== "GObject") {
            this.imports.addNamespaceImport("../gobject/index.js", "GObject");
        } else {
            this.imports.addImport("./param-spec.js", ["ParamSpec"]);
        }

        const overloads = this.buildOverloads(ownSignals);

        return [
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
        ];
    }

    collectOwnSignals(): GirSignal[] {
        return collectDirectMembers({
            cls: this.cls,
            repo: this.repository,
            getClassMembers: (c) => c.signals,
            getInterfaceMembers: (i) => i.signals,
            getParentNames: collectParentSignalNames,
            transformName: toCamelCase,
        });
    }

    collectAllSignals(): { allSignals: GirSignal[]; hasCrossNamespaceParent: boolean } {
        const allSignals: GirSignal[] = [];
        const seenSignals = new Set<string>();
        let hasCrossNamespaceParent = false;

        for (const signal of this.cls.signals) {
            seenSignals.add(signal.name);
            allSignals.push(signal);
        }

        for (const ifaceQualifiedName of this.cls.implements) {
            const iface = this.repository.resolveInterface(ifaceQualifiedName);
            if (!iface) continue;

            for (const signal of iface.signals) {
                if (!seenSignals.has(signal.name)) {
                    seenSignals.add(signal.name);
                    allSignals.push(signal);
                }
            }
        }

        let parent = this.cls.getParent();
        while (parent) {
            if (this.cls.parent?.includes(".")) {
                const { namespace: parentNs } = splitQualifiedName(this.cls.parent);
                if (parentNs !== this.options.namespace) {
                    hasCrossNamespaceParent = true;
                    break;
                }
            }

            for (const signal of parent.signals) {
                if (!seenSignals.has(signal.name)) {
                    seenSignals.add(signal.name);
                    allSignals.push(signal);
                }
            }
            parent = parent.getParent();
        }

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
        const returnUnwrapInfo = this.paramWrapWriter.needsReturnUnwrap(returnMapped);

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
            addTypeImports(this.imports, mapped.imports, this.selfNames);
            if (mapped.ffi.type === "ref") {
                this.imports.addImport("@gtkx/native", ["Ref"]);
            }
            return {
                mapped,
                paramName: toValidIdentifier(toCamelCase(p.name)),
                wrapInfo: this.paramWrapWriter.needsParamWrap(mapped),
            };
        });
    }

    private writeWrappedHandler(writer: Writer, paramData: SignalParamData[], needsReturnUnwrap: boolean): void {
        const hasRefParams = paramData.some((p) => p.mapped.ffi.type === "ref");

        writer.writeLine("const wrappedHandler = (...args: unknown[]) => {");
        writer.withIndent(() => {
            if (hasRefParams) {
                for (const [i, p] of paramData.entries()) {
                    if (p.mapped.ffi.type === "ref") {
                        const innerType = p.mapped.innerTsType ?? "unknown";
                        writer.writeLine(`const _ref${i} = { value: args[${i + 1}] as ${innerType} };`);
                    }
                }

                writer.write("const _result = handler(");
                writer.newLine();
                writer.withIndent(() => {
                    writer.writeLine(`getNativeObject(args[0] as NativeHandle) as ${this.className},`);
                    paramData.forEach((p, index) => {
                        if (p.mapped.ffi.type === "ref") {
                            writer.write(`_ref${index}`);
                        } else {
                            const argAccess = `args[${index + 1}]`;
                            writer.write(this.paramWrapWriter.writeWrapExpression(argAccess, p.wrapInfo));
                        }
                        if (index < paramData.length - 1) {
                            writer.write(",");
                        }
                        writer.newLine();
                    });
                });
                writer.writeLine(");");

                const returnExpr = needsReturnUnwrap ? "_result?.handle" : "_result";
                writer.write(`return [${returnExpr}`);
                for (const [i, p] of paramData.entries()) {
                    if (p.mapped.ffi.type === "ref") {
                        writer.write(`, _ref${i}.value`);
                    }
                }
                writer.writeLine("];");
            } else {
                if (needsReturnUnwrap) {
                    writer.write("const _result = handler(");
                } else {
                    writer.write("return handler(");
                }
                writer.newLine();
                writer.withIndent(() => {
                    writer.writeLine(`getNativeObject(args[0] as NativeHandle) as ${this.className},`);
                    paramData.forEach((p, index) => {
                        const argAccess = `args[${index + 1}]`;
                        const expression = this.paramWrapWriter.writeWrapExpression(argAccess, p.wrapInfo);
                        writer.write(expression);
                        if (index < paramData.length - 1) {
                            writer.write(",");
                        }
                        writer.newLine();
                    });
                });
                writer.writeLine(");");
                if (needsReturnUnwrap) {
                    writer.writeLine("return _result?.handle;");
                }
            }
        });
        writer.writeLine("};");
    }

    private writeCallExpression(writer: Writer, signal: GirSignal, paramData: SignalParamData[]): void {
        const userDataIndex = 1 + paramData.length;
        this.writeTrampolineSignalConnectCall(writer, (w) => {
            w.write('type: "trampoline", ');
            this.writeTrampolineArgTypes(w, paramData);
            w.write(", ");
            this.writeReturnType(w, signal);
            w.write(`, hasDestroy: true, userDataIndex: ${userDataIndex}`);
        });
    }

    private writeTrampolineArgTypes(writer: Writer, paramData: SignalParamData[]): void {
        writer.write("argTypes: [");
        writer.write('{ type: "gobject", ownership: "borrowed" }');
        for (const p of paramData) {
            writer.write(", ");
            writer.write(JSON.stringify(p.mapped.ffi));
        }
        writer.write(', { type: "void" }');
        writer.write("]");
    }

    private writeReturnType(writer: Writer, signal: GirSignal): void {
        writer.write("returnType: ");
        if (signal.returnType) {
            const mapped = this.ffiMapper.mapType(signal.returnType, true, signal.returnType.transferOwnership);
            writer.write(JSON.stringify(mapped.ffi));
        } else {
            writer.write('{ type: "void" }');
        }
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
        this.writeClosureSignalConnectCall(writer, (w) => {
            w.write(
                'type: "callback", argTypes: [{ type: "gobject", ownership: "borrowed" }], returnType: { type: "void" }, kind: "closure"',
            );
        });
    }

    private writeTrampolineSignalConnectCall(writer: Writer, trampolineTypeWriter: (w: Writer) => void): void {
        writer.writeLine("return call(");
        writer.withIndent(() => {
            writer.writeLine(`"${this.options.sharedLibrary}",`);
            writer.writeLine('"g_signal_connect_data",');
            writer.writeLine("[");
            writer.withIndent(() => {
                writer.writeLine('{ type: { type: "gobject", ownership: "borrowed" }, value: this.handle },');
                writer.writeLine('{ type: { type: "string", ownership: "borrowed" }, value: signal },');
                writer.writeLine("{");
                writer.withIndent(() => {
                    writer.write("type: { ");
                    trampolineTypeWriter(writer);
                    writer.writeLine(" },");
                    writer.writeLine("value: wrappedHandler,");
                });
                writer.writeLine("},");
                writer.writeLine('{ type: { type: "uint32" }, value: after ? 1 : 0 },');
            });
            writer.writeLine("],");
            writer.writeLine('{ type: "uint64" }');
        });
        writer.writeLine(") as number;");
    }

    private writeClosureSignalConnectCall(writer: Writer, callbackTypeWriter: (w: Writer) => void): void {
        writer.writeLine("return call(");
        writer.withIndent(() => {
            writer.writeLine(`"${this.options.sharedLibrary}",`);
            writer.writeLine('"g_signal_connect_closure",');
            writer.writeLine("[");
            writer.withIndent(() => {
                writer.writeLine('{ type: { type: "gobject", ownership: "borrowed" }, value: this.handle },');
                writer.writeLine('{ type: { type: "string", ownership: "borrowed" }, value: signal },');
                writer.writeLine("{");
                writer.withIndent(() => {
                    writer.write("type: { ");
                    callbackTypeWriter(writer);
                    writer.writeLine(" },");
                    writer.writeLine("value: wrappedHandler,");
                });
                writer.writeLine("},");
                writer.writeLine('{ type: { type: "boolean" }, value: after },');
            });
            writer.writeLine("],");
            writer.writeLine('{ type: "uint64" }');
        });
        writer.writeLine(") as number;");
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
}
