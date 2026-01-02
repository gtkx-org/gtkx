/**
 * Imports Builder
 *
 * Builds import declarations for generated FFI modules.
 * Uses ts-morph's batched structure API for optimal performance.
 */

import type { ImportDeclarationStructure, SourceFile } from "ts-morph";
import { StructureKind } from "ts-morph";
import {
    FFI_IMPORT_BATCH,
    FFI_IMPORT_NATIVE_BASE,
    FFI_IMPORT_NATIVE_ERROR,
    FFI_IMPORT_NATIVE_OBJECT,
    FFI_IMPORT_REGISTRY,
    FFI_IMPORT_TYPES,
} from "../constants/index.js";
import type { GenerationContext } from "../generation-context.js";
import { normalizeClassName, toKebabCase } from "../utils/naming.js";

/**
 * Options for building imports.
 */
export type ImportsBuilderOptions = {
    /** Current namespace being generated */
    namespace: string;
    /** Current class name (to avoid self-import) */
    currentClassName?: string;
    /** Parent class name (normalized, for same-namespace inheritance) */
    parentClassName?: string;
    /** Parent original name (for file path, same-namespace only) */
    parentOriginalName?: string;
    /** Parent namespace (for cross-namespace inheritance) */
    parentNamespace?: string;
};

/**
 * Represents an import to be added.
 */
export type ImportSpec = {
    /** Module specifier (e.g., "@gtkx/native", "./button.js") */
    moduleSpecifier: string;
    /** Named imports */
    namedImports?: string[];
    /** Type-only named imports */
    typeOnlyImports?: string[];
    /** Namespace import (e.g., import * as Gtk from ...) */
    namespaceImport?: string;
    /** Default import */
    defaultImport?: string;
};

/**
 * Builds import declarations for generated modules.
 *
 * Uses ts-morph's batched structure API for optimal performance.
 *
 * @example
 * ```typescript
 * const builder = new ImportsBuilder(ctx, { namespace: "Gtk" });
 * builder.applyToSourceFile(sourceFile);
 * ```
 */
export class ImportsBuilder {
    constructor(
        private readonly ctx: GenerationContext,
        private readonly options: ImportsBuilderOptions,
    ) {}

    /**
     * Collects all imports based on the generation context.
     */
    collectImports(): ImportSpec[] {
        const imports: ImportSpec[] = [];

        const nativeImports = this.collectNativeImports();
        if (nativeImports.length > 0) {
            imports.push({
                moduleSpecifier: "@gtkx/native",
                namedImports: nativeImports,
            });
        }

        if (this.ctx.usesCall) {
            imports.push({
                moduleSpecifier: FFI_IMPORT_BATCH,
                namedImports: ["call"],
            });
        }

        if (this.ctx.usesNativeError) {
            imports.push({
                moduleSpecifier: FFI_IMPORT_NATIVE_ERROR,
                namedImports: ["NativeError"],
            });
        }

        if (this.ctx.usesGetNativeObject) {
            imports.push({
                moduleSpecifier: FFI_IMPORT_NATIVE_OBJECT,
                namedImports: ["getNativeObject"],
            });
        }

        const baseImports = this.collectBaseImports();
        if (baseImports.length > 0) {
            imports.push({
                moduleSpecifier: FFI_IMPORT_NATIVE_BASE,
                namedImports: baseImports,
            });
        }

        const registryImports = this.collectRegistryImports();
        if (registryImports.length > 0) {
            imports.push({
                moduleSpecifier: FFI_IMPORT_REGISTRY,
                namedImports: registryImports,
            });
        }

        const signalImports = this.collectSignalMetaImports();
        if (signalImports) {
            imports.push(signalImports);
        }

        if (this.ctx.usedEnums.size > 0) {
            imports.push({
                moduleSpecifier: "./enums.js",
                namedImports: Array.from(this.ctx.usedEnums).sort(),
            });
        }

        imports.push(...this.collectRecordImports());
        imports.push(...this.collectInterfaceImports());

        const parentImport = this.collectParentClassImport();
        if (parentImport) {
            imports.push(parentImport);
        }

        imports.push(...this.collectClassImports());
        imports.push(...this.collectSignalClassImports());
        imports.push(...this.collectExternalNamespaceImports());

        return imports;
    }

    /**
     * Applies imports to a ts-morph SourceFile using batched insertion for performance.
     */
    applyToSourceFile(sourceFile: SourceFile): void {
        const imports = this.collectImports();
        const structures: ImportDeclarationStructure[] = [];

        for (const spec of imports) {
            if (spec.namespaceImport) {
                structures.push({
                    kind: StructureKind.ImportDeclaration,
                    moduleSpecifier: spec.moduleSpecifier,
                    namespaceImport: spec.namespaceImport,
                });
            } else if (spec.namedImports || spec.typeOnlyImports) {
                const namedImports: Array<{ name: string; isTypeOnly?: boolean }> = [];

                if (spec.namedImports) {
                    for (const name of spec.namedImports) {
                        namedImports.push({ name });
                    }
                }

                if (spec.typeOnlyImports) {
                    for (const name of spec.typeOnlyImports) {
                        namedImports.push({ name, isTypeOnly: true });
                    }
                }

                structures.push({
                    kind: StructureKind.ImportDeclaration,
                    moduleSpecifier: spec.moduleSpecifier,
                    namedImports,
                });
            } else if (spec.defaultImport) {
                structures.push({
                    kind: StructureKind.ImportDeclaration,
                    moduleSpecifier: spec.moduleSpecifier,
                    defaultImport: spec.defaultImport,
                });
            }
        }

        if (structures.length > 0) {
            sourceFile.addImportDeclarations(structures);
        }
    }

    private collectNativeImports(): string[] {
        const imports: string[] = [];
        if (this.ctx.usesAlloc) imports.push("alloc");
        if (this.ctx.usesRead) imports.push("read");
        if (this.ctx.usesWrite) imports.push("write");
        if (this.ctx.usesRef) imports.push("Ref");
        if (this.ctx.usesType) imports.push("Type");
        return imports;
    }

    private collectBaseImports(): string[] {
        const imports: string[] = [];
        if (this.ctx.usesInstantiating) {
            imports.push("isInstantiating", "setInstantiating");
        }
        if (this.ctx.usesNativeObject) {
            imports.push("NativeObject");
        }
        return imports;
    }

    private collectRegistryImports(): string[] {
        const imports: string[] = [];
        if (this.ctx.usesRegisterNativeClass) imports.push("registerNativeClass");
        if (this.ctx.usesGetClassByTypeName) imports.push("getNativeClass");
        return imports;
    }

    private collectSignalMetaImports(): ImportSpec | null {
        const namedImports: string[] = [];
        const typeOnlyImports: string[] = [];

        if (this.ctx.usesResolveSignalMeta) {
            namedImports.push("resolveSignalMeta");
        }
        if (this.ctx.usesRuntimeWidgetMeta) {
            typeOnlyImports.push("RuntimeWidgetMeta");
        }

        if (namedImports.length === 0 && typeOnlyImports.length === 0) {
            return null;
        }

        return {
            moduleSpecifier: FFI_IMPORT_TYPES,
            namedImports: namedImports.length > 0 ? namedImports : undefined,
            typeOnlyImports: typeOnlyImports.length > 0 ? typeOnlyImports : undefined,
        };
    }

    private collectRecordImports(): ImportSpec[] {
        const imports: ImportSpec[] = [];
        const currentNormalized = this.options.currentClassName
            ? normalizeClassName(this.options.currentClassName, this.options.namespace)
            : "";
        const parentNormalized = this.options.parentClassName
            ? normalizeClassName(this.options.parentClassName, this.options.namespace)
            : "";

        for (const normalizedRecordName of Array.from(this.ctx.usedRecords).sort()) {
            if (normalizedRecordName !== currentNormalized && normalizedRecordName !== parentNormalized) {
                const originalName = this.ctx.recordNameToFile.get(normalizedRecordName) ?? normalizedRecordName;
                imports.push({
                    moduleSpecifier: `./${toKebabCase(originalName)}.js`,
                    namedImports: [normalizedRecordName],
                });
            }
        }

        return imports;
    }

    private collectInterfaceImports(): ImportSpec[] {
        const imports: ImportSpec[] = [];
        const currentNormalized = this.options.currentClassName
            ? normalizeClassName(this.options.currentClassName, this.options.namespace)
            : "";

        for (const [interfaceName, originalName] of Array.from(this.ctx.usedInterfaces.entries()).sort((a, b) =>
            a[0].localeCompare(b[0]),
        )) {
            if (interfaceName === currentNormalized) {
                continue;
            }

            const originalFileName = this.ctx.interfaceNameToFile.get(interfaceName) ?? originalName;
            imports.push({
                moduleSpecifier: `./${toKebabCase(originalFileName)}.js`,
                namedImports: [interfaceName],
            });
        }

        return imports;
    }

    private collectParentClassImport(): ImportSpec | null {
        if (!this.options.parentClassName || !this.options.parentOriginalName || this.options.parentNamespace) {
            return null;
        }

        return {
            moduleSpecifier: `./${toKebabCase(this.options.parentOriginalName)}.js`,
            namedImports: [this.options.parentClassName],
        };
    }

    private collectClassImports(): ImportSpec[] {
        const imports: ImportSpec[] = [];
        const currentNormalized = this.options.currentClassName
            ? normalizeClassName(this.options.currentClassName, this.options.namespace)
            : "";
        const parentNormalized = this.options.parentClassName
            ? normalizeClassName(this.options.parentClassName, this.options.namespace)
            : "";

        for (const [className, originalName] of Array.from(this.ctx.usedSameNamespaceClasses.entries()).sort((a, b) =>
            a[0].localeCompare(b[0]),
        )) {
            if (
                className === currentNormalized ||
                className === parentNormalized ||
                this.ctx.signalClasses.has(className) ||
                this.ctx.usedInterfaces.has(className)
            ) {
                continue;
            }

            imports.push({
                moduleSpecifier: `./${toKebabCase(originalName)}.js`,
                namedImports: [className],
            });
        }

        return imports;
    }

    private collectSignalClassImports(): ImportSpec[] {
        const imports: ImportSpec[] = [];

        for (const [className, originalName] of Array.from(this.ctx.signalClasses.entries()).sort((a, b) =>
            a[0].localeCompare(b[0]),
        )) {
            if (className !== this.options.currentClassName && className !== this.options.parentClassName) {
                imports.push({
                    moduleSpecifier: `./${toKebabCase(originalName)}.js`,
                    namedImports: [className],
                });
            }
        }

        return imports;
    }

    private collectExternalNamespaceImports(): ImportSpec[] {
        const imports: ImportSpec[] = [];
        const externalNamespaces = new Set<string>();

        for (const usage of this.ctx.usedExternalTypes.values()) {
            if (usage.namespace !== this.options.namespace) {
                externalNamespaces.add(usage.namespace);
            }
        }

        if (this.ctx.addGioImport && this.options.namespace !== "Gio") {
            externalNamespaces.add("Gio");
        }

        if (this.ctx.usesGObjectNamespace && this.options.namespace !== "GObject") {
            externalNamespaces.add("GObject");
        }

        if (this.options.parentNamespace && this.options.parentNamespace !== this.options.namespace) {
            externalNamespaces.add(this.options.parentNamespace);
        }

        for (const namespace of Array.from(externalNamespaces).sort()) {
            const nsLower = namespace.toLowerCase();
            imports.push({
                moduleSpecifier: `../${nsLower}/index.js`,
                namespaceImport: namespace,
            });
        }

        return imports;
    }
}
