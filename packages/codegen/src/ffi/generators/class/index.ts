/**
 * Class Generator
 *
 * Orchestrates the generation of a class module file.
 * Delegates to specialized builders for each component.
 */

import { PropertyAnalyzer, SignalAnalyzer } from "../../../analyzers/index.js";
import type { FileBuilder } from "../../../builders/file-builder.js";
import {
    type ClassDeclarationBuilder,
    type ConstructorBuilder as ConstructorMemberBuilder,
    classDecl,
    constructorDecl,
    interfaceDecl,
    namespaceDecl,
    param,
} from "../../../builders/index.js";
import type { CodegenControllerMeta, CodegenWidgetMeta } from "../../../codegen-metadata.js";
import { addMethodStructure, type MethodStructure } from "../../../ffi-emitters/index.js";
import { resolveNamespaceImportPath } from "../../../ffi-emitters/namespace-import-path.js";
import type { FfiGeneratorOptions } from "../../../generator-types.js";
import type { GirClass, GirMethod, GirRepository } from "../../../gir/index.js";
import type { FfiMapper } from "../../../type-system/ffi-mapper.js";
import { fundamentalSelfType, SELF_TYPE_GOBJECT, type SelfTypeDescriptor } from "../../../type-system/ffi-types.js";
import {
    collectParentFactoryMethodNames,
    collectParentMethodNames,
    collectReachableVirtualMethodNames,
} from "../../../utils/class-traversal.js";
import { buildJsDocStructure } from "../../../utils/doc-formatter.js";
import {
    generateConflictingMethodName,
    normalizeClassName,
    toCamelCase,
    toKebabCase,
    toPascalCase,
} from "../../../utils/naming.js";
import { type ParentInfo, parseParentReference } from "../../../utils/parent-reference.js";
import { splitQualifiedName } from "../../../utils/qualified-name.js";
import { type ClassMetaAnalyzers, ClassMetaBuilder } from "./class-meta-builder.js";
import { ClassStructStaticBuilder } from "./class-struct-static-builder.js";
import { type ConstructionMetaPlan, ConstructorBuilder } from "./constructor-builder.js";
import { MethodBuilder } from "./method-builder.js";
import { PropertyAccessorBuilder } from "./property-accessor-builder.js";
import { SignalBuilder } from "./signal-builder.js";
import { StaticFunctionBuilder } from "./static-function-builder.js";

/**
 * Result of class generation. Carries widget and controller metadata
 * harvested while emitting the class.
 */
type ClassGenerationResult = {
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
/**
 * Options for {@link ClassGenerator}.
 */
export type ClassGeneratorOptions = {
    cls: GirClass;
    ffiMapper: FfiMapper;
    file: FileBuilder;
    repository: GirRepository;
    options: FfiGeneratorOptions;
};

export class ClassGenerator {
    private readonly className: string;
    private readonly constructorBuilder: ConstructorBuilder;
    private readonly methodBuilder: MethodBuilder;
    private readonly staticBuilder: StaticFunctionBuilder;
    private readonly classStructStaticBuilder: ClassStructStaticBuilder;
    private readonly signalBuilder: SignalBuilder;
    private readonly propertyAccessorBuilder: PropertyAccessorBuilder;
    private readonly classMetaBuilder: ClassMetaBuilder;
    private readonly methodRenames = new Map<string, string>();
    private readonly cls: GirClass;
    private readonly file: FileBuilder;
    private readonly repository: GirRepository;
    private readonly options: FfiGeneratorOptions;

    constructor(opts: ClassGeneratorOptions) {
        const { cls, ffiMapper, file, repository, options } = opts;
        this.cls = cls;
        this.file = file;
        this.repository = repository;
        this.options = options;
        this.className = normalizeClassName(cls.name);
        const selfNames = new Set([this.className]);

        const builders = this.createBuilders({ cls, ffiMapper, file, repository, options, selfNames });
        this.constructorBuilder = builders.constructorBuilder;
        this.methodBuilder = builders.methodBuilder;
        this.staticBuilder = builders.staticBuilder;
        this.classStructStaticBuilder = builders.classStructStaticBuilder;
        this.signalBuilder = builders.signalBuilder;
        this.propertyAccessorBuilder = builders.propertyAccessorBuilder;

        const analyzers: ClassMetaAnalyzers = {
            property: new PropertyAnalyzer(repository, ffiMapper),
            signal: new SignalAnalyzer(repository, ffiMapper),
        };
        this.classMetaBuilder = new ClassMetaBuilder(cls, repository, options.namespace, analyzers);
    }

    private createBuilders(deps: {
        cls: GirClass;
        ffiMapper: FfiMapper;
        file: FileBuilder;
        repository: GirRepository;
        options: FfiGeneratorOptions;
        selfNames: Set<string>;
    }): {
        constructorBuilder: ConstructorBuilder;
        methodBuilder: MethodBuilder;
        staticBuilder: StaticFunctionBuilder;
        classStructStaticBuilder: ClassStructStaticBuilder;
        signalBuilder: SignalBuilder;
        propertyAccessorBuilder: PropertyAccessorBuilder;
    } {
        const { cls, ffiMapper, file, repository, options, selfNames } = deps;
        return {
            constructorBuilder: new ConstructorBuilder({
                cls,
                ffiMapper,
                imports: file,
                repository,
                options,
                selfNames,
            }),
            methodBuilder: new MethodBuilder({
                ffiMapper,
                imports: file,
                methodRenames: this.methodRenames,
                options,
                selfNames,
            }),
            staticBuilder: new StaticFunctionBuilder({ cls, ffiMapper, imports: file, options, selfNames }),
            classStructStaticBuilder: new ClassStructStaticBuilder({
                cls,
                ffiMapper,
                imports: file,
                repository,
                options,
                selfNames,
            }),
            signalBuilder: new SignalBuilder({ cls, ffiMapper, imports: file, repository, options, selfNames }),
            propertyAccessorBuilder: new PropertyAccessorBuilder({
                cls,
                ffiMapper,
                imports: file,
                repository,
                options,
                selfNames,
            }),
        };
    }

    /**
     * Generates the class into the FileBuilder.
     *
     * Always emits a class shell carrying type identity (constructor binding,
     * GType registration). When every constructor or method has unsafe
     * parameters/return types, those individual members are filtered out but
     * the class file is still emitted so the type can be referenced as a
     * typed parameter elsewhere.
     *
     * @returns Result with success flag and optional widget/controller metadata.
     */
    generate(): ClassGenerationResult {
        const parentMethodNames = collectParentMethodNames(this.cls, this.repository);
        const { interfaceMethodsByNamespace } = this.collectInterfaceMethods(parentMethodNames);

        const filteredClassMethods = this.filterClassMethods(parentMethodNames);
        const parentInfo = parseParentReference(this.cls.parent, this.options.namespace);
        const selfTypeDescriptor = this.getSelfTypeDescriptor();

        const parentFactoryMethodNames = collectParentFactoryMethodNames(this.cls);
        this.constructorBuilder.setParentFactoryMethodNames(parentFactoryMethodNames);

        const { metaPlan, factoryMethods } = this.constructorBuilder.build();
        const cls = this.buildClassDeclaration(parentInfo);

        this.emitConstructorPropertiesNamespace(parentInfo);

        const allMethodStructures = this.collectAllMethodStructures({
            factoryMethods,
            filteredClassMethods,
            interfaceMethodsByNamespace,
            selfTypeDescriptor,
        });
        for (const struct of allMethodStructures) {
            addMethodStructure(cls, struct);
        }

        for (const { accessor } of this.propertyAccessorBuilder.buildAccessors()) {
            cls.addAccessor(accessor);
        }

        this.file.add(cls);
        this.emitRegistrationAndMeta(metaPlan);

        const widgetMeta = this.classMetaBuilder.buildCodegenWidgetMeta();
        const controllerMeta = this.classMetaBuilder.buildCodegenControllerMeta();

        return { widgetMeta, controllerMeta };
    }

    private collectAllMethodStructures(opts: {
        factoryMethods: MethodStructure[];
        filteredClassMethods: GirMethod[];
        interfaceMethodsByNamespace: Map<string, GirMethod[]>;
        selfTypeDescriptor: SelfTypeDescriptor;
    }): MethodStructure[] {
        const { factoryMethods, filteredClassMethods, interfaceMethodsByNamespace, selfTypeDescriptor } = opts;
        return [
            ...factoryMethods,
            ...this.staticBuilder.buildStructures(),
            ...this.classStructStaticBuilder.buildStructures(),
            ...this.methodBuilder.buildStructures(filteredClassMethods, selfTypeDescriptor),
            ...Array.from(interfaceMethodsByNamespace.values()).flatMap((methods) =>
                this.methodBuilder.buildStructures(methods, selfTypeDescriptor),
            ),
            ...this.signalBuilder.buildConnectMethodStructures(),
        ];
    }

    private emitRegistrationAndMeta(metaPlan: ConstructionMetaPlan): void {
        if (this.cls.glibGetType) {
            const getTypeCall = this.buildGTypeCall(this.cls.glibGetType, this.cls.glibTypeName);
            this.file.addImport("../../registry.js", ["registerNativeClass"]);
            this.file.addStatement(`\n${this.className}.prototype.__gtype__ = 0;`);
            this.file.addStatement(`registerNativeClass(${this.className}, ${getTypeCall});`);
        }

        if (metaPlan.constructionMetaWriter) {
            this.file.addRawBlock(metaPlan.constructionMetaWriter);
        }

        const signalMetaWriter = this.signalBuilder.buildSignalMetaWriter();
        if (signalMetaWriter) {
            this.file.addDeferredBlock(signalMetaWriter);
        }
    }

    private emitConstructorPropertiesNamespace(parentInfo: ParentInfo): void {
        const extendsList: string[] = [];

        if (parentInfo.hasParent) {
            const parentExpr =
                parentInfo.isCrossNamespace && parentInfo.namespace
                    ? `${parentInfo.namespace}.${parentInfo.className}`
                    : parentInfo.className;
            extendsList.push(`${parentExpr}.ConstructorProperties`);
        }

        for (const ifaceQualifiedName of this.cls.implements) {
            const { namespace: ns, name: originalIfaceName } = splitQualifiedName(ifaceQualifiedName);
            const ifaceName = toPascalCase(originalIfaceName);
            if (ns === this.options.namespace) {
                extendsList.push(`${ifaceName}.ConstructorProperties`);
                this.file.addImport(`./${toKebabCase(originalIfaceName)}.js`, [ifaceName]);
            } else {
                extendsList.push(`${ns}.${ifaceName}.ConstructorProperties`);
                this.file.addNamespaceImport(resolveNamespaceImportPath(ns), ns);
            }
        }

        const ns = namespaceDecl(this.className, { exported: true });
        ns.add(
            interfaceDecl("ConstructorProperties", {
                exported: true,
                extends: extendsList,
            }),
        );
        this.file.add(ns);
    }

    private buildClassDeclaration(parentInfo: ParentInfo): ClassDeclarationBuilder {
        let extendsBase: string | undefined;
        if (parentInfo.hasParent) {
            if (parentInfo.isCrossNamespace && parentInfo.namespace) {
                extendsBase = `${parentInfo.namespace}.${parentInfo.className}`;
                this.file.addNamespaceImport(resolveNamespaceImportPath(parentInfo.namespace), parentInfo.namespace);
            } else {
                extendsBase = parentInfo.className;
                if (parentInfo.originalName) {
                    this.file.addImport(`./${toKebabCase(parentInfo.originalName)}.js`, [parentInfo.className]);
                }
            }
        }

        this.file.addImport("../../handles.js", ["getHandle", "tryGetHandle"]);

        const doc = buildJsDocStructure(this.cls.doc, this.options.namespace);
        const cls = classDecl(this.className, {
            exported: true,
            ...(extendsBase === undefined ? {} : { extends: extendsBase }),
            abstract: this.cls.abstract,
            doc: doc?.[0]?.description,
        });

        if (!parentInfo.hasParent) {
            this.file.addImport("../../object.js", ["constructNativeObject"]);
            cls.setConstructor(this.buildRootConstructor());
        }

        return cls;
    }

    private buildRootConstructor(): ConstructorMemberBuilder {
        return constructorDecl({
            params: [param("props", "object", { defaultValue: "{}" })],
            body: (writer) => {
                writer.writeLine("constructNativeObject(this, props);");
            },
        });
    }

    private resolveInterfaceNamespace(ifaceQualifiedName: string): string {
        if (!ifaceQualifiedName.includes(".")) return this.options.namespace;
        return ifaceQualifiedName.split(".")[0] ?? this.options.namespace;
    }

    private collectMethodsForInterface(opts: {
        method: GirMethod;
        ifaceName: string;
        sourceNamespace: string;
        classMethodNames: Set<string>;
        parentMethodNames: Set<string>;
        seenInterfaceMethodNames: Set<string>;
        interfaceMethodsByNamespace: Map<string, GirMethod[]>;
    }): void {
        const {
            method,
            ifaceName,
            sourceNamespace,
            classMethodNames,
            parentMethodNames,
            seenInterfaceMethodNames,
            interfaceMethodsByNamespace,
        } = opts;
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
                this.collectMethodsForInterface({
                    method,
                    ifaceName: iface.name,
                    sourceNamespace,
                    classMethodNames,
                    parentMethodNames,
                    seenInterfaceMethodNames,
                    interfaceMethodsByNamespace,
                });
            }
        }

        const interfaceMethods = Array.from(interfaceMethodsByNamespace.values()).flat();
        return { interfaceMethods, interfaceMethodsByNamespace };
    }

    private handleInterfaceMethodRename(method: GirMethod, ifaceName: string): void {
        const renamedMethod = generateConflictingMethodName(ifaceName, method.name);
        this.methodRenames.set(method.cIdentifier, renamedMethod);
    }

    /**
     * Collects the camelCased names of the class properties whose accessor the
     * runtime actually emits.
     *
     * A property whose name collides with a reachable `<virtual-method>` is
     * suppressed by {@link PropertyAccessorBuilder} — ts-for-gir resolves that
     * conflict by dropping the property and keeping the same-named `<method>`.
     * Excluding such a property here lets {@link filterClassMethods} keep that
     * method instead of shadowing it with an accessor that is never emitted.
     */
    private collectPropertyNames(): Set<string> {
        const virtualMethodNames = collectReachableVirtualMethodNames(this.cls, this.repository);
        return new Set(
            this.cls
                .getAllProperties()
                .map((p) => toCamelCase(p.name))
                .filter((name) => !virtualMethodNames.has(name)),
        );
    }

    private filterClassMethods(parentMethodNames: Set<string>): GirMethod[] {
        const propertyNames = this.collectPropertyNames();
        return this.cls.methods.filter((m) => {
            if (propertyNames.has(toCamelCase(m.name))) return false;
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
            return fundamentalSelfType({
                library: fundamentalInfo.lib,
                refFn: fundamentalInfo.refFn,
                unrefFn: fundamentalInfo.unrefFn,
                ownership: "borrowed",
                typeName: fundamentalInfo.typeName,
            });
        }
        return SELF_TYPE_GOBJECT;
    }

    private buildGTypeCall(cIdentifier: string, glibTypeName: string | undefined): string {
        if (cIdentifier === "intern" || cIdentifier === "") {
            if (!glibTypeName) {
                return `0 /* ${this.className} has no glib:type-name */`;
            }
            const binding = this.file.descriptors.register({
                sharedLibrary: "libgobject-2.0.so.0",
                cIdentifier: "g_type_from_name",
                args: [{ type: { type: "string", ownership: "borrowed" }, value: "" }],
                returnType: { type: "uint64" },
            });
            this.file.addImport("../../native.js", ["t"]);
            if (binding.varargs === false) {
                return `${binding.name}("${glibTypeName}")`;
            }
            this.file.addImport("../../native.js", ["call"]);
            return `call("libgobject-2.0.so.0", "g_type_from_name", [{ type: t.string("borrowed"), value: "${glibTypeName}" }], t.uint64)`;
        }

        const binding = this.file.descriptors.register({
            sharedLibrary: this.options.sharedLibrary,
            cIdentifier,
            args: [],
            returnType: { type: "uint64" },
            exported: true,
        });

        this.file.addImport("../../native.js", ["t"]);
        if (binding.varargs === false) {
            return `${binding.name}()`;
        }
        this.file.addImport("../../native.js", ["call"]);
        return `call("${this.options.sharedLibrary}", "${cIdentifier}", [], t.uint64)`;
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
