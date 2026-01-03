/**
 * Signal Builder
 *
 * Builds signal connection code for classes.
 * Generates switch-case statements with inlined type info for own signals,
 * delegating inherited signals to super.connect().
 */

import {
    type GirRepository,
    type NormalizedClass,
    type NormalizedParameter,
    type NormalizedSignal,
    parseQualifiedName,
    type QualifiedName,
} from "@gtkx/gir";
import type { CodeBlockWriter, MethodDeclarationStructure, WriterFunction } from "ts-morph";
import { StructureKind } from "ts-morph";
import type { GenerationContext } from "../../../core/generation-context.js";
import type { FfiGeneratorOptions } from "../../../core/generator-types.js";
import type { FfiMapper } from "../../../core/type-system/ffi-mapper.js";
import type { MappedType } from "../../../core/type-system/ffi-types.js";
import { collectDirectMembers, collectParentSignalNames } from "../../../core/utils/class-traversal.js";
import { filterVarargs } from "../../../core/utils/filtering.js";
import { normalizeClassName, toCamelCase, toValidIdentifier } from "../../../core/utils/naming.js";
import type { Writers } from "../../../core/writers/index.js";
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
        private readonly cls: NormalizedClass,
        private readonly ffiMapper: FfiMapper,
        private readonly ctx: GenerationContext,
        private readonly repository: GirRepository,
        private readonly writers: Writers,
        private readonly options: FfiGeneratorOptions,
    ) {
        this.className = normalizeClassName(cls.name, options.namespace);
    }

    buildConnectMethodStructures(): MethodDeclarationStructure[] {
        const ownSignals = this.collectOwnSignals();
        const hasSignalConnect = ownSignals.length > 0;

        if (!hasSignalConnect) {
            return [];
        }

        this.ctx.usesCall = true;
        this.ctx.usesGetNativeObject = true;
        if (this.options.namespace !== "GObject") {
            this.ctx.usesGObjectNamespace = true;
        } else {
            this.ctx.usedSameNamespaceClasses.set("ParamSpec", "ParamSpec");
        }

        const overloads = this.buildOverloads(ownSignals);

        return [
            {
                kind: StructureKind.Method,
                name: "connect",
                overloads,
                parameters: [
                    { name: "signal", type: "string" },
                    { name: "handler", type: "(...args: any[]) => any" },
                    { name: "after", initializer: "false" },
                ],
                returnType: "number",
                statements: this.writeConnectMethodBody(ownSignals),
            },
        ];
    }

    collectOwnSignals(): NormalizedSignal[] {
        return collectDirectMembers({
            cls: this.cls,
            repo: this.repository,
            getClassMembers: (c) => c.signals,
            getInterfaceMembers: (i) => i.signals,
            getParentNames: collectParentSignalNames,
            transformName: toCamelCase,
        });
    }

    collectAllSignals(): { allSignals: NormalizedSignal[]; hasCrossNamespaceParent: boolean } {
        const allSignals: NormalizedSignal[] = [];
        const seenSignals = new Set<string>();
        let hasCrossNamespaceParent = false;

        for (const signal of this.cls.signals) {
            seenSignals.add(signal.name);
            allSignals.push(signal);
        }

        for (const ifaceQualifiedName of this.cls.implements) {
            const iface = this.repository.resolveInterface(ifaceQualifiedName as QualifiedName);
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
                const { namespace: parentNs } = parseQualifiedName(this.cls.parent as QualifiedName);
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

    private buildOverloads(
        allSignals: NormalizedSignal[],
    ): Array<{ parameters: Array<{ name: string; type?: string; hasQuestionToken?: boolean }>; returnType: string }> {
        const overloads: Array<{
            parameters: Array<{ name: string; type?: string; hasQuestionToken?: boolean }>;
            returnType: string;
        }> = [];

        for (const signal of allSignals) {
            const params = this.buildHandlerParams(signal);
            let returnType = "void";
            if (signal.returnType) {
                const mapped = this.ffiMapper.mapType(signal.returnType, true, signal.returnType.transferOwnership);
                this.ctx.addTypeImports(mapped.imports);
                returnType = mapped.ts;
            }

            overloads.push({
                parameters: [
                    { name: "signal", type: `"${signal.name}"` },
                    { name: "handler", type: `(${params}) => ${returnType}` },
                    { name: "after", type: "boolean", hasQuestionToken: true },
                ],
                returnType: "number",
            });
        }

        overloads.push({
            parameters: [
                { name: "signal", type: "string" },
                { name: "handler", type: "(...args: any[]) => any" },
                { name: "after", type: "boolean", hasQuestionToken: true },
            ],
            returnType: "number",
        });

        return overloads;
    }

    private writeConnectMethodBody(ownSignals: NormalizedSignal[]): WriterFunction {
        const isRootGObject = this.options.namespace === "GObject" && this.cls.name === "Object";

        return (writer) => {
            if (ownSignals.length === 0) {
                writer.writeLine("return super.connect(signal, handler, after);");
                return;
            }

            writer.writeLine("switch (signal) {");
            writer.indent(() => {
                for (const signal of ownSignals) {
                    this.writeSignalCase(writer, signal);
                }
                this.writeDefaultCase(writer, isRootGObject);
            });
            writer.writeLine("}");
        };
    }

    private writeSignalCase(writer: CodeBlockWriter, signal: NormalizedSignal): void {
        const filteredParams = filterVarargs(signal.parameters);
        const paramData = this.buildParamData(filteredParams);

        writer.writeLine(`case "${signal.name}": {`);
        writer.indent(() => {
            this.writeWrappedHandler(writer, paramData);
            this.writeCallExpression(writer, signal, paramData);
        });
        writer.writeLine("}");
    }

    private buildParamData(params: NormalizedParameter[]): SignalParamData[] {
        return params.map((p) => {
            const mapped = this.ffiMapper.mapParameter(p);
            this.ctx.addTypeImports(mapped.imports);
            if (mapped.ffi.type === "ref") {
                this.ctx.usesRef = true;
            }
            return {
                mapped,
                paramName: toValidIdentifier(toCamelCase(p.name)),
                wrapInfo: this.paramWrapWriter.needsParamWrap(mapped),
            };
        });
    }

    private writeWrappedHandler(writer: CodeBlockWriter, paramData: SignalParamData[]): void {
        writer.writeLine("const wrappedHandler = (...args: unknown[]) => {");
        writer.indent(() => {
            writer.write("return handler(");
            writer.newLine();
            writer.indent(() => {
                writer.writeLine(`getNativeObject(args[0]) as ${this.className},`);
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
        });
        writer.writeLine("};");
    }

    private writeCallExpression(writer: CodeBlockWriter, signal: NormalizedSignal, paramData: SignalParamData[]): void {
        this.writeSignalConnectCall(writer, (w) => {
            w.write('type: "callback", ');
            this.writeArgTypes(w, paramData);
            w.write(", ");
            this.writeReturnType(w, signal);
            w.write(', trampoline: "closure"');
        });
    }

    private writeArgTypes(writer: CodeBlockWriter, paramData: SignalParamData[]): void {
        writer.write("argTypes: [");
        writer.write('{ type: "gobject", ownership: "none" }');
        for (const p of paramData) {
            writer.write(", ");
            this.writers.ffiTypeWriter.toWriter(p.mapped.ffi)(writer);
        }
        writer.write("]");
    }

    private writeReturnType(writer: CodeBlockWriter, signal: NormalizedSignal): void {
        writer.write("returnType: ");
        if (signal.returnType) {
            const mapped = this.ffiMapper.mapType(signal.returnType, true, signal.returnType.transferOwnership);
            this.writers.ffiTypeWriter.toWriter(mapped.ffi)(writer);
        } else {
            writer.write('{ type: "undefined" }');
        }
    }

    private writeDefaultCase(writer: CodeBlockWriter, isRootGObject: boolean): void {
        writer.writeLine("default:");
        writer.indent(() => {
            if (isRootGObject) {
                this.writeFallbackImplementation(writer);
            } else {
                writer.writeLine("return super.connect(signal, handler, after);");
            }
        });
    }

    private writeFallbackImplementation(writer: CodeBlockWriter): void {
        writer.writeLine("const wrappedHandler = (...args: unknown[]) => {");
        writer.indent(() => {
            writer.writeLine(`return handler(getNativeObject(args[0]) as ${this.className}, ...args.slice(1));`);
        });
        writer.writeLine("};");
        this.writeSignalConnectCall(writer, (w) => {
            w.write('type: "callback", argTypes: [{ type: "gobject", ownership: "none" }], trampoline: "closure"');
        });
    }

    private writeSignalConnectCall(writer: CodeBlockWriter, callbackTypeWriter: (w: CodeBlockWriter) => void): void {
        writer.writeLine("return call(");
        writer.indent(() => {
            writer.writeLine(`"${this.options.sharedLibrary}",`);
            writer.writeLine('"g_signal_connect_closure",');
            writer.writeLine("[");
            writer.indent(() => {
                writer.writeLine('{ type: { type: "gobject", ownership: "none" }, value: this.id },');
                writer.writeLine('{ type: { type: "string", ownership: "none" }, value: signal },');
                writer.writeLine("{");
                writer.indent(() => {
                    writer.write("type: { ");
                    callbackTypeWriter(writer);
                    writer.writeLine(" },");
                    writer.writeLine("value: wrappedHandler,");
                });
                writer.writeLine("},");
                writer.writeLine('{ type: { type: "boolean" }, value: after },');
            });
            writer.writeLine("],");
            writer.writeLine('{ type: "int", size: 64, unsigned: true }');
        });
        writer.writeLine(") as number;");
    }

    private buildHandlerParams(signal: NormalizedSignal): string {
        const params: string[] = [`self: ${this.className}`];

        for (const param of filterVarargs(signal.parameters)) {
            const mapped = this.ffiMapper.mapParameter(param);
            this.ctx.addTypeImports(mapped.imports);
            if (mapped.ffi.type === "ref") {
                this.ctx.usesRef = true;
            }
            const paramName = toValidIdentifier(toCamelCase(param.name));
            params.push(`${paramName}: ${mapped.ts}`);
        }

        return params.join(", ");
    }
}
