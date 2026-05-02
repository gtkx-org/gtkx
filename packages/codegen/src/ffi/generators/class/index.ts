/**
 * Class Generator
 *
 * Orchestrates the generation of a class module file.
 * Delegates to specialized builders for each component.
 */

import type { GirClass, GirMethod, GirRepository } from "@gtkx/gir";
import type { FileBuilder } from "../../../builders/file-builder.js";
import {
    type ClassDeclarationBuilder,
    classDecl,
    constructorDecl,
    param,
    property,
    typeAlias,
} from "../../../builders/index.js";
import type { Writer } from "../../../builders/writer.js";
import { PropertyAnalyzer, SignalAnalyzer } from "../../../core/analyzers/index.js";
import type { CodegenControllerMeta, CodegenWidgetMeta } from "../../../core/codegen-metadata.js";
import type { FfiGeneratorOptions } from "../../../core/generator-types.js";
import type { FfiMapper } from "../../../core/type-system/ffi-mapper.js";
import {
    fundamentalSelfType,
    SELF_TYPE_GOBJECT,
    type SelfTypeDescriptor,
} from "../../../core/type-system/ffi-types.js";
import { analyzeAsyncMethods } from "../../../core/utils/async-analysis.js";
import { collectParentFactoryMethodNames, collectParentMethodNames } from "../../../core/utils/class-traversal.js";
import { buildJsDocStructure } from "../../../core/utils/doc-formatter.js";
import { isMethodSuppressed } from "../../../core/utils/method-suppression.js";
import { generateConflictingMethodName, normalizeClassName, toKebabCase } from "../../../core/utils/naming.js";
import { type ParentInfo, parseParentReference } from "../../../core/utils/parent-reference.js";
import { addMethodStructure, type MethodStructure } from "../../../core/writers/index.js";
import { type ClassMetaAnalyzers, ClassMetaBuilder } from "./class-meta-builder.js";
import { ConstructorBuilder } from "./constructor-builder.js";
import { MethodBuilder } from "./method-builder.js";
import { PropertyAccessorBuilder } from "./property-accessor-builder.js";
import { SignalBuilder } from "./signal-builder.js";
import { StaticFunctionBuilder } from "./static-function-builder.js";

/**
 * Result of class generation.
 */
type ClassGenerationResult = {
    success: boolean;
    widgetMeta?: CodegenWidgetMeta | null;
    controllerMeta?: CodegenControllerMeta | null;
};

/**
 * Generates a complete class module file.
 *
 * This is the main orchestrator for class generation. It coordinates
 * the specialized builders for each component of a class:
 * - Constructors
 * - Methods
 * - Static functions
 * - Signals
 * - Property accessors
 * - Widget metadata
 */
export class ClassGenerator {
    private readonly className: string;
    private readonly constructorBuilder: ConstructorBuilder;
    private readonly methodBuilder: MethodBuilder;
    private readonly staticBuilder: StaticFunctionBuilder;
    private readonly signalBuilder: SignalBuilder;
    private readonly propertyAccessorBuilder: PropertyAccessorBuilder;
    private readonly classMetaBuilder: ClassMetaBuilder;
    private readonly methodRenames = new Map<string, string>();

    constructor(
        private readonly cls: GirClass,
        ffiMapper: FfiMapper,
        private readonly file: FileBuilder,
        private readonly repository: GirRepository,
        private readonly options: FfiGeneratorOptions,
    ) {
        this.className = normalizeClassName(cls.name);
        const selfNames = new Set([this.className]);

        this.constructorBuilder = new ConstructorBuilder(cls, ffiMapper, file, repository, options, selfNames);
        this.methodBuilder = new MethodBuilder(ffiMapper, file, this.methodRenames, options, selfNames);
        this.staticBuilder = new StaticFunctionBuilder(cls, ffiMapper, file, options, selfNames);
        this.signalBuilder = new SignalBuilder(cls, ffiMapper, file, repository, options, selfNames);
        this.propertyAccessorBuilder = new PropertyAccessorBuilder(
            cls,
            ffiMapper,
            file,
            repository,
            options,
            selfNames,
        );

        const analyzers: ClassMetaAnalyzers = {
            property: new PropertyAnalyzer(repository, ffiMapper),
            signal: new SignalAnalyzer(repository, ffiMapper),
        };
        this.classMetaBuilder = new ClassMetaBuilder(cls, repository, options.namespace, analyzers);
    }

    /**
     * Generates the class into the FileBuilder.
     *
     * @returns Result containing success flag and optional widget/controller metadata
     */
    generate(): ClassGenerationResult {
        if (!this.canGenerate()) {
            return { success: false };
        }

        const asyncAnalysis = analyzeAsyncMethods(this.cls.methods);

        const parentMethodNames = collectParentMethodNames(this.cls, this.repository);
        const { interfaceMethodsByNamespace } = this.collectInterfaceMethods(parentMethodNames);

        const filteredClassMethods = this.filterClassMethods(parentMethodNames);

        const parentInfo = parseParentReference(this.cls.parent, this.options.namespace);
        const isFundamental = this.isFundamentalType();
        const selfTypeDescriptor = this.getSelfTypeDescriptor();

        const cls = this.buildClassDeclaration(parentInfo, isFundamental);

        const parentFactoryMethodNames = collectParentFactoryMethodNames(this.cls);
        this.constructorBuilder.setParentFactoryMethodNames(parentFactoryMethodNames);

        const { constructorData, factoryMethods } = this.constructorBuilder.buildConstructorAndFactoryMethods(
            parentInfo.hasParent,
        );

        if (constructorData) {
            if (constructorData.propsTypeAlias) {
                this.file.add(
                    typeAlias(constructorData.propsTypeAlias.name, constructorData.propsTypeAlias.body, {
                        exported: true,
                    }),
                );
            }
            cls.setConstructor(
                constructorDecl({
                    overloads: constructorData.overloads,
                    params: constructorData.implParams.map((p) =>
                        param(p.name, p.type, {
                            optional: p.optional,
                            defaultValue: p.initializer,
                        }),
                    ),
                    body: constructorData.bodyWriter,
                }),
            );
        }

        const allMethodStructures: MethodStructure[] = [
            ...factoryMethods,
            ...this.staticBuilder.buildStructures(),
            ...this.methodBuilder.buildStructures(filteredClassMethods, selfTypeDescriptor, asyncAnalysis),
            ...Array.from(interfaceMethodsByNamespace.values()).flatMap((methods) =>
                this.methodBuilder.buildStructures(methods, selfTypeDescriptor, asyncAnalysis),
            ),
            ...this.signalBuilder.buildConnectMethodStructures(),
        ];

        if (this.cls.glibGetType) {
            allMethodStructures.push(this.buildGetGTypeMethod());
        }

        for (const struct of allMethodStructures) {
            addMethodStructure(cls, struct);
        }

        for (const a of this.propertyAccessorBuilder.buildAccessors()) {
            cls.addAccessor(a);
        }

        this.file.add(cls);

        if (this.cls.glibTypeName) {
            this.file.addImport("../../registry.js", ["registerNativeClass"]);
            this.file.addStatement(`\nregisterNativeClass(${this.className});`);
        }

        const widgetMeta = this.classMetaBuilder.buildCodegenWidgetMeta();
        const controllerMeta = this.classMetaBuilder.buildCodegenControllerMeta();

        return { success: true, widgetMeta, controllerMeta };
    }

    private buildClassDeclaration(parentInfo: ParentInfo, isFundamental: boolean): ClassDeclarationBuilder {
        let extendsExpr: string | undefined;
        if (parentInfo.hasParent) {
            if (parentInfo.isCrossNamespace && parentInfo.namespace) {
                extendsExpr = `${parentInfo.namespace}.${parentInfo.className}`;
                this.file.addNamespaceImport(`../${parentInfo.namespace.toLowerCase()}/index.js`, parentInfo.namespace);
            } else {
                extendsExpr = parentInfo.className;
                if (parentInfo.originalName) {
                    this.file.addImport(`./${toKebabCase(parentInfo.originalName)}.js`, [parentInfo.className]);
                }
            }
        } else {
            extendsExpr = "NativeObject";
            this.file.addImport("../../object.js", ["NativeObject"]);
        }

        const objectType = isFundamental ? "fundamental" : "gobject";
        const isRootGObject = !parentInfo.hasParent && objectType === "gobject";
        const objectTypeInitializer = isRootGObject
            ? `"gobject" as "gobject" | "interface"`
            : `"${objectType}" as const`;

        const doc = buildJsDocStructure(this.cls.doc, this.options.namespace);
        const cls = classDecl(this.className, {
            exported: true,
            extends: extendsExpr,
            doc: doc?.[0]?.description,
        });

        if (this.cls.glibTypeName) {
            cls.addProperty(
                property("glibTypeName", {
                    isStatic: true,
                    readonly: true,
                    type: "string",
                    initializer: `"${this.cls.glibTypeName}"`,
                    override: parentInfo.hasParent,
                }),
            );
            cls.addProperty(
                property("objectType", {
                    isStatic: true,
                    readonly: true,
                    initializer: objectTypeInitializer,
                    override: parentInfo.hasParent,
                }),
            );
        }

        return cls;
    }

    private canGenerate(): boolean {
        if (this.cls.constructors.length === 0) return true;

        const hasAnySupportedConstructor = this.cls.constructors.some(
            (c) => !this.methodBuilder.hasUnsupportedCallbacks(c.parameters),
        );

        return hasAnySupportedConstructor;
    }

    private isFundamentalType(): boolean {
        if (this.cls.isFundamental()) {
            return true;
        }
        let currentClass = this.cls;
        while (currentClass.parent) {
            const parent = this.repository.resolveClass(currentClass.parent);
            if (!parent) break;
            if (parent.isFundamental()) {
                return true;
            }
            currentClass = parent;
        }
        return false;
    }

    private resolveInterfaceNamespace(ifaceQualifiedName: string): string {
        if (!ifaceQualifiedName.includes(".")) return this.options.namespace;
        return ifaceQualifiedName.split(".")[0] ?? this.options.namespace;
    }

    private collectMethodsForInterface(
        method: GirMethod,
        ifaceName: string,
        sourceNamespace: string,
        classMethodNames: Set<string>,
        parentMethodNames: Set<string>,
        seenInterfaceMethodNames: Set<string>,
        interfaceMethodsByNamespace: Map<string, GirMethod[]>,
    ): void {
        if (classMethodNames.has(method.name) || parentMethodNames.has(method.name)) return;

        if (seenInterfaceMethodNames.has(method.name)) {
            this.handleInterfaceMethodRename(method, ifaceName);
        } else {
            seenInterfaceMethodNames.add(method.name);
        }

        if (!interfaceMethodsByNamespace.has(sourceNamespace)) {
            interfaceMethodsByNamespace.set(sourceNamespace, []);
        }
        interfaceMethodsByNamespace.get(sourceNamespace)?.push(method);
    }

    private collectInterfaceMethods(parentMethodNames: Set<string>): {
        interfaceMethods: GirMethod[];
        interfaceMethodsByNamespace: Map<string, GirMethod[]>;
    } {
        const classMethodNames = new Set(this.cls.methods.map((m) => m.name));
        const seenInterfaceMethodNames = new Set<string>();
        const interfaceMethodsByNamespace = new Map<string, GirMethod[]>();

        for (const ifaceQualifiedName of this.cls.implements) {
            const iface = this.repository.resolveInterface(ifaceQualifiedName);
            if (!iface) continue;

            const sourceNamespace = this.resolveInterfaceNamespace(ifaceQualifiedName);

            for (const method of iface.methods) {
                this.collectMethodsForInterface(
                    method,
                    iface.name,
                    sourceNamespace,
                    classMethodNames,
                    parentMethodNames,
                    seenInterfaceMethodNames,
                    interfaceMethodsByNamespace,
                );
            }
        }

        const interfaceMethods = Array.from(interfaceMethodsByNamespace.values()).flat();
        return { interfaceMethods, interfaceMethodsByNamespace };
    }

    private handleInterfaceMethodRename(method: GirMethod, ifaceName: string): void {
        const renamedMethod = generateConflictingMethodName(ifaceName, method.name);
        this.methodRenames.set(method.cIdentifier, renamedMethod);
    }

    private filterClassMethods(parentMethodNames: Set<string>): GirMethod[] {
        return this.cls.methods.filter((m) => {
            if (isMethodSuppressed(this.cls.qualifiedName, m.cIdentifier)) return false;
            const needsRename = parentMethodNames.has(m.name) || (m.name === "connect" && this.cls.parent);
            if (needsRename) {
                const renamedMethod = generateConflictingMethodName(this.cls.name, m.name);
                this.methodRenames.set(m.cIdentifier, renamedMethod);
            }
            return true;
        });
    }

    private getSelfTypeDescriptor(): SelfTypeDescriptor {
        const fundamentalInfo = this.getFundamentalTypeInfo();
        if (fundamentalInfo) {
            return fundamentalSelfType(
                fundamentalInfo.lib,
                fundamentalInfo.refFn,
                fundamentalInfo.unrefFn,
                "borrowed",
                fundamentalInfo.typeName,
            );
        }
        return SELF_TYPE_GOBJECT;
    }

    private buildGetGTypeMethod(): MethodStructure {
        const binding = this.file.descriptors.register({
            sharedLibrary: this.options.sharedLibrary,
            cIdentifier: this.cls.glibGetType ?? "",
            args: [],
            returnType: { type: "uint64" },
        });

        return {
            name: "getGType",
            isStatic: true,
            parameters: [],
            returnType: "number",
            docs: undefined,
            statements: (writer: Writer) => {
                if (binding.varargs === false) {
                    this.file.addImport("../../native.js", ["t"]);
                    writer.writeLine(`return ${binding.name}() as number;`);
                } else {
                    this.file.addImport("../../native.js", ["call", "t"]);
                    writer.writeLine(
                        `return call("${this.options.sharedLibrary}", "${this.cls.glibGetType}", [], t.uint64) as number;`,
                    );
                }
            },
        };
    }

    private getFundamentalTypeInfo(): { lib: string; refFn: string; unrefFn: string; typeName?: string } | null {
        let currentClass: GirClass | null = this.cls;
        while (currentClass) {
            if (currentClass.isFundamental() && currentClass.refFunc && currentClass.unrefFunc) {
                const namespace = currentClass.qualifiedName.split(".")[0];
                const ns = this.repository.getNamespace(namespace ?? "");
                if (ns?.sharedLibrary) {
                    return {
                        lib: ns.sharedLibrary,
                        refFn: currentClass.refFunc,
                        unrefFn: currentClass.unrefFunc,
                        typeName: currentClass.glibTypeName,
                    };
                }
            }
            currentClass = currentClass.getParent();
        }
        return null;
    }
}
