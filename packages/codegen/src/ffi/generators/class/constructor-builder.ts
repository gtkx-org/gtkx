/**
 * Constructor Builder
 *
 * Builds constructor and factory method code for classes.
 */

import type { DefaultValue, GirClass, GirConstructor, GirProperty, GirRepository } from "@gtkx/gir";
import type { ClassDeclaration, MethodDeclarationStructure, WriterFunction } from "ts-morph";
import { Scope, StructureKind } from "ts-morph";
import type { GenerationContext } from "../../../core/generation-context.js";
import type { FfiGeneratorOptions } from "../../../core/generator-types.js";
import type { FfiMapper } from "../../../core/type-system/ffi-mapper.js";
import { collectPropertiesWithDefaults, convertDefaultValue } from "../../../core/utils/default-value.js";
import { buildJsDocStructure } from "../../../core/utils/doc-formatter.js";
import { normalizeClassName, toCamelCase, toKebabCase } from "../../../core/utils/naming.js";
import { createMethodBodyWriter, type MethodBodyWriter, type Writers } from "../../../core/writers/index.js";

/**
 * Builds constructor code for a class.
 */
export class ConstructorBuilder {
    private readonly className: string;
    private readonly methodBody: MethodBodyWriter;
    private parentFactoryMethodNames: Set<string> = new Set();
    private propertyDefaults: Map<string, GirProperty> = new Map();

    constructor(
        private readonly cls: GirClass,
        ffiMapper: FfiMapper,
        private readonly ctx: GenerationContext,
        private readonly repository: GirRepository,
        writers: Writers,
        private readonly options: FfiGeneratorOptions,
    ) {
        this.className = normalizeClassName(cls.name);
        this.methodBody = createMethodBodyWriter(ffiMapper, ctx, writers);
        this.propertyDefaults = collectPropertiesWithDefaults(cls, repository);
    }

    private getDefaultForParameter(paramName: string): DefaultValue | null {
        const kebabName = toKebabCase(paramName);

        const prop = this.propertyDefaults.get(paramName) ?? this.propertyDefaults.get(kebabName);
        return prop?.defaultValue ?? null;
    }

    private isDefaultCompatible(
        defaultValue: DefaultValue,
        param: { type: string; hasQuestionToken?: boolean },
    ): boolean {
        switch (defaultValue.kind) {
            case "null":
                return param.hasQuestionToken === true || param.type.includes("| null");
            case "boolean":
                return param.type === "boolean";
            case "number":
                return param.type === "number";
            case "string":
                return param.type === "string";
            case "enum":
                return !param.hasQuestionToken && !param.type.includes("| null");
            default:
                return false;
        }
    }

    private buildConstructorParameters(
        ctor: GirConstructor,
    ): Array<{ name: string; type: string; hasQuestionToken?: boolean; initializer?: string }> {
        const baseParams = this.methodBody.buildParameterList(ctor.parameters);

        return baseParams.map((param) => {
            const defaultValue = this.getDefaultForParameter(param.name);
            if (!defaultValue) return param;

            if (!this.isDefaultCompatible(defaultValue, param)) return param;

            const conversion = convertDefaultValue(defaultValue, this.repository, this.options.namespace);
            if (!conversion) return param;

            for (const imp of conversion.imports) {
                this.ctx.usedExternalTypes.set(`${imp.namespace}.${imp.name}`, {
                    namespace: imp.namespace,
                    name: imp.name,
                    transformedName: imp.name,
                    kind: "enum",
                });
            }

            return {
                ...param,
                hasQuestionToken: false,
                initializer: conversion.initializer,
            };
        });
    }

    setParentFactoryMethodNames(names: Set<string>): void {
        this.parentFactoryMethodNames = names;
    }

    /**
     * Adds constructor to the class and returns factory method structures.
     * Constructors must be added directly (can't batch with methods).
     * Factory method structures are returned for batch adding by ClassGenerator.
     *
     * @param classDecl - The ts-morph ClassDeclaration to add constructor to
     * @param hasParent - Whether the class has a parent class
     * @returns Array of method declaration structures for factory methods
     *
     * @example
     * ```typescript
     * const builder = new ConstructorBuilder(cls, ffiMapper, ctx, builders, options);
     * const factoryMethods = builder.addConstructorAndBuildFactoryStructures(classDecl, true);
     * classDecl.addMethods([...factoryMethods, ...otherMethods]);
     * ```
     */
    addConstructorAndBuildFactoryStructures(
        classDecl: ClassDeclaration,
        hasParent: boolean,
    ): MethodDeclarationStructure[] {
        const { supported: supportedConstructors, main: mainConstructor } = this.methodBody.selectConstructors(
            this.cls.constructors,
        );
        const methodStructures: MethodDeclarationStructure[] = [];

        if (mainConstructor && hasParent) {
            this.addConstructorWithFlag(classDecl, mainConstructor);
            for (const ctor of supportedConstructors) {
                if (ctor !== mainConstructor && !this.conflictsWithParentFactoryMethod(ctor)) {
                    methodStructures.push(this.buildStaticFactoryMethodStructure(ctor));
                }
            }
        } else {
            for (const ctor of supportedConstructors) {
                if (!this.conflictsWithParentFactoryMethod(ctor)) {
                    methodStructures.push(this.buildStaticFactoryMethodStructure(ctor));
                }
            }

            if (hasParent && this.cls.glibGetType && !this.cls.abstract) {
                this.addGObjectNewConstructor(classDecl, this.cls.glibGetType);
            } else if (hasParent) {
                classDecl.addConstructor({
                    statements: ["super();"],
                });
            } else {
                classDecl.addConstructor({
                    statements: ["super();", "this.create();"],
                });
                methodStructures.push({
                    kind: StructureKind.Method,
                    name: "create",
                    scope: Scope.Protected,
                    statements: [],
                });
            }
        }

        return methodStructures;
    }

    private addConstructorWithFlag(classDecl: ClassDeclaration, ctor: GirConstructor): void {
        this.ctx.usesInstantiating = true;
        this.ctx.usesRegisterNativeObject = true;
        const params = this.buildConstructorParameters(ctor);
        const ownership = ctor.returnType.transferOwnership === "full" ? "full" : "borrowed";

        classDecl.addConstructor({
            parameters: params,
            docs: buildJsDocStructure(ctor.doc, this.options.namespace),
            statements: this.writeConstructorWithFlagBody(ctor, ownership),
        });
    }

    private writeConstructorWithFlagBody(ctor: GirConstructor, ownership: string): WriterFunction {
        const args = this.methodBody.buildCallArgumentsArray(ctor.parameters);

        return (writer) => {
            this.methodBody.writeCallbackWrapperDeclarations(writer, args);

            writer.writeLine("if (!isInstantiating) {");
            writer.indent(() => {
                writer.writeLine("setInstantiating(true);");
                writer.writeLine("// @ts-ignore");
                writer.writeLine("super();");
                writer.writeLine("setInstantiating(false);");
                writer.write("this.handle = call(");
                writer.newLine();
                writer.indent(() => {
                    writer.writeLine(`"${this.options.sharedLibrary}",`);
                    writer.writeLine(`"${ctor.cIdentifier}",`);
                    writer.writeLine("[");
                    writer.indent(() => {
                        for (const arg of args) {
                            writer.write("{ type: ");
                            this.methodBody.getFfiTypeWriter().toWriter(arg.type)(writer);
                            writer.writeLine(`, value: ${arg.value}, optional: ${arg.optional ?? false} },`);
                        }
                    });
                    writer.writeLine("],");
                    writer.writeLine(`{ type: "gobject", ownership: "${ownership}" }`);
                });
                writer.writeLine(") as NativeHandle;");
                writer.writeLine("registerNativeObject(this);");
            });
            writer.writeLine("} else {");
            writer.indent(() => {
                writer.writeLine("// @ts-ignore");
                writer.writeLine("super();");
            });
            writer.writeLine("}");
        };
    }

    private addGObjectNewConstructor(classDecl: ClassDeclaration, glibGetType: string): void {
        this.ctx.usesInstantiating = true;
        this.ctx.usesRegisterNativeObject = true;

        classDecl.addConstructor({
            statements: this.writeGObjectNewConstructorBody(glibGetType),
        });
    }

    private writeGObjectNewConstructorBody(getTypeFunc: string): WriterFunction {
        return (writer) => {
            writer.writeLine("if (!isInstantiating) {");
            writer.indent(() => {
                writer.writeLine("setInstantiating(true);");
                writer.writeLine("// @ts-ignore");
                writer.writeLine("super();");
                writer.writeLine("setInstantiating(false);");

                writer.write("const gtype = call(");
                writer.newLine();
                writer.indent(() => {
                    writer.writeLine(`"${this.options.sharedLibrary}",`);
                    writer.writeLine(`"${getTypeFunc}",`);
                    writer.writeLine("[],");
                    writer.writeLine('{ type: "int", size: 64, unsigned: true }');
                });
                writer.writeLine(");");

                writer.write("this.handle = call(");
                writer.newLine();
                writer.indent(() => {
                    writer.writeLine(`"${this.options.gobjectLibrary}",`);
                    writer.writeLine('"g_object_new",');
                    writer.writeLine("[");
                    writer.indent(() => {
                        writer.writeLine(
                            '{ type: { type: "int", size: 64, unsigned: true }, value: gtype, optional: false },',
                        );
                        writer.writeLine('{ type: { type: "null" }, value: null, optional: false },');
                    });
                    writer.writeLine("],");
                    writer.writeLine('{ type: "gobject", ownership: "full" }');
                });
                writer.writeLine(") as NativeHandle;");
                writer.writeLine("registerNativeObject(this);");
            });
            writer.writeLine("} else {");
            writer.indent(() => {
                writer.writeLine("// @ts-ignore");
                writer.writeLine("super();");
            });
            writer.writeLine("}");
        };
    }

    private conflictsWithParentFactoryMethod(ctor: GirConstructor): boolean {
        const methodName = toCamelCase(ctor.name);
        return this.parentFactoryMethodNames.has(methodName);
    }

    private buildStaticFactoryMethodStructure(ctor: GirConstructor): MethodDeclarationStructure {
        const methodName = toCamelCase(ctor.name);
        const params = this.methodBody.buildParameterList(ctor.parameters);
        this.ctx.usesGetNativeObject = true;

        return {
            kind: StructureKind.Method,
            name: methodName,
            isStatic: true,
            parameters: params,
            returnType: this.className,
            docs: buildJsDocStructure(ctor.doc, this.options.namespace),
            statements: this.writeStaticFactoryMethodBody(ctor),
        };
    }

    private writeStaticFactoryMethodBody(ctor: GirConstructor): WriterFunction {
        const args = this.methodBody.buildCallArgumentsArray(ctor.parameters);
        const ownership = ctor.returnType.transferOwnership === "full" ? "full" : "borrowed";

        return this.methodBody.writeFactoryMethodBody({
            sharedLibrary: this.options.sharedLibrary,
            cIdentifier: ctor.cIdentifier,
            args,
            returnTypeDescriptor: { type: "gobject", ownership },
            wrapClassName: this.className,
            throws: ctor.throws,
            useClassInWrap: false,
        });
    }
}
