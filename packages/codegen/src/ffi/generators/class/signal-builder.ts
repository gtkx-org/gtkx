/**
 * Signal Builder
 *
 * Builds signal connection code for classes.
 * Signal metadata is now embedded in WIDGET_META.signals.
 */

import {
    type GirRepository,
    type NormalizedClass,
    type NormalizedSignal,
    parseQualifiedName,
    type QualifiedName,
} from "@gtkx/gir";
import type { MethodDeclarationStructure, WriterFunction } from "ts-morph";
import { StructureKind, Writers as TsMorphWriters } from "ts-morph";
import type { GenerationContext } from "../../../core/generation-context.js";
import type { FfiGeneratorOptions } from "../../../core/generator-types.js";
import type { FfiMapper } from "../../../core/type-system/ffi-mapper.js";
import { normalizeClassName, toCamelCase, toValidIdentifier } from "../../../core/utils/naming.js";
import type { Writers } from "../../../core/writers/index.js";

/**
 * Structured signal metadata entry.
 * Used for proper ts-morph code generation without string parsing.
 */
export type SignalMetaEntry = {
    /** Signal name (e.g., "clicked", "notify") */
    name: string;
    /** FFI type descriptors for signal parameters */
    params: WriterFunction[];
    /** FFI type descriptor for return type */
    returnType: WriterFunction;
};

/**
 * Builds signal connection code for a class.
 */
export class SignalBuilder {
    private readonly className: string;

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

    /**
     * Collects only the signals defined directly on this class (not inherited).
     */
    collectOwnSignals(): NormalizedSignal[] {
        return [...this.cls.signals];
    }

    /**
     * Builds signal metadata entries for WIDGET_META.signals.
     * Only includes signals defined directly on this class.
     *
     * Returns structured data instead of strings for proper ts-morph integration.
     *
     * @returns Array of structured signal metadata entries
     */
    buildSignalMetaEntries(): SignalMetaEntry[] {
        const ownSignals = this.collectOwnSignals();
        const entries: SignalMetaEntry[] = [];

        for (const signal of ownSignals) {
            const params = signal.parameters
                .filter((p) => p.name !== "..." && p.name !== "")
                .map((p) => {
                    const mapped = this.ffiMapper.mapParameter(p);
                    this.ctx.addTypeImports(mapped.imports);
                    if (mapped.ffi.type === "ref") {
                        this.ctx.usesRef = true;
                    }
                    return this.writers.ffiTypeWriter.toWriter(mapped.ffi);
                });

            const returnType = signal.returnType
                ? this.writers.ffiTypeWriter.toWriter(this.ffiMapper.mapType(signal.returnType, true).ffi)
                : TsMorphWriters.object({ type: '"undefined"' });

            entries.push({
                name: signal.name,
                params,
                returnType,
            });
        }

        return entries;
    }

    /**
     * Builds connect method structures (overloads and implementation).
     * Returns structures for batch adding by ClassGenerator.
     *
     * Uses ts-morph's `overloads` property to properly generate method overloads
     * without empty function bodies.
     *
     * @returns Array of method declaration structures, empty if no signals exist
     */
    buildConnectMethodStructures(): MethodDeclarationStructure[] {
        const { allSignals, hasCrossNamespaceParent } = this.collectAllSignals();
        const hasSignalConnect = allSignals.length > 0 || hasCrossNamespaceParent;

        if (!hasSignalConnect) {
            return [];
        }

        this.ctx.usesCall = true;
        this.ctx.usesResolveSignalMeta = true;
        this.ctx.usesType = true;
        this.ctx.usesGetNativeObject = true;
        if (this.options.namespace !== "GObject") {
            this.ctx.usesGObjectNamespace = true;
        } else {
            this.ctx.usedSameNamespaceClasses.set("ParamSpec", "ParamSpec");
        }

        const overloads: Array<{
            parameters: Array<{ name: string; type?: string; hasQuestionToken?: boolean }>;
            returnType: string;
        }> = [];

        for (const signal of allSignals) {
            const params = this.buildHandlerParams(signal);
            let returnType = "void";
            if (signal.returnType) {
                const mapped = this.ffiMapper.mapType(signal.returnType, true);
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
                statements: this.writeConnectMethodBody(),
            },
        ];
    }

    /**
     * Writes the connect method body using ts-morph WriterFunction.
     */
    private writeConnectMethodBody(): WriterFunction {
        return (writer) => {
            writer.writeLine("const meta = resolveSignalMeta(this.constructor, signal);");
            writer.writeLine('const selfType: Type = { type: "gobject", ownership: "none" };');
            writer.writeLine("const argTypes = meta ? [selfType, ...meta.params] : [selfType];");
            writer.writeLine("const returnType = meta?.returnType;");

            writer.writeLine("const wrappedHandler = (...args: unknown[]) => {");
            writer.indent(() => {
                writer.writeLine("const self = getNativeObject(args[0]);");
                writer.writeLine("const callbackArgs = args.slice(1);");
                writer.writeLine("if (!meta) return handler(self, ...callbackArgs);");
                writer.writeLine("const wrapped = meta.params.map((t, i) => {");
                writer.indent(() => {
                    writer.writeLine('if (t?.type === "gobject" && callbackArgs[i] != null) {');
                    writer.indent(() => {
                        writer.writeLine("return getNativeObject(callbackArgs[i]);");
                    });
                    writer.writeLine("}");
                    writer.writeLine('if (t?.type === "gparam" && callbackArgs[i] != null) {');
                    writer.indent(() => {
                        const paramSpecRef = this.options.namespace === "GObject" ? "ParamSpec" : "GObject.ParamSpec";
                        writer.writeLine(`return getNativeObject(callbackArgs[i], ${paramSpecRef});`);
                    });
                    writer.writeLine("}");
                    writer.writeLine("return callbackArgs[i];");
                });
                writer.writeLine("});");
                writer.writeLine("const result = handler(self, ...wrapped);");
                writer.writeLine("return result;");
            });
            writer.writeLine("};");

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
                        writer.writeLine('type: { type: "callback", argTypes, returnType, trampoline: "closure" },');
                        writer.writeLine("value: wrappedHandler,");
                    });
                    writer.writeLine("},");
                    writer.writeLine('{ type: { type: "boolean" }, value: after },');
                });
                writer.writeLine("],");
                writer.writeLine('{ type: "int", size: 64, unsigned: true }');
            });
            writer.writeLine(") as number;");
        };
    }

    /**
     * Collects all signals from the class and its parent chain.
     */
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

    private buildHandlerParams(signal: NormalizedSignal): string {
        const params: string[] = [];

        params.push(`self: ${this.className}`);

        for (const param of signal.parameters) {
            if (param.name === "..." || param.name === "") continue;

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
