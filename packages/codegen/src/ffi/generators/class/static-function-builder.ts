/**
 * Static Function Builder
 *
 * Builds static function code for classes.
 */

import type { GirClass, GirFunction } from "@gtkx/gir";
import type { MethodDeclarationStructure } from "ts-morph";
import type { GenerationContext } from "../../../core/generation-context.js";
import type { FfiGeneratorOptions } from "../../../core/generator-types.js";
import type { FfiMapper } from "../../../core/type-system/ffi-mapper.js";
import { filterSupportedFunctions } from "../../../core/utils/filtering.js";
import { normalizeClassName } from "../../../core/utils/naming.js";
import { createMethodBodyWriter, type MethodBodyWriter, type Writers } from "../../../core/writers/index.js";

/**
 * Builds static function code for a class.
 */
export class StaticFunctionBuilder {
    private readonly className: string;
    private readonly methodBody: MethodBodyWriter;

    constructor(
        private readonly cls: GirClass,
        ffiMapper: FfiMapper,
        ctx: GenerationContext,
        writers: Writers,
        private readonly options: FfiGeneratorOptions,
    ) {
        this.className = normalizeClassName(cls.name, options.namespace);
        this.methodBody = createMethodBodyWriter(ffiMapper, ctx, writers);
    }

    /**
     * Builds method structures for all static functions.
     * Returns structures for batch adding by ClassGenerator.
     *
     * @returns Array of method declaration structures
     *
     * @example
     * ```typescript
     * const builder = new StaticFunctionBuilder(cls, ffiMapper, ctx, builders, options);
     * const structures = builder.buildStructures();
     * classDecl.addMethods(structures);
     * ```
     */
    buildStructures(): MethodDeclarationStructure[] {
        const supportedFunctions = filterSupportedFunctions(this.cls.staticFunctions, (params) =>
            this.methodBody.hasUnsupportedCallbacks(params),
        );

        return supportedFunctions.map((func) => this.buildStaticFunctionStructure(func));
    }

    private buildStaticFunctionStructure(func: GirFunction): MethodDeclarationStructure {
        return this.methodBody.buildStaticFunctionStructure(func, {
            className: this.className,
            originalClassName: this.cls.name,
            sharedLibrary: this.options.sharedLibrary,
            namespace: this.options.namespace,
        });
    }
}
