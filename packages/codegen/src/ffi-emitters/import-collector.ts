/**
 * Import Collector
 *
 * The import-collection surface threaded through the FFI generators, plus the
 * helper that resolves GIR type-import entries into concrete import statements.
 */

import type { TypeImport } from "../type-system/ffi-types.js";
import { toKebabCase } from "../utils/naming.js";
import type { FfiDescriptorRegistry } from "./descriptor-registry.js";
import { resolveNamespaceImportPath } from "./namespace-import-path.js";

/**
 * Collects imports during method body generation.
 * The FileBuilder naturally satisfies this interface.
 */
export type ImportCollector = {
    addImport(specifier: string, names: string[]): void;
    addTypeImport(specifier: string, names: string[]): void;
    addNamespaceImport(specifier: string, alias: string): void;
    /**
     * FFI descriptor registry threaded alongside the import collector so
     * builders can register shared `t.fn(...)` descriptors. Present on the
     * collector instance the FFI generator constructs; absent for collectors
     * used in contexts that emit no descriptor bindings.
     */
    descriptors?: FfiDescriptorRegistry;
};

/**
 * Adds the necessary imports for a list of TypeImport entries.
 *
 * Handles namespace casing, enum vs class/record/interface file paths,
 * and external namespace references.
 */
export const addTypeImports = (
    imports: ImportCollector,
    typeImports: readonly TypeImport[],
    skipNames?: ReadonlySet<string>,
): void => {
    for (const imp of typeImports) {
        if (!imp.isExternal && skipNames?.has(imp.transformedName)) continue;
        if (imp.isExternal) {
            imports.addNamespaceImport(resolveNamespaceImportPath(imp.namespace), imp.namespace);
        } else {
            switch (imp.kind) {
                case "enum":
                case "flags":
                    imports.addImport("./enums.js", [imp.transformedName]);
                    break;
                case "record":
                case "class":
                case "interface":
                    imports.addImport(`./${toKebabCase(imp.name)}.js`, [imp.transformedName]);
                    break;
                case "alias":
                    imports.addImport("./aliases.js", [imp.transformedName]);
                    break;
                case "callback":
                    break;
            }
        }
    }
};
