/**
 * Class Generator
 *
 * Orchestrates the generation of a class module file.
 * Delegates to specialized builders for each component.
 */

import type { GirRepository, NormalizedClass, NormalizedMethod, QualifiedName } from "@gtkx/gir";
import type { ClassDeclaration, SourceFile } from "ts-morph";
import { ConstructorAnalyzer, PropertyAnalyzer, SignalAnalyzer } from "../../../core/analyzers/index.js";
import type { CodegenWidgetMeta } from "../../../core/codegen-metadata.js";
import type { GenerationContext } from "../../../core/generation-context.js";
import type { FfiGeneratorOptions } from "../../../core/generator-types.js";
import type { FfiMapper } from "../../../core/type-system/ffi-mapper.js";
import { analyzeAsyncMethods } from "../../../core/utils/async-analysis.js";
import { collectParentFactoryMethodNames, collectParentMethodNames } from "../../../core/utils/class-traversal.js";
import { buildJsDocStructure } from "../../../core/utils/doc-formatter.js";
import { generateConflictingMethodName, normalizeClassName } from "../../../core/utils/naming.js";
import { type ParentInfo, parseParentReference } from "../../../core/utils/parent-reference.js";
import type { Writers } from "../../../core/writers/index.js";
import { ConstructorBuilder } from "./constructor-builder.js";
import { MethodBuilder } from "./method-builder.js";
import { SignalBuilder } from "./signal-builder.js";
import { StaticFunctionBuilder } from "./static-function-builder.js";
import { type WidgetMetaAnalyzers, WidgetMetaBuilder } from "./widget-meta-builder.js";

/**
 * Result of class generation.
 */
export type ClassGenerationResult = {
    /** Whether generation was successful */
    success: boolean;
    /** Widget metadata for codegen (if this is a widget class) */
    widgetMeta?: CodegenWidgetMeta | null;
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
 * - Widget metadata
 *
 * @example
 * ```typescript
 * const generator = new ClassGenerator(
 *   cls,
 *   ffiMapper,
 *   ctx,
 *   repository,
 *   builders,
 *   { namespace: "Gtk", sharedLibrary: "libgtk-4.so.1" }
 * );
 *
 * generator.generateToSourceFile(sourceFile);
 * ```
 */
export class ClassGenerator {
    private readonly className: string;
    private readonly constructorBuilder: ConstructorBuilder;
    private readonly methodBuilder: MethodBuilder;
    private readonly staticBuilder: StaticFunctionBuilder;
    private readonly signalBuilder: SignalBuilder;
    private readonly widgetMetaBuilder: WidgetMetaBuilder;

    constructor(
        private readonly cls: NormalizedClass,
        ffiMapper: FfiMapper,
        private readonly ctx: GenerationContext,
        private readonly repository: GirRepository,
        writers: Writers,
        private readonly options: FfiGeneratorOptions,
    ) {
        this.className = normalizeClassName(cls.name, options.namespace);

        this.constructorBuilder = new ConstructorBuilder(cls, ffiMapper, ctx, writers, options);
        this.methodBuilder = new MethodBuilder(ffiMapper, ctx, writers, options);
        this.staticBuilder = new StaticFunctionBuilder(cls, ffiMapper, ctx, writers, options);
        this.signalBuilder = new SignalBuilder(cls, ffiMapper, ctx, repository, writers, options);

        const analyzers: WidgetMetaAnalyzers = {
            property: new PropertyAnalyzer(repository, ffiMapper),
            signal: new SignalAnalyzer(repository, ffiMapper),
            constructor: new ConstructorAnalyzer(repository),
        };
        this.widgetMetaBuilder = new WidgetMetaBuilder(cls, repository, ctx, options.namespace, analyzers);
    }

    /**
     * Builds to a ts-morph SourceFile.
     *
     * @param sourceFile - The ts-morph SourceFile to generate into
     * @returns Result containing success flag and optional widget metadata
     *
     * @example
     * ```typescript
     * const generator = new ClassGenerator(cls, ffiMapper, ctx, repository, builders, options);
     * const sourceFile = project.createSourceFile("button.ts");
     * const result = generator.generateToSourceFile(sourceFile);
     * if (result.success) {
     *   // Generation successful
     *   if (result.widgetMeta) {
     *     project.metadata.setWidgetMeta(sourceFile, result.widgetMeta);
     *   }
     * }
     * ```
     */
    generateToSourceFile(sourceFile: SourceFile): ClassGenerationResult {
        if (!this.canGenerate()) {
            return { success: false };
        }

        const asyncAnalysis = this.analyzeAsyncMethods();
        const { asyncMethods, finishMethods } = asyncAnalysis;

        const parentMethodNames = this.collectParentMethodNames();
        const { interfaceMethods, interfaceMethodsByNamespace } = this.collectInterfaceMethods(parentMethodNames);

        const filteredClassMethods = this.filterClassMethods(parentMethodNames);
        const syncMethods = filteredClassMethods.filter((m) => !asyncMethods.has(m.name) && !finishMethods.has(m.name));
        const syncInterfaceMethods = interfaceMethods.filter(
            (m) => !asyncMethods.has(m.name) && !finishMethods.has(m.name),
        );

        this.updateContextFlags(syncMethods, syncInterfaceMethods, interfaceMethods);

        const parentInfo = this.parseParentReferenceInfo();
        const isParamSpec = this.isParamSpecClass();

        const classDecl = this.addClassDeclaration(sourceFile, parentInfo, isParamSpec);

        const parentFactoryMethodNames = collectParentFactoryMethodNames(this.cls);
        this.constructorBuilder.setParentFactoryMethodNames(parentFactoryMethodNames);

        const allMethodStructures = [
            ...this.constructorBuilder.addConstructorAndBuildFactoryStructures(classDecl, parentInfo.hasParent),
            ...this.staticBuilder.buildStructures(),
            ...this.methodBuilder.buildStructures(filteredClassMethods, isParamSpec, asyncAnalysis),
            ...Array.from(interfaceMethodsByNamespace.values()).flatMap((methods) =>
                this.methodBuilder.buildStructures(methods, isParamSpec, asyncAnalysis),
            ),
            ...this.signalBuilder.buildConnectMethodStructures(),
        ];

        if (allMethodStructures.length > 0) {
            classDecl.addMethods(allMethodStructures);
        }

        if (this.cls.glibTypeName) {
            this.ctx.usesRegisterNativeClass = true;
            sourceFile.addStatements(`registerNativeClass(${this.className});`);
        }

        const signalEntries = this.signalBuilder.buildSignalMetaEntries();
        this.widgetMetaBuilder.setSignalEntries(signalEntries);

        this.widgetMetaBuilder.addToClass(classDecl);

        const widgetMeta = this.widgetMetaBuilder.buildCodegenWidgetMeta();

        return { success: true, widgetMeta };
    }

    /**
     * Adds the class declaration to the source file.
     * Includes static properties in the initial addClass() call for optimal ts-morph usage.
     */
    private addClassDeclaration(
        sourceFile: SourceFile,
        parentInfo: ParentInfo,
        isParamSpec: boolean,
    ): ClassDeclaration {
        let extendsExpr: string | undefined;
        if (parentInfo.hasParent) {
            if (parentInfo.isCrossNamespace && parentInfo.namespace) {
                extendsExpr = `${parentInfo.namespace}.${parentInfo.className}`;
            } else {
                extendsExpr = parentInfo.className;
            }
        } else {
            extendsExpr = "NativeObject";
            this.ctx.usesNativeObject = true;
        }

        const staticProperties = this.cls.glibTypeName
            ? [
                  {
                      name: "glibTypeName",
                      isStatic: true,
                      isReadonly: true,
                      type: "string",
                      initializer: `"${this.cls.glibTypeName}"`,
                      hasOverrideKeyword: parentInfo.hasParent,
                  },
                  {
                      name: "objectType",
                      isStatic: true,
                      isReadonly: true,
                      initializer: `"${isParamSpec ? "gparam" : "gobject"}" as const`,
                      hasOverrideKeyword: parentInfo.hasParent,
                  },
              ]
            : [];

        return sourceFile.addClass({
            name: this.className,
            isExported: true,
            extends: extendsExpr,
            docs: buildJsDocStructure(this.cls.doc, this.options.namespace),
            properties: staticProperties,
        });
    }

    private canGenerate(): boolean {
        if (this.cls.constructors.length === 0) return true;

        const hasAnySupportedConstructor = this.cls.constructors.some(
            (c) => !this.methodBuilder.hasUnsupportedCallbacks(c.parameters),
        );

        return hasAnySupportedConstructor;
    }

    private analyzeAsyncMethods() {
        return analyzeAsyncMethods(this.cls.methods);
    }

    private collectParentMethodNames(): Set<string> {
        return collectParentMethodNames(this.cls, this.repository);
    }

    private collectInterfaceMethods(parentMethodNames: Set<string>): {
        interfaceMethods: NormalizedMethod[];
        interfaceMethodsByNamespace: Map<string, NormalizedMethod[]>;
    } {
        const classMethodNames = new Set(this.cls.methods.map((m) => m.name));
        const seenInterfaceMethodNames = new Set<string>();
        const interfaceMethodsByNamespace = new Map<string, NormalizedMethod[]>();

        for (const ifaceQualifiedName of this.cls.implements) {
            const iface = this.repository.resolveInterface(ifaceQualifiedName as QualifiedName);
            if (!iface) continue;

            const sourceNamespace = ifaceQualifiedName.includes(".")
                ? (ifaceQualifiedName.split(".")[0] ?? this.options.namespace)
                : this.options.namespace;

            for (const method of iface.methods) {
                if (classMethodNames.has(method.name) || parentMethodNames.has(method.name)) {
                    continue;
                }

                if (seenInterfaceMethodNames.has(method.name)) {
                    this.handleInterfaceMethodRename(method, iface.name);
                } else {
                    seenInterfaceMethodNames.add(method.name);
                }

                if (!interfaceMethodsByNamespace.has(sourceNamespace)) {
                    interfaceMethodsByNamespace.set(sourceNamespace, []);
                }
                interfaceMethodsByNamespace.get(sourceNamespace)?.push(method);
            }
        }

        const interfaceMethods = Array.from(interfaceMethodsByNamespace.values()).flat();
        return { interfaceMethods, interfaceMethodsByNamespace };
    }

    private handleInterfaceMethodRename(method: NormalizedMethod, ifaceName: string): void {
        const renamedMethod = generateConflictingMethodName(ifaceName, method.name);
        this.ctx.methodRenames.set(method.cIdentifier, renamedMethod);
    }

    private filterClassMethods(parentMethodNames: Set<string>): NormalizedMethod[] {
        return this.cls.methods.filter((m) => {
            const needsRename = parentMethodNames.has(m.name) || (m.name === "connect" && this.cls.parent);
            if (needsRename) {
                const renamedMethod = generateConflictingMethodName(this.cls.name, m.name);
                this.ctx.methodRenames.set(m.cIdentifier, renamedMethod);
            }
            return true;
        });
    }

    private updateContextFlags(
        syncMethods: NormalizedMethod[],
        syncInterfaceMethods: NormalizedMethod[],
        interfaceMethods: NormalizedMethod[],
    ): void {
        this.ctx.usesRef =
            syncMethods.some((m) => this.methodBuilder.hasRefParameter(m.parameters)) ||
            this.cls.constructors.some((c) => this.methodBuilder.hasRefParameter(c.parameters)) ||
            this.cls.staticFunctions.some((f) => this.methodBuilder.hasRefParameter(f.parameters)) ||
            syncInterfaceMethods.some((m) => this.methodBuilder.hasRefParameter(m.parameters));

        const { main: mainConstructor } = this.methodBuilder.selectConstructors(this.cls.constructors);
        const hasParent = !!this.cls.parent;
        const hasMainConstructorWithParent = mainConstructor && hasParent;
        const hasGObjectNewConstructor = !mainConstructor && hasParent && !!this.cls.glibGetType && !this.cls.abstract;
        const hasStaticFactoryMethods =
            this.cls.constructors.some((c) => c !== mainConstructor) ||
            (this.cls.constructors.length > 0 && !hasParent);
        const { allSignals, hasCrossNamespaceParent } = this.signalBuilder.collectAllSignals();
        const hasSignalConnect = allSignals.length > 0 || hasCrossNamespaceParent;

        this.ctx.usesCall =
            this.cls.methods.length > 0 ||
            this.cls.staticFunctions.length > 0 ||
            interfaceMethods.length > 0 ||
            hasMainConstructorWithParent ||
            hasGObjectNewConstructor ||
            hasStaticFactoryMethods ||
            hasSignalConnect;
    }

    private parseParentReferenceInfo(): ParentInfo {
        return parseParentReference(this.cls.parent, this.options.namespace);
    }

    /**
     * Checks if this class is GParamSpec or any of its subclasses.
     * Used to determine the correct self-type descriptor for FFI calls.
     */
    private isParamSpecClass(): boolean {
        return this.isOrExtendsParamSpec(this.cls);
    }

    /**
     * Recursively checks if a class is ParamSpec or extends it.
     */
    private isOrExtendsParamSpec(cls: NormalizedClass): boolean {
        if (cls.name === "ParamSpec" || cls.glibTypeName === "GParam") {
            return true;
        }
        const parent = cls.getParent();
        return parent !== null && this.isOrExtendsParamSpec(parent);
    }
}
