import type { FfiMapper } from "../type-system/ffi-mapper.js";
import type { TypeImport } from "../type-system/ffi-types.js";
import { toKebabCase } from "../utils/naming.js";
import { FfiTypeWriter } from "./ffi-type-writer.js";
import { type ImportCollector, MethodBodyWriter } from "./method-body-writer.js";

export type { MethodStructure } from "./method-body-writer.js";
export type { ImportCollector, MethodBodyWriter };

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
            imports.addNamespaceImport(`../${imp.namespace.toLowerCase()}/index.js`, imp.namespace);
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
                case "callback":
                    break;
            }
        }
    }
};

type CreateMethodBodyWriterOptions = {
    sharedLibrary?: string;
    glibLibrary?: string;
    selfNames?: ReadonlySet<string>;
};

export const createMethodBodyWriter = (
    ffiMapper: FfiMapper,
    imports: ImportCollector,
    options: CreateMethodBodyWriterOptions = {},
): MethodBodyWriter => {
    const ffiTypeWriter = new FfiTypeWriter({
        currentSharedLibrary: options.sharedLibrary,
        glibLibrary: options.glibLibrary,
    });

    const writer = new MethodBodyWriter(ffiMapper, imports, ffiTypeWriter);
    if (options.selfNames) {
        writer.setSelfNames(options.selfNames);
    }
    return writer;
};
