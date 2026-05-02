/**
 * Interface Generator
 *
 * Generates interface classes using the builder library.
 * Interfaces in GObject are like mixins/traits that classes can implement.
 */

import type { GirInterface, GirMethod, GirRepository } from "@gtkx/gir";
import type { FileBuilder } from "../../builders/file-builder.js";
import { classDecl, property } from "../../builders/index.js";
import type { FfiGeneratorOptions } from "../../core/generator-types.js";
import type { FfiMapper } from "../../core/type-system/ffi-mapper.js";
import { SELF_TYPE_GOBJECT } from "../../core/type-system/ffi-types.js";
import { collectGObjectMethodNames } from "../../core/utils/class-traversal.js";
import { buildJsDocStructure } from "../../core/utils/doc-formatter.js";
import { filterSupportedMethods } from "../../core/utils/filtering.js";
import { generateConflictingMethodName, toCamelCase, toPascalCase } from "../../core/utils/naming.js";
import {
    addMethodStructure,
    createMethodBodyWriter,
    type MethodBodyWriter,
    type MethodStructure,
} from "../../core/writers/index.js";

/**
 * Generates interface classes.
 */
export class InterfaceGenerator {
    private readonly methodBody: MethodBodyWriter;
    private readonly methodRenames = new Map<string, string>();

    constructor(
        ffiMapper: FfiMapper,
        private readonly file: FileBuilder,
        private readonly repository: GirRepository,
        private readonly options: FfiGeneratorOptions,
    ) {
        this.methodBody = createMethodBodyWriter(ffiMapper, file, {
            sharedLibrary: options.sharedLibrary,
            glibLibrary: options.glibLibrary,
        });
    }

    /**
     * Generates an interface class into the FileBuilder.
     *
     * @param iface - The interface to generate
     * @returns true if the interface was generated successfully
     */
    generate(iface: GirInterface): boolean {
        this.methodRenames.clear();
        const interfaceName = toPascalCase(iface.name);
        this.methodBody.setSelfNames(new Set([interfaceName]));

        const interfaceMethodNames = new Set(iface.methods.map((m) => m.name));
        const prerequisiteMethods = this.collectPrerequisiteMethods(iface, interfaceMethodNames);

        const isGObjectNamespace = this.options.namespace === "GObject";
        const extendsExpr = isGObjectNamespace ? "Object" : "GObject.Object";
        if (isGObjectNamespace) {
            this.file.addImport("./object.js", ["Object"]);
        } else {
            this.file.addNamespaceImport("../gobject/index.js", "GObject");
        }

        const doc = buildJsDocStructure(iface.doc, this.options.namespace);
        const cls = classDecl(interfaceName, {
            exported: true,
            extends: extendsExpr,
            doc: doc?.[0]?.description,
        });

        if (iface.glibTypeName) {
            cls.addProperty(
                property("glibTypeName", {
                    isStatic: true,
                    readonly: true,
                    type: "string",
                    initializer: `"${iface.glibTypeName}"`,
                    override: true,
                }),
            );
            cls.addProperty(
                property("objectType", {
                    isStatic: true,
                    readonly: true,
                    initializer: '"interface" as const',
                    override: true,
                }),
            );
        }

        const gobjectMethodNames = collectGObjectMethodNames(this.repository);
        const methodStructures: MethodStructure[] = [
            ...this.buildMethodStructures(iface.methods, iface.name, gobjectMethodNames),
            ...this.buildMethodStructures(prerequisiteMethods, iface.name, gobjectMethodNames),
        ];

        for (const struct of methodStructures) {
            addMethodStructure(cls, struct);
        }

        this.file.add(cls);

        return true;
    }

    private buildMethodStructures(
        methods: readonly GirMethod[],
        ifaceName: string,
        gobjectMethodNames: Set<string>,
    ): MethodStructure[] {
        const supportedMethods = filterSupportedMethods(methods, (params) =>
            this.methodBody.hasUnsupportedCallbacks(params),
        );
        return supportedMethods.map((m) => {
            const methodName = toCamelCase(m.name);
            if (gobjectMethodNames.has(methodName)) {
                const renamedMethod = generateConflictingMethodName(ifaceName, m.name);
                this.methodRenames.set(m.cIdentifier, renamedMethod);
            }
            return this.buildMethodStructure(m);
        });
    }

    private buildMethodStructure(m: GirMethod): MethodStructure {
        return this.methodBody.buildMethodStructure(m, {
            methodName: this.methodBody.resolveMethodName(m, this.methodRenames),
            selfTypeDescriptor: SELF_TYPE_GOBJECT,
            sharedLibrary: this.options.sharedLibrary,
            namespace: this.options.namespace,
        });
    }

    private collectPrerequisiteMethods(iface: GirInterface, existingMethodNames: Set<string>): GirMethod[] {
        const methods: GirMethod[] = [];
        const seenMethodNames = new Set(existingMethodNames);
        const visitedInterfaces = new Set<string>();

        const collectFromPrerequisite = (prereqName: string) => {
            if (visitedInterfaces.has(prereqName)) return;
            visitedInterfaces.add(prereqName);

            const prereq = this.repository.resolveInterface(prereqName);
            if (!prereq) return;

            for (const prereqPrereq of prereq.prerequisites) {
                collectFromPrerequisite(prereqPrereq);
            }

            for (const m of prereq.methods) {
                if (seenMethodNames.has(m.name)) {
                    const renamedMethod = generateConflictingMethodName(prereq.name, m.name);
                    this.methodRenames.set(m.cIdentifier, renamedMethod);
                    methods.push(m);
                } else {
                    seenMethodNames.add(m.name);
                    methods.push(m);
                }
            }
        };

        for (const prereqName of iface.prerequisites) {
            collectFromPrerequisite(prereqName);
        }

        return methods;
    }
}
