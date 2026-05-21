/**
 * Signal Builder
 *
 * Builds the `connect` and `emit` methods for a class as thin delegations to
 * the runtime signal dispatcher (`connectSignal` / `emitSignal`), plus the
 * per-class `registerSignalMeta` table describing each own signal's
 * trampoline descriptor, argument marshalling, and emit types. The repeated
 * `switch`-case machinery is interpreted at runtime instead of inlined into
 * every class.
 */

import type { Writer } from "../../../builders/text-writer.js";
import type { FfiDescriptorRegistry } from "../../../ffi-emitters/descriptor-registry.js";
import { writeFfiTypeExpression } from "../../../ffi-emitters/ffi-type-expression.js";
import {
    addTypeImports,
    createMethodBodyWriter,
    type ImportCollector,
    type MethodBodyWriter,
    type MethodStructure,
} from "../../../ffi-emitters/index.js";
import { resolveNamespaceImportPath } from "../../../ffi-emitters/namespace-import-path.js";
import {
    needsParamWrap,
    needsReturnUnwrap,
    type ParamWrapInfo,
    writeWrapExpression,
} from "../../../ffi-emitters/param-wrap-writer.js";
import type { FfiGeneratorOptions } from "../../../generator-types.js";
import type { GirClass, GirParameter, GirRepository, GirSignal } from "../../../gir/index.js";
import type { FfiMapper } from "../../../type-system/ffi-mapper.js";
import type { FfiTypeDescriptor, MappedType } from "../../../type-system/ffi-types.js";
import { collectDirectMembers, collectParentSignalNames } from "../../../utils/class-traversal.js";
import { filterVarargs } from "../../../utils/filtering.js";
import { jsStringLiteral } from "../../../utils/js-literal.js";
import { normalizeClassName, toCamelCase, toValidIdentifier } from "../../../utils/naming.js";
import { splitQualifiedName } from "../../../utils/qualified-name.js";

type SignalParamData = {
    mapped: MappedType;
    paramName: string;
    wrapInfo: ParamWrapInfo;
};

/**
 * Options for {@link SignalBuilder}.
 */
export type SignalBuilderOptions = {
    cls: GirClass;
    ffiMapper: FfiMapper;
    imports: ImportCollector;
    repository: GirRepository;
    options: FfiGeneratorOptions;
    selfNames?: ReadonlySet<string>;
};

/**
 * Builds signal connection code for a class.
 */
export class SignalBuilder {
    private readonly className: string;
    private readonly methodBody: MethodBodyWriter;
    private readonly descriptors: FfiDescriptorRegistry | undefined;
    private readonly cls: GirClass;
    private readonly ffiMapper: FfiMapper;
    private readonly imports: ImportCollector;
    private readonly repository: GirRepository;
    private readonly options: FfiGeneratorOptions;
    private readonly selfNames: ReadonlySet<string>;

    constructor(opts: SignalBuilderOptions) {
        const { cls, ffiMapper, imports, repository, options, selfNames = new Set() } = opts;
        this.cls = cls;
        this.ffiMapper = ffiMapper;
        this.imports = imports;
        this.repository = repository;
        this.options = options;
        this.selfNames = selfNames;
        this.className = normalizeClassName(cls.name);
        this.descriptors = imports.descriptors;
        this.methodBody = createMethodBodyWriter(ffiMapper, imports, {
            sharedLibrary: options.sharedLibrary,
            glibLibrary: options.glibLibrary,
            selfNames,
        });
    }

    private isRootGObject(): boolean {
        return this.options.namespace === "GObject" && this.cls.name === "Object";
    }

    /**
     * Builds the `connect` and `emit` method structures for the class.
     *
     * Both delegate to the runtime signal dispatcher; the per-signal data
     * lives in the table emitted by {@link buildSignalMetaWriter}. Returns an
     * empty array when the class declares no own signals.
     */
    buildConnectMethodStructures(): MethodStructure[] {
        const ownSignals = this.collectOwnSignals();
        if (ownSignals.length === 0) {
            return [];
        }

        this.imports.addImport("../../runtime.js", ["connectSignal", "emitSignal"]);
        this.imports.addImport("../../registry.js", ["getNativeObject"]);

        const cls = this.className;
        const root = this.isRootGObject();
        const connectBody = root
            ? `return connectSignal({ instance: this, cls: ${cls} }, signal, handler, { after });`
            : `return connectSignal({ instance: this, cls: ${cls} }, signal, handler, { after, parentConnect: (s, h, a) => super.connect(s, h, a) });`;
        const emitBody = root
            ? `emitSignal({ instance: this, cls: ${cls} }, sigName, args);`
            : `emitSignal({ instance: this, cls: ${cls} }, sigName, args, (s, ...a) => super.emit(s, ...a));`;

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
                        description: `Connects a handler to a signal on this ${cls}.\n\n@param signal - The signal name to connect to\n@param handler - Callback function invoked when signal is emitted\n@param after - If true, handler is called after default handler\n@returns Connection ID for disconnecting`,
                    },
                ],
                statements: (writer) => {
                    writer.writeLine(connectBody);
                },
                overloads: this.buildOverloads(ownSignals),
            },
            {
                name: "emit",
                parameters: [
                    { name: "sigName", type: "string" },
                    { name: "args", type: "any[]", isRestParameter: true },
                ],
                returnType: undefined,
                docs: [
                    {
                        description: `Synchronously emits a signal on this ${cls}.\n\nArguments are auto-marshalled into GValues based on the signal's GIR-defined parameter types.\n\n@param sigName - The signal name to emit\n@param args - Arguments matching the signal's parameter list`,
                    },
                ],
                statements: (writer) => {
                    writer.writeLine(emitBody);
                },
                overloads: this.buildEmitOverloads(ownSignals),
            },
        ];
    }

    /**
     * Builds the writer that emits the trailing `registerSignalMeta(...)`
     * module-load call. Returns `null` when the class has no own signals.
     */
    buildSignalMetaWriter(): ((writer: Writer) => void) | null {
        const ownSignals = this.collectOwnSignals();
        if (ownSignals.length === 0) {
            return null;
        }

        this.imports.addImport("../../runtime.js", ["registerSignalMeta"]);
        const gtypeRef = this.gtypeRef();
        const gobjectArg = this.gobjectArgExpression();

        return (writer) => {
            writer.writeLine("");
            writer.writeLine(`registerSignalMeta(${this.className}, new globalThis.Map([`);
            writer.withIndent(() => {
                for (const signal of ownSignals) {
                    this.writeSignalDescriptorEntry(writer, signal);
                }
            });
            writer.writeLine(`]), ${gtypeRef}, ${gobjectArg});`);
        };
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

    private buildHandlerParams(signal: GirSignal): string {
        const params: string[] = [];
        for (const param of filterVarargs(signal.parameters)) {
            const mapped = this.ffiMapper.mapParameter(param);
            addTypeImports(this.imports, mapped.imports, this.selfNames);
            if (mapped.ffi.type === "ref") {
                this.imports.addTypeImport("@gtkx/native", ["Ref"]);
            }
            const paramName = toValidIdentifier(toCamelCase(param.name));
            params.push(`${paramName}: ${mapped.ts}`);
        }
        return params.join(", ");
    }

    private buildOverloads(ownSignals: GirSignal[]): MethodStructure["overloads"] {
        const overloads: NonNullable<MethodStructure["overloads"]> = [];
        for (const signal of ownSignals) {
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

    private buildEmitOverloads(ownSignals: GirSignal[]): NonNullable<MethodStructure["overloads"]> {
        const overloads: NonNullable<MethodStructure["overloads"]> = [];
        for (const signal of ownSignals) {
            overloads.push({
                params: [
                    { name: "sigName", type: `"${signal.name}"` },
                    { name: "args", type: "any[]", isRestParameter: true },
                ],
                returnType: "void",
            });
        }
        overloads.push({
            params: [
                { name: "sigName", type: "string" },
                { name: "args", type: "any[]", isRestParameter: true },
            ],
            returnType: "void",
        });
        return overloads;
    }

    private buildParamData(params: GirParameter[]): SignalParamData[] {
        return params.map((p) => {
            const mapped = this.ffiMapper.mapParameter(p);
            mapped.ffi = this.ffiMapper.enrichStructWithSize(mapped.ffi, String(p.type.name));
            addTypeImports(this.imports, mapped.imports, this.selfNames);
            if (mapped.ffi.type === "ref") {
                this.imports.addTypeImport("@gtkx/native", ["Ref"]);
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

    private writeSignalDescriptorEntry(writer: Writer, signal: GirSignal): void {
        const paramData = this.buildParamData(filterVarargs(signal.parameters));
        const returnMapped = signal.returnType
            ? this.ffiMapper.mapType(signal.returnType, true, signal.returnType.transferOwnership)
            : null;
        const returnUnwrap = needsReturnUnwrap(returnMapped).needsUnwrap;
        const hasReturnValue = returnMapped !== null && returnMapped.ts !== "void";

        writer.writeLine(`["${signal.name}", {`);
        writer.withIndent(() => {
            writer.write("trampoline: ");
            writeFfiTypeExpression(writer, this.buildTrampolineType(signal, paramData));
            writer.writeLine(",");

            writer.write("invoke: ");
            this.writeInvokeClosure(writer, paramData, returnUnwrap);
            writer.writeLine(",");

            writer.write("emitTypes: [");
            paramData.forEach((p, index) => {
                if (index > 0) writer.write(", ");
                writeFfiTypeExpression(writer, p.mapped.ffi);
            });
            writer.writeLine("],");

            if (hasReturnValue && returnMapped) {
                writer.writeLine(`returnGType: () => ${this.returnGTypeExpression(returnMapped.ffi)},`);
            } else {
                writer.writeLine("returnGType: null,");
            }
        });
        writer.writeLine("}],");
    }

    private buildTrampolineType(signal: GirSignal, paramData: SignalParamData[]): FfiTypeDescriptor {
        const argTypes: FfiTypeDescriptor[] = [
            { type: "gobject", ownership: "borrowed" },
            ...paramData.map((p) => p.mapped.ffi),
            { type: "void" },
        ];
        const returnType: FfiTypeDescriptor = signal.returnType
            ? this.ffiMapper.mapType(signal.returnType, true, signal.returnType.transferOwnership).ffi
            : { type: "void" };
        return {
            type: "trampoline",
            argTypes,
            returnType,
            hasDestroy: true,
            userDataIndex: 1 + paramData.length,
        };
    }

    private writeInvokeClosure(writer: Writer, paramData: SignalParamData[], needsReturnUnwrap: boolean): void {
        const hasRefParams = paramData.some((p) => p.mapped.ffi.type === "ref");

        writer.writeLine("(handler, args) => {");
        writer.withIndent(() => {
            if (hasRefParams) {
                this.writeRefHandlerBody(writer, paramData, needsReturnUnwrap);
            } else {
                this.writeSimpleHandlerBody(writer, paramData, needsReturnUnwrap);
            }
        });
        writer.write("}");
    }

    private writeRefDeclarations(writer: Writer, paramData: SignalParamData[]): void {
        for (const [i, p] of paramData.entries()) {
            if (p.mapped.ffi.type === "ref") {
                writer.writeLine(`const _ref${i} = { value: args[${i + 1}] };`);
            }
        }
    }

    private writeHandlerArgs(writer: Writer, paramData: SignalParamData[], useRefVars: boolean): void {
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
        const returnExpr = needsReturnUnwrap ? "tryGetHandle(_result)" : "_result";
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
            writer.writeLine("return tryGetHandle(_result);");
        }
    }

    private gtypeRef(): string {
        const glibGetType = this.cls.glibGetType;
        const glibTypeName = this.cls.glibTypeName;
        if (!glibGetType || glibGetType === "intern") {
            if (!glibTypeName) {
                return `() => 0 /* ${this.className} has no glib:type-name */`;
            }
            this.imports.addImport("../../native.js", ["call", "t"]);
            return `() => call("libgobject-2.0.so.0", "g_type_from_name", [{ type: t.string("borrowed"), value: "${glibTypeName}" }], t.uint64)`;
        }
        const binding = this.descriptors?.register({
            sharedLibrary: this.options.sharedLibrary,
            cIdentifier: glibGetType,
            args: [],
            returnType: { type: "uint64" },
            exported: true,
        });
        this.imports.addImport("../../native.js", ["t"]);
        if (binding?.varargs === false) {
            return binding.name;
        }
        this.imports.addImport("../../native.js", ["call"]);
        return `() => call("${this.options.sharedLibrary}", "${glibGetType}", [], t.uint64)`;
    }

    private gobjectArgExpression(): string {
        this.imports.addImport("../../value-marshal.js", ["valueFromFfi"]);
        if (this.options.namespace === "GObject") {
            this.imports.addImport("./value.js", ["Value"]);
            this.imports.addImport("./functions.js", ["signalEmitv", "signalLookup"]);
            return "{ Value, valueFromFfi, signalEmitv, signalLookup }";
        }
        this.imports.addNamespaceImport(resolveNamespaceImportPath("GObject"), "GObject");
        return "{ Value: GObject.Value, valueFromFfi, signalEmitv: GObject.signalEmitv, signalLookup: GObject.signalLookup }";
    }

    private returnGTypeExpression(ffiType: FfiTypeDescriptor): string {
        const isGObjectNamespace = this.options.namespace === "GObject";
        const prefix = isGObjectNamespace ? "" : "GObject.";
        if (ffiType.type === "enum" || ffiType.type === "flags") {
            this.imports.addImport("../../native.js", ["call", "t"]);
            const { library = "", getTypeFn = "" } = ffiType;
            return `call(${jsStringLiteral(library)}, ${jsStringLiteral(getTypeFn)}, [], t.uint64)`;
        }
        if (isGObjectNamespace) {
            this.imports.addImport("./functions.js", ["typeFromName"]);
        } else {
            this.imports.addNamespaceImport(resolveNamespaceImportPath("GObject"), "GObject");
        }
        return `${prefix}typeFromName(${jsStringLiteral(this.gtypeName(ffiType))})`;
    }

    private gtypeName(ffiType: FfiTypeDescriptor): string {
        switch (ffiType.type) {
            case "boolean":
                return "gboolean";
            case "int8":
            case "int16":
            case "int32":
                return "gint";
            case "uint8":
            case "uint16":
            case "uint32":
                return "guint";
            case "int64":
                return "gint64";
            case "uint64":
                return "guint64";
            case "float32":
                return "gfloat";
            case "float64":
                return "gdouble";
            case "string":
                return "gchararray";
            case "boxed":
                return typeof ffiType.innerType === "string" ? ffiType.innerType : "GObject";
            case "fundamental":
                return ffiType.typeName ?? "GObject";
            default:
                return "GObject";
        }
    }
}
