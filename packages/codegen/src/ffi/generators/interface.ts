/**
 * Interface Generator (ts-morph)
 *
 * Generates interface classes using ts-morph AST.
 * Interfaces in GObject are like mixins/traits that classes can implement.
 */

import type { GirRepository, NormalizedInterface, NormalizedMethod, QualifiedName } from "@gtkx/gir";
import type { MethodDeclarationStructure, SourceFile } from "ts-morph";
import type { GenerationContext } from "../../core/generation-context.js";
import type { FfiGeneratorOptions } from "../../core/generator-types.js";
import type { FfiMapper } from "../../core/type-system/ffi-mapper.js";
import { SELF_TYPE_GOBJECT } from "../../core/type-system/ffi-types.js";
import { buildJsDocStructure } from "../../core/utils/doc-formatter.js";
import { filterSupportedMethods } from "../../core/utils/filtering.js";
import { generateConflictingMethodName, toCamelCase, toPascalCase } from "../../core/utils/naming.js";
import type { Writers } from "../../core/writers/index.js";
import { MethodBodyWriter } from "../../core/writers/method-body-writer.js";

/**
 * Generates interface classes.
 *
 * @example
 * ```typescript
 * const generator = new InterfaceGenerator(ffiMapper, ctx, builders, repository, options);
 * generator.generateToSourceFile(iface, sourceFile);
 * ```
 */
export class InterfaceGenerator {
    private readonly methodBody: MethodBodyWriter;

    constructor(
        ffiMapper: FfiMapper,
        private readonly ctx: GenerationContext,
        writers: Writers,
        private readonly repository: GirRepository,
        private readonly options: FfiGeneratorOptions,
    ) {
        this.methodBody = new MethodBodyWriter(ffiMapper, ctx, writers.ffiTypeWriter);
    }

    /**
     * Generates into a ts-morph SourceFile.
     *
     * @param iface - The interface to generate
     * @param sourceFile - The ts-morph SourceFile to generate into
     * @returns true if the interface was generated successfully
     *
     * @example
     * ```typescript
     * const generator = new InterfaceGenerator(ffiMapper, ctx, builders, repository, options);
     * generator.generateToSourceFile(iface, sourceFile);
     * ```
     */
    generateToSourceFile(iface: NormalizedInterface, sourceFile: SourceFile): boolean {
        const interfaceName = toPascalCase(iface.name);

        const interfaceMethodNames = new Set(iface.methods.map((m) => m.name));
        const prerequisiteMethods = this.collectPrerequisiteMethods(iface, interfaceMethodNames);

        const allMethods = [...iface.methods, ...prerequisiteMethods];

        this.ctx.usesCall = allMethods.length > 0;
        this.ctx.usesRef = allMethods.some((m) => this.methodBody.hasRefParameter(m.parameters));
        this.ctx.usesNativeObject = true;

        const classDecl = sourceFile.addClass({
            name: interfaceName,
            isExported: true,
            extends: "NativeObject",
            docs: buildJsDocStructure(iface.doc, this.options.namespace),
        });

        if (iface.glibTypeName) {
            classDecl.addProperty({
                name: "glibTypeName",
                isStatic: true,
                isReadonly: true,
                type: "string",
                initializer: `"${iface.glibTypeName}"`,
            });
            classDecl.addProperty({
                name: "objectType",
                isStatic: true,
                isReadonly: true,
                initializer: '"interface" as const',
            });
        }

        const methodStructures: MethodDeclarationStructure[] = [];

        methodStructures.push(...this.buildMethodStructures(iface.methods));

        methodStructures.push(...this.buildMethodStructures(prerequisiteMethods));

        if (methodStructures.length > 0) {
            classDecl.addMethods(methodStructures);
        }

        return true;
    }

    /**
     * Builds method structures for ts-morph.
     */
    private buildMethodStructures(methods: readonly NormalizedMethod[]): MethodDeclarationStructure[] {
        const supportedMethods = filterSupportedMethods(methods, (params) =>
            this.methodBody.hasUnsupportedCallbacks(params),
        );
        return supportedMethods.map((method) => this.buildMethodStructure(method));
    }

    /**
     * Builds a single method structure for ts-morph.
     */
    private buildMethodStructure(method: NormalizedMethod): MethodDeclarationStructure {
        const dynamicRename = this.ctx.methodRenames.get(method.cIdentifier);
        const camelName = toCamelCase(method.name);
        const methodName = dynamicRename ?? camelName;

        return this.methodBody.buildMethodStructure(method, {
            methodName,
            selfTypeDescriptor: SELF_TYPE_GOBJECT,
            sharedLibrary: this.options.sharedLibrary,
            namespace: this.options.namespace,
        });
    }

    /**
     * Collects methods from prerequisite interfaces.
     * Handles method name conflicts by renaming.
     */
    private collectPrerequisiteMethods(
        iface: NormalizedInterface,
        existingMethodNames: Set<string>,
    ): NormalizedMethod[] {
        const methods: NormalizedMethod[] = [];
        const seenMethodNames = new Set(existingMethodNames);
        const visitedInterfaces = new Set<string>();

        const collectFromPrerequisite = (prereqName: string) => {
            if (visitedInterfaces.has(prereqName)) return;
            visitedInterfaces.add(prereqName);

            const prereq = this.repository.resolveInterface(prereqName as QualifiedName);
            if (!prereq) return;

            for (const prereqPrereq of prereq.prerequisites) {
                collectFromPrerequisite(prereqPrereq);
            }

            for (const method of prereq.methods) {
                if (seenMethodNames.has(method.name)) {
                    const renamedMethod = generateConflictingMethodName(prereq.name, method.name);
                    this.ctx.methodRenames.set(method.cIdentifier, renamedMethod);
                    methods.push(method);
                } else {
                    seenMethodNames.add(method.name);
                    methods.push(method);
                }
            }
        };

        for (const prereqName of iface.prerequisites) {
            collectFromPrerequisite(prereqName);
        }

        return methods;
    }
}
