/**
 * Interface Generator
 *
 * Generates interface classes using the builder library.
 * Interfaces in GObject are like mixins/traits that classes can implement.
 */

import type { FileBuilder } from "../../builders/file-builder.js";
import { classDecl, interfaceDecl, namespaceDecl } from "../../builders/index.js";
import {
    addMethodStructure,
    buildCallableStructures,
    createMethodBodyWriter,
    type MethodBodyWriter,
    type MethodStructure,
} from "../../ffi-emitters/index.js";
import { resolveNamespaceImportPath } from "../../ffi-emitters/namespace-import-path.js";
import type { FfiGeneratorOptions } from "../../generator-types.js";
import type { GirInterface, GirMethod, GirProperty, GirRepository } from "../../gir/index.js";
import type { FfiMapper } from "../../type-system/ffi-mapper.js";
import { SELF_TYPE_GOBJECT } from "../../type-system/ffi-types.js";
import {
    collectGObjectMethodNames,
    collectInterfaceMembers,
    collectInterfaceReachableVirtualMethodNames,
} from "../../utils/class-traversal.js";
import { buildJsDocStructure } from "../../utils/doc-formatter.js";
import { partitionSupportedFunctions, partitionSupportedMethods } from "../../utils/filtering.js";
import { generateConflictingMethodName, toCamelCase, toKebabCase, toPascalCase } from "../../utils/naming.js";
import { splitQualifiedName } from "../../utils/qualified-name.js";
import { methodStructureStrategy, staticFunctionStructureStrategy } from "./callable-strategies.js";
import { PropertyAccessorBuilder, type PropertyAccessorEmission } from "./class/property-accessor-builder.js";

/**
 * Generates interface classes.
 */
export class InterfaceGenerator {
    private readonly methodBody: MethodBodyWriter;

    /**
     * Renamed interface methods keyed by C identifier. Only a GIR `<method>`
     * named `connect` is renamed — to an owner-prefixed name — so it does not
     * shadow the inherited GObject signal-subscription `connect`. Every other
     * method keeps its plain camelCase name; a name colliding across
     * prerequisites is deduplicated rather than renamed.
     */
    private readonly methodRenames = new Map<string, string>();

    constructor(
        private readonly ffiMapper: FfiMapper,
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

        const prerequisiteMethods = this.collectPrerequisiteMethods(iface, new Set(iface.methods.map((m) => m.name)));

        const extendsExpr = this.resolveExtendsExpression();
        const doc = buildJsDocStructure(iface.doc, this.options.namespace);
        const cls = classDecl(interfaceName, {
            exported: true,
            extends: extendsExpr,
            doc: doc?.[0]?.description,
        });

        this.emitConstructorPropertiesNamespace(iface, interfaceName);

        const { ownMethods, inheritedMethods, properties } = this.partitionInterfaceMembers(iface, prerequisiteMethods);

        for (const method of [...ownMethods, ...inheritedMethods]) {
            if (method.name === "connect") {
                this.methodRenames.set(method.cIdentifier, generateConflictingMethodName(iface.name, "connect"));
            }
        }

        const finishCandidateMethods = [...iface.methods, ...prerequisiteMethods];
        const methodStructures: MethodStructure[] = [
            ...this.buildMethodStructures(ownMethods, finishCandidateMethods),
            ...this.buildMethodStructures(inheritedMethods, finishCandidateMethods),
            ...this.buildStaticFunctionStructures(iface),
        ];
        for (const struct of methodStructures) {
            addMethodStructure(cls, struct);
        }

        const reachableMethods = [...iface.methods, ...prerequisiteMethods];
        for (const { accessor } of this.buildPropertyAccessors(iface, interfaceName, reachableMethods, properties)) {
            cls.addAccessor(accessor);
        }

        this.file.add(cls);
        this.registerInterfaceGType(iface, interfaceName);

        return true;
    }

    private resolveExtendsExpression(): string {
        const isGObjectNamespace = this.options.namespace === "GObject";
        if (isGObjectNamespace) {
            this.file.addImport("./object.js", ["Object"]);
            return "Object";
        }
        this.file.addNamespaceImport(resolveNamespaceImportPath("GObject"), "GObject");
        return "GObject.Object";
    }

    private partitionInterfaceMembers(
        iface: GirInterface,
        prerequisiteMethods: GirMethod[],
    ): { ownMethods: GirMethod[]; inheritedMethods: GirMethod[]; properties: GirProperty[] } {
        const gobjectMethodNames = collectGObjectMethodNames(this.repository);
        const properties = this.collectInterfaceProperties(iface);
        const propertyNames = new Set(properties.map((prop) => toCamelCase(prop.name)));
        const isPropertyCollision = (m: GirMethod) => propertyNames.has(toCamelCase(m.name));
        const isGObjectBaseMethod = (m: GirMethod) =>
            m.name !== "connect" && gobjectMethodNames.has(toCamelCase(m.name));
        const ownMethods = iface.methods.filter((m) => !isPropertyCollision(m));
        const inheritedMethods = prerequisiteMethods.filter((m) => !isPropertyCollision(m) && !isGObjectBaseMethod(m));
        return { ownMethods, inheritedMethods, properties };
    }

    private registerInterfaceGType(iface: GirInterface, interfaceName: string): void {
        if (!iface.glibGetType) return;
        this.file.descriptors.register({
            sharedLibrary: this.options.sharedLibrary,
            cIdentifier: iface.glibGetType,
            args: [],
            returnType: { type: "uint64" },
            exported: true,
        });
        this.file.addImport("../../native.js", ["t"]);
        this.file.addImport("../../registry.js", ["registerNativeInterface"]);
        this.file.addStatement(`\n${interfaceName}.prototype.__gtype__ = 0;`);
        this.file.addStatement(`registerNativeInterface(${interfaceName}, ${iface.glibGetType}());`);
    }

    private emitConstructorPropertiesNamespace(iface: GirInterface, interfaceName: string): void {
        const extendsList: string[] = [];
        for (const prereqQualifiedName of iface.prerequisites) {
            const { namespace: ns, name: originalName } = splitQualifiedName(prereqQualifiedName);
            const prereqName = toPascalCase(originalName);
            if (ns === this.options.namespace) {
                extendsList.push(`${prereqName}.ConstructorProperties`);
                this.file.addImport(`./${toKebabCase(originalName)}.js`, [prereqName]);
            } else {
                extendsList.push(`${ns}.${prereqName}.ConstructorProperties`);
                this.file.addNamespaceImport(resolveNamespaceImportPath(ns), ns);
            }
        }
        if (extendsList.length === 0) {
            const isGObjectNamespace = this.options.namespace === "GObject";
            extendsList.push(
                isGObjectNamespace ? "Object.ConstructorProperties" : "GObject.Object.ConstructorProperties",
            );
        }

        const ns = namespaceDecl(interfaceName, { exported: true });
        ns.add(
            interfaceDecl("ConstructorProperties", {
                exported: true,
                extends: extendsList,
            }),
        );
        this.file.add(ns);
    }

    private buildMethodStructures(
        methods: readonly GirMethod[],
        finishCandidateMethods: readonly GirMethod[],
    ): MethodStructure[] {
        const partition = partitionSupportedMethods(
            methods,
            (params) => this.methodBody.hasUnsupportedCallbacks(params),
            (returnType) => this.methodBody.isReturnTypeUnsafe(returnType),
        );
        return buildCallableStructures(
            partition,
            finishCandidateMethods,
            methodStructureStrategy({
                methodBody: this.methodBody,
                options: this.options,
                selfTypeDescriptor: SELF_TYPE_GOBJECT,
                methodRenames: this.methodRenames,
            }),
        );
    }

    private buildStaticFunctionStructures(iface: GirInterface): MethodStructure[] {
        const partition = partitionSupportedFunctions(
            iface.staticFunctions,
            (params) => this.methodBody.hasUnsupportedCallbacks(params),
            (returnType) => this.methodBody.isReturnTypeUnsafe(returnType),
        );
        return buildCallableStructures(
            partition,
            iface.staticFunctions,
            staticFunctionStructureStrategy({
                methodBody: this.methodBody,
                options: this.options,
                ownerClassName: toPascalCase(iface.name),
                ownerOriginalName: iface.name,
            }),
        );
    }

    private collectPrerequisiteMethods(iface: GirInterface, existingMethodNames: Set<string>): GirMethod[] {
        return collectInterfaceMembers(iface, this.repository, {
            getClassMembers: (cls) => cls.methods,
            getInterfaceMembers: (prereq) => prereq.methods,
            keyOf: (method) => method.name,
            seenKeys: existingMethodNames,
        });
    }

    private buildPropertyAccessors(
        iface: GirInterface,
        interfaceName: string,
        reachableMethods: readonly GirMethod[],
        properties: readonly GirProperty[],
    ): PropertyAccessorEmission[] {
        if (properties.length === 0) return [];

        const methodsByCIdentifier = new Map<string, GirMethod>();
        for (const method of reachableMethods) {
            methodsByCIdentifier.set(method.cIdentifier, method);
            methodsByCIdentifier.set(method.name, method);
        }
        const builder = new PropertyAccessorBuilder({
            cls: null,
            ffiMapper: this.ffiMapper,
            imports: this.file,
            repository: this.repository,
            options: this.options,
            selfNames: new Set([interfaceName]),
            interfaceSource: {
                ownerName: interfaceName,
                properties,
                methodsByCIdentifier,
                virtualMethodNames: collectInterfaceReachableVirtualMethodNames(iface, this.repository),
            },
        });
        return builder.buildAccessors();
    }

    private collectInterfaceProperties(iface: GirInterface): GirProperty[] {
        return collectInterfaceMembers(iface, this.repository, {
            getClassMembers: (cls) => cls.properties,
            getInterfaceMembers: (prereq) => prereq.properties,
            keyOf: (property) => property.name,
            includeOwn: true,
        });
    }
}
