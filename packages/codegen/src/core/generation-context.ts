/**
 * Generation Context
 *
 * Tracks state during code generation, including required imports,
 * used types, and generation flags. Each module being generated
 * gets its own context that is reset between modules.
 */

import type { TypeImport, TypeKind } from "./type-system/ffi-types.js";

/**
 * Represents external type usage for imports.
 */
export type ExternalTypeUsage = {
    namespace: string;
    name: string;
    transformedName: string;
    kind: TypeKind;
};

/**
 * Tracks generation state for a single module.
 *
 * The context collects information about what features and types
 * are used during generation, which is then used to build import
 * declarations.
 *
 * @example
 * ```typescript
 * const ctx = new GenerationContext();
 *
 * // During generation, flags are set
 * ctx.usesCall = true;
 * ctx.usedEnums.add("Orientation");
 *
 * // After generation, imports are built from context
 * const imports = new ImportsBuilder(ctx, options);
 * imports.applyToSourceFile(sourceFile);
 *
 * // Reset for next module
 * ctx.reset();
 * ```
 */
export class GenerationContext {
    /** Whether the module uses the FFI ref type */
    usesRef = false;

    /** Whether the module uses the FFI call function */
    usesCall = false;

    /** Whether the module uses the instantiating flag pattern */
    usesInstantiating = false;

    /** Whether to add Gio namespace import */
    addGioImport = false;

    /** Whether the module uses the Type export from native */
    usesType = false;

    /** Whether the module uses the read function */
    usesRead = false;

    /** Whether the module uses the write function */
    usesWrite = false;

    /** Whether the module uses the alloc function */
    usesAlloc = false;

    /** Whether the module uses NativeError */
    usesNativeError = false;

    /** Whether the module uses NativeObject base class */
    usesNativeObject = false;

    /** Whether the module uses getNativeObject helper */
    usesGetNativeObject = false;

    /** Whether the module registers a native class */
    usesRegisterNativeClass = false;

    /** Whether the module uses getNativeClass lookup */
    usesGetClassByTypeName = false;

    /** Whether the module uses resolveSignalMeta helper for signal resolution */
    usesResolveSignalMeta = false;

    /** Whether the module uses RuntimeWidgetMeta type */
    usesRuntimeWidgetMeta = false;

    /** Whether the module needs GObject namespace import (for ParamSpec in signals) */
    usesGObjectNamespace = false;

    /** Enums used from the same namespace */
    usedEnums = new Set<string>();

    /** Records used from the same namespace */
    usedRecords = new Set<string>();

    /** Types used from external namespaces */
    usedExternalTypes = new Map<string, ExternalTypeUsage>();

    /** Classes used from the same namespace */
    usedSameNamespaceClasses = new Map<string, string>();

    /** Interfaces used from the same namespace */
    usedInterfaces = new Map<string, string>();

    /** Classes used for signal parameters */
    signalClasses = new Map<string, string>();

    /** Maps normalized record names to their original file names */
    recordNameToFile = new Map<string, string>();

    /** Maps normalized interface names to their original file names */
    interfaceNameToFile = new Map<string, string>();

    /** Method renames for conflict resolution */
    methodRenames = new Map<string, string>();

    /**
     * Resets all context state for a new module.
     */
    reset(): void {
        this.usesRef = false;
        this.usesCall = false;
        this.usesInstantiating = false;
        this.addGioImport = false;
        this.usesType = false;
        this.usesRead = false;
        this.usesWrite = false;
        this.usesAlloc = false;
        this.usesNativeError = false;
        this.usesNativeObject = false;
        this.usesGetNativeObject = false;
        this.usesRegisterNativeClass = false;
        this.usesGetClassByTypeName = false;
        this.usesResolveSignalMeta = false;
        this.usesRuntimeWidgetMeta = false;
        this.usesGObjectNamespace = false;

        this.usedEnums.clear();
        this.usedRecords.clear();
        this.usedExternalTypes.clear();
        this.usedSameNamespaceClasses.clear();
        this.usedInterfaces.clear();
        this.signalClasses.clear();
        this.methodRenames.clear();
    }

    /**
     * Processes type imports from FfiMapper results.
     *
     * This is the primary way to track imports - collect them from MappedType.imports
     * instead of using callbacks or manual tracking.
     *
     * @param imports - Type imports to process
     */
    addTypeImports(imports: TypeImport[]): void {
        for (const imp of imports) {
            if (imp.isExternal) {
                this.usedExternalTypes.set(`${imp.namespace}.${imp.transformedName}`, {
                    namespace: imp.namespace,
                    name: imp.name,
                    transformedName: imp.transformedName,
                    kind: imp.kind,
                });
            } else {
                switch (imp.kind) {
                    case "enum":
                    case "flags":
                        this.usedEnums.add(imp.transformedName);
                        break;
                    case "record":
                        this.usedRecords.add(imp.transformedName);
                        break;
                    case "class":
                        this.usedSameNamespaceClasses.set(imp.transformedName, imp.name);
                        break;
                    case "interface":
                        this.usedInterfaces.set(imp.transformedName, imp.name);
                        break;
                    case "callback":
                        break;
                }
            }
        }
    }
}
