/**
 * FFI Generator
 *
 * Top-level orchestrator for generating per-namespace JavaScript FFI bindings
 * from GIR data. Produces one `<ns>/<ns>.js` file per namespace using a
 * shared FileBuilder threaded through every sub-generator.
 */

import { type FileBuilder, fileBuilder } from "../builders/file-builder.js";
import { stringify } from "../builders/stringify.js";
import { CodegenMetadata } from "../codegen-metadata.js";
import type { GeneratedFile } from "../generated-file-set.js";
import type { FfiGeneratorOptions } from "../generator-types.js";
import type { GirClass, GirNamespace, GirRepository } from "../gir/index.js";
import { FfiMapper } from "../type-system/ffi-mapper.js";
import { normalizeClassName, toCamelCase, toPascalCase, toValidExportName } from "../utils/naming.js";
import { splitQualifiedName } from "../utils/qualified-name.js";
import { isClassVtable, shouldGenerateRecord } from "../utils/record-filter.js";
import { AliasGenerator } from "./generators/alias.js";
import { CallbackGenerator } from "./generators/callback.js";
import { ClassGenerator } from "./generators/class/index.js";
import { ClassStructGenerator } from "./generators/class-struct/index.js";
import { ConstantGenerator } from "./generators/constant.js";
import { EnumGenerator } from "./generators/enum.js";
import { FunctionGenerator } from "./generators/function.js";
import { InterfaceGenerator } from "./generators/interface.js";
import { RecordGenerator } from "./generators/record/index.js";

/**
 * Configuration for generating a namespace's FFI bindings.
 */
type FfiNamespaceConfig = {
    namespace: string;
    repository: GirRepository;
};

/**
 * Result of generating a namespace's FFI bindings.
 */
type FfiNamespaceResult = {
    files: GeneratedFile[];
    metadata: CodegenMetadata;
};

/**
 * Generates JavaScript FFI bindings for a GIR namespace.
 *
 * Processes classes, records, interfaces, enums, functions, and constants
 * from GIR data and emits a single per-namespace `.js` module for
 * `@gtkx/ffi`. Type contracts live in companion `.d.ts` files supplied by
 * the types pipeline.
 */
export class FfiGenerator {
    private readonly options: FfiNamespaceConfig;
    private readonly ffiMapper: FfiMapper;
    private readonly namespaceDir: string;
    private readonly metadata = new CodegenMetadata();
    private readonly recordNameToFile = new Map<string, string>();
    private readonly interfaceNameToFile = new Map<string, string>();

    constructor(options: FfiNamespaceConfig) {
        this.options = options;
        this.ffiMapper = new FfiMapper(options.repository, options.namespace);
        this.namespaceDir = options.namespace.toLowerCase();
    }

    private getNamespaceLibrary(namespaceName: string): string {
        const ns = this.options.repository.getNamespace(namespaceName);
        if (!ns?.sharedLibrary) {
            throw new Error(`No shared library found for namespace: ${namespaceName}`);
        }
        const firstLib = ns.sharedLibrary.split(",")[0];
        if (!firstLib) {
            throw new Error(`Invalid shared library format for namespace: ${namespaceName}`);
        }
        return firstLib.trim();
    }

    /**
     * Generates a single consolidated FFI file for a namespace.
     */
    generateNamespace(namespaceName: string): FfiNamespaceResult {
        const namespace = this.options.repository.getNamespace(namespaceName);
        if (!namespace) {
            throw new Error(`Namespace ${namespaceName} not found in repository`);
        }

        this.ffiMapper.clearSkippedClasses();
        this.registerRecords(namespace);
        this.registerInterfaces(namespace);

        const generatorOptions: FfiGeneratorOptions = {
            namespace: this.options.namespace,
            sharedLibrary: namespace.sharedLibrary,
            glibLibrary: this.getNamespaceLibrary("GLib"),
            gobjectLibrary: this.getNamespaceLibrary("GObject"),
        };

        const file = fileBuilder();
        file.setMode("js");

        if (this.options.namespace !== "GObject" && this.options.namespace !== "GLib") {
            file.addSideEffectImport("../../gobject/object.js");
            file.addSideEffectImport("../../gobject/value.js");
        }

        this.emitEnums(namespace, file);
        this.generateRecords(namespace, generatorOptions, file);
        this.generateClasses(namespace, generatorOptions, file);
        this.generateClassStructs(namespace, generatorOptions, file);
        this.emitInterfaces(namespace, generatorOptions, file);
        this.emitStandaloneFunctions(namespace, generatorOptions, file);
        this.emitConstants(namespace, file);
        this.emitAliases(namespace, file);
        this.emitCallbacks(namespace, file);

        const path = `${this.namespaceDir}/${this.namespaceDir}.js`;
        const trailer = this.namespaceBootstrap(namespace, file);
        const content = trailer ? `${stringify(file)}\n${trailer}\n` : stringify(file);
        const files: GeneratedFile[] = [{ path, content }];

        return { files, metadata: this.metadata };
    }

    private emitEnums(namespace: GirNamespace, file: FileBuilder): void {
        const allEnums = [...namespace.enumerations.values(), ...namespace.bitfields.values()];
        if (allEnums.length === 0) return;
        const enumGenerator = new EnumGenerator(file, { namespace: this.options.namespace });
        enumGenerator.addEnums(allEnums);
    }

    private emitInterfaces(namespace: GirNamespace, generatorOptions: FfiGeneratorOptions, file: FileBuilder): void {
        for (const [, iface] of namespace.interfaces) {
            const interfaceGenerator = new InterfaceGenerator(
                this.ffiMapper,
                file,
                this.options.repository,
                generatorOptions,
            );
            interfaceGenerator.generate(iface);
        }
    }

    private emitStandaloneFunctions(
        namespace: GirNamespace,
        generatorOptions: FfiGeneratorOptions,
        file: FileBuilder,
    ): void {
        const standaloneFunctions = [...namespace.functions.values()];
        if (standaloneFunctions.length === 0) return;
        const functionGenerator = new FunctionGenerator(this.ffiMapper, file, generatorOptions);
        functionGenerator.generate(standaloneFunctions);
    }

    private emitConstants(namespace: GirNamespace, file: FileBuilder): void {
        if (namespace.constants.size === 0) return;
        const constantGenerator = new ConstantGenerator(file, { namespace: this.options.namespace });
        constantGenerator.addConstants([...namespace.constants.values()]);
    }

    private emitAliases(namespace: GirNamespace, file: FileBuilder): void {
        if (namespace.aliases.size === 0 && !AliasGenerator.hasOverrides(this.options.namespace)) return;
        const aliasGenerator = new AliasGenerator(file, { namespace: this.options.namespace });
        aliasGenerator.addAliases([...namespace.aliases.values()]);
    }

    private emitCallbacks(namespace: GirNamespace, file: FileBuilder): void {
        if (namespace.callbacks.size === 0) return;
        const callbackGenerator = new CallbackGenerator(file, { namespace: this.options.namespace });
        callbackGenerator.addCallbacks([...namespace.callbacks.values()]);
    }

    /**
     * Builds the namespace's self-bootstrap statements: a call to its module
     * initializer and a teardown registration for its finalizer.
     *
     * GTK-style libraries expose zero-argument top-level `init` and `finalize`
     * functions (`gtk_init`, `gtk_source_finalize`, ...). Emitting `init()`
     * makes importing the namespace initialize its runtime; registering
     * `finalize` on {@link whenStopped} runs it during shutdown — both with no
     * separate bootstrap step.
     *
     * @param namespace - The namespace being generated.
     * @param file - The file builder, used to add the `whenStopped` import.
     * @returns The trailing statements, or an empty string when none apply.
     */
    private namespaceBootstrap(namespace: GirNamespace, file: FileBuilder): string {
        let initCall = "";
        let finalizeCall = "";
        for (const func of namespace.functions.values()) {
            if (func.parameters.length > 0) continue;
            const name = toValidExportName(toCamelCase(func.name));
            if (func.name === "init") {
                initCall = `${name}();`;
            } else if (func.name === "finalize") {
                file.addImport("../../lifecycle.js", ["whenStopped"]);
                finalizeCall = `whenStopped().then(${name});`;
            }
        }
        return [initCall, finalizeCall].filter((line) => line.length > 0).join("\n");
    }

    private generateRecords(namespace: GirNamespace, generatorOptions: FfiGeneratorOptions, file: FileBuilder): void {
        for (const [, record] of namespace.records) {
            if (!shouldGenerateRecord(record, this.options.repository, this.options.namespace)) continue;
            const recordGenerator = new RecordGenerator(
                this.ffiMapper,
                file,
                generatorOptions,
                this.options.repository,
            );
            recordGenerator.generate(record);
        }
    }

    private generateClassStructs(
        namespace: GirNamespace,
        generatorOptions: FfiGeneratorOptions,
        file: FileBuilder,
    ): void {
        for (const [, record] of namespace.records) {
            if (!isClassVtable(record)) continue;
            const generator = new ClassStructGenerator({
                ffiMapper: this.ffiMapper,
                file,
                options: generatorOptions,
                repo: this.options.repository,
            });
            generator.generate(record);
        }
    }

    private generateClasses(namespace: GirNamespace, generatorOptions: FfiGeneratorOptions, file: FileBuilder): void {
        const sortedClasses = this.topologicalSortClasses([...namespace.classes.values()]);
        for (const cls of sortedClasses) {
            const classGenerator = new ClassGenerator({
                cls,
                ffiMapper: this.ffiMapper,
                file,
                repository: this.options.repository,
                options: generatorOptions,
            });

            const result = classGenerator.generate();

            if (result.widgetMeta) {
                this.metadata.addWidgetMeta(result.widgetMeta);
            }
            if (result.controllerMeta) {
                this.metadata.addControllerMeta(result.controllerMeta);
            }
            if (result.layoutManagerMeta) {
                this.metadata.addLayoutManagerMeta(result.layoutManagerMeta);
            }
        }
    }

    private registerRecords(namespace: GirNamespace): void {
        for (const [, record] of namespace.records) {
            if (shouldGenerateRecord(record, this.options.repository, this.options.namespace)) {
                const normalizedName = normalizeClassName(record.name);
                this.recordNameToFile.set(normalizedName, record.name);
            }
        }
    }

    private registerInterfaces(namespace: GirNamespace): void {
        for (const [, iface] of namespace.interfaces) {
            const normalizedName = toPascalCase(iface.name);
            this.interfaceNameToFile.set(normalizedName, iface.name);
        }
    }

    private topologicalSortClasses(classes: GirClass[]): GirClass[] {
        const classMap = new Map<string, GirClass>();
        for (const cls of classes) {
            classMap.set(cls.name, cls);
        }

        const sorted: GirClass[] = [];
        const visited = new Set<string>();

        const visit = (cls: GirClass) => {
            if (visited.has(cls.name)) return;
            visited.add(cls.name);
            if (cls.parent) {
                const { name: parentName } = splitQualifiedName(cls.parent);
                const parent = classMap.get(parentName);
                if (parent) {
                    visit(parent);
                }
            }
            sorted.push(cls);
        };

        for (const cls of classes) {
            visit(cls);
        }

        return sorted;
    }
}
