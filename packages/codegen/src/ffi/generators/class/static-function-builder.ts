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
import { normalizeClassName, toCamelCase, toValidIdentifier } from "../../../core/utils/naming.js";
import { createMethodBodyWriter, type MethodBodyWriter, type Writers } from "../../../core/writers/index.js";

function collectParentStaticFunctionNames(cls: GirClass): Set<string> {
    const names = new Set<string>();
    let current = cls.getParent();
    while (current) {
        for (const func of current.staticFunctions) {
            names.add(toValidIdentifier(toCamelCase(func.name)));
        }
        current = current.getParent();
    }
    return names;
}

/**
 * Builds static function code for a class.
 */
export class StaticFunctionBuilder {
    private readonly className: string;
    private readonly methodBody: MethodBodyWriter;
    private readonly parentStaticFunctionNames: Set<string>;

    constructor(
        private readonly cls: GirClass,
        ffiMapper: FfiMapper,
        ctx: GenerationContext,
        writers: Writers,
        private readonly options: FfiGeneratorOptions,
    ) {
        this.className = normalizeClassName(cls.name);
        this.methodBody = createMethodBodyWriter(ffiMapper, ctx, writers);
        this.parentStaticFunctionNames = collectParentStaticFunctionNames(cls);
    }

    buildStructures(): MethodDeclarationStructure[] {
        const supportedFunctions = filterSupportedFunctions(this.cls.staticFunctions, (params) =>
            this.methodBody.hasUnsupportedCallbacks(params),
        );

        return supportedFunctions
            .filter((func) => !this.parentStaticFunctionNames.has(toValidIdentifier(toCamelCase(func.name))))
            .map((func) => this.buildStaticFunctionStructure(func));
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
