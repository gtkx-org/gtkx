/**
 * Constructor Builder
 *
 * Builds constructor and factory method code for classes.
 */

import type { DefaultValue, GirClass, GirConstructor, GirProperty, GirRepository } from "@gtkx/gir";
import type { ClassDeclaration, CodeBlockWriter, MethodDeclarationStructure, WriterFunction } from "ts-morph";
import { Scope, StructureKind } from "ts-morph";
import type { GenerationContext } from "../../../core/generation-context.js";
import type { FfiGeneratorOptions } from "../../../core/generator-types.js";
import type { FfiMapper } from "../../../core/type-system/ffi-mapper.js";
import type { FfiTypeDescriptor, MappedType } from "../../../core/type-system/ffi-types.js";
import { collectPropertiesWithDefaults, convertDefaultValue } from "../../../core/utils/default-value.js";
import { buildJsDocStructure } from "../../../core/utils/doc-formatter.js";
import {
    normalizeClassName,
    snakeToKebab,
    toCamelCase,
    toKebabCase,
    toValidIdentifier,
} from "../../../core/utils/naming.js";
import { createMethodBodyWriter, type MethodBodyWriter, type Writers } from "../../../core/writers/index.js";

type ConstructOnlyPropParam = {
    paramName: string;
    girName: string;
    tsType: string;
    ffiType: FfiTypeDescriptor;
    valueExpr: string;
    isNullable: boolean;
};

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
        private readonly ffiMapper: FfiMapper,
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

        const allConstructOnlyProps = this.collectConstructOnlyProps();
        const coveredNames = new Set(ctor.parameters.map((p) => snakeToKebab(p.name)));
        const uncoveredProps = allConstructOnlyProps.filter((p) => !coveredNames.has(p.girName));

        if (uncoveredProps.length > 0 && this.cls.glibGetType) {
            const extraParams = uncoveredProps.map((prop) => ({
                name: prop.paramName,
                type: prop.tsType,
                hasQuestionToken: true,
            }));

            classDecl.addConstructor({
                parameters: [...params, ...extraParams],
                docs: buildJsDocStructure(ctor.doc, this.options.namespace),
                statements: this.writeConstructorWithFlagBody(ctor, ownership, uncoveredProps),
            });
        } else {
            classDecl.addConstructor({
                parameters: params,
                docs: buildJsDocStructure(ctor.doc, this.options.namespace),
                statements: this.writeConstructorWithFlagBody(ctor, ownership),
            });
        }
    }

    private writeConstructorWithFlagBody(
        ctor: GirConstructor,
        ownership: string,
        uncoveredConstructOnlyProps?: ConstructOnlyPropParam[],
    ): WriterFunction {
        const args = this.methodBody.buildCallArgumentsArray(ctor.parameters);
        const hasUncovered = uncoveredConstructOnlyProps && uncoveredConstructOnlyProps.length > 0;

        const propertyNames = new Set(this.cls.getAllProperties().map((p) => p.name));
        for (const ifaceQName of this.cls.getAllImplementedInterfaces()) {
            const iface = this.repository.resolveInterface(ifaceQName);
            if (iface) {
                for (const prop of iface.properties) {
                    propertyNames.add(prop.name);
                }
            }
        }

        const ctorParamProperties: Array<{ girName: string; ffiType: FfiTypeDescriptor; valueExpr: string }> = [];
        const nonPropertyNonOptionalValues: string[] = [];

        for (let i = 0; i < ctor.parameters.length; i++) {
            const param = ctor.parameters[i];
            const arg = args[i];
            if (!param || !arg) continue;
            const propName = snakeToKebab(param.name);
            if (propertyNames.has(propName)) {
                ctorParamProperties.push({
                    girName: propName,
                    ffiType: arg.type,
                    valueExpr: arg.value,
                });
            } else if (!arg.optional) {
                nonPropertyNonOptionalValues.push(arg.value);
            }
        }

        if (hasUncovered) {
            this.ctx.usesArg = true;
        }

        const glibGetType = this.cls.glibGetType;
        const needsFallback = nonPropertyNonOptionalValues.length > 0 && glibGetType !== undefined;

        if (needsFallback && ctorParamProperties.length > 0) {
            this.ctx.usesArg = true;
        }

        return (writer) => {
            this.methodBody.writeCallbackWrapperDeclarations(writer, args);

            writer.writeLine("if (!isInstantiating) {");
            writer.indent(() => {
                writer.writeLine("setInstantiating(true);");
                writer.writeLine("// @ts-ignore");
                writer.writeLine("super();");
                writer.writeLine("setInstantiating(false);");

                if (hasUncovered && uncoveredConstructOnlyProps) {
                    const condition = uncoveredConstructOnlyProps
                        .map((p) => `${p.paramName} !== undefined`)
                        .join(" || ");
                    const resolvedUncovered = uncoveredConstructOnlyProps;
                    writer.writeLine(`if (${condition}) {`);
                    writer.indent(() => {
                        this.writeGObjectNewBranchCall(writer, ctorParamProperties, resolvedUncovered);
                    });
                    writer.writeLine("} else {");
                    writer.indent(() => {
                        this.writeCConstructorCallWithFallback(
                            writer,
                            ctor.cIdentifier,
                            args,
                            ownership,
                            needsFallback,
                            glibGetType,
                            nonPropertyNonOptionalValues,
                            ctorParamProperties,
                        );
                    });
                    writer.writeLine("}");
                } else {
                    this.writeCConstructorCallWithFallback(
                        writer,
                        ctor.cIdentifier,
                        args,
                        ownership,
                        needsFallback,
                        glibGetType,
                        nonPropertyNonOptionalValues,
                        ctorParamProperties,
                    );
                }

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

    private writeCConstructorCallWithFallback(
        writer: CodeBlockWriter,
        cIdentifier: string,
        args: Array<{ type: FfiTypeDescriptor; value: string; optional?: boolean }>,
        ownership: string,
        needsFallback: boolean,
        glibGetType: string | undefined,
        nonPropertyNonOptionalValues: string[],
        ctorParamProperties: Array<{ girName: string; ffiType: FfiTypeDescriptor; valueExpr: string }>,
    ): void {
        if (!needsFallback || !glibGetType) {
            this.writeCConstructorCall(writer, cIdentifier, args, ownership);
            return;
        }

        const condition = nonPropertyNonOptionalValues.map((v) => `${v} !== undefined`).join(" && ");
        writer.writeLine(`if (${condition}) {`);
        writer.indent(() => {
            this.writeCConstructorCall(writer, cIdentifier, args, ownership);
        });
        writer.writeLine("} else {");
        writer.indent(() => {
            this.writeGObjectNewCall(
                writer,
                glibGetType,
                ctorParamProperties.map((p) => ({
                    girName: p.girName,
                    ffiType: p.ffiType,
                    valueExpr: p.valueExpr,
                    guardExpr: p.valueExpr,
                })),
            );
        });
        writer.writeLine("}");
    }

    private writeCConstructorCall(
        writer: CodeBlockWriter,
        cIdentifier: string,
        args: Array<{ type: FfiTypeDescriptor; value: string; optional?: boolean }>,
        ownership: string,
    ): void {
        writer.write("this.handle = call(");
        writer.newLine();
        writer.indent(() => {
            writer.writeLine(`"${this.options.sharedLibrary}",`);
            writer.writeLine(`"${cIdentifier}",`);
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
    }

    private writeGObjectNewBranchCall(
        writer: CodeBlockWriter,
        ctorParamProperties: Array<{ girName: string; ffiType: FfiTypeDescriptor; valueExpr: string }>,
        uncoveredProps: ConstructOnlyPropParam[],
    ): void {
        const allProps = [
            ...ctorParamProperties.map((p) => ({
                girName: p.girName,
                ffiType: p.ffiType,
                valueExpr: p.valueExpr,
                guardExpr: p.valueExpr,
            })),
            ...uncoveredProps.map((p) => ({
                girName: p.girName,
                ffiType: p.ffiType,
                valueExpr: p.valueExpr,
                guardExpr: p.paramName,
            })),
        ];
        this.writeGObjectNewCall(writer, this.cls.glibGetType as string, allProps);
    }

    private writeGObjectNewCall(
        writer: CodeBlockWriter,
        getTypeFunc: string,
        props: Array<{ girName: string; ffiType: FfiTypeDescriptor; valueExpr: string; guardExpr: string }>,
    ): void {
        writer.write("const gtype = call(");
        writer.newLine();
        writer.indent(() => {
            writer.writeLine(`"${this.options.sharedLibrary}",`);
            writer.writeLine(`"${getTypeFunc}",`);
            writer.writeLine("[],");
            writer.writeLine('{ type: "int", size: 64, unsigned: true }');
        });
        writer.writeLine(");");

        if (props.length > 0) {
            writer.writeLine(
                'const __args: Arg[] = [{ type: { type: "int", size: 64, unsigned: true }, value: gtype, optional: false }];',
            );
            for (const prop of props) {
                writer.writeLine(`if (${prop.guardExpr} !== undefined) {`);
                writer.indent(() => {
                    writer.writeLine("__args.push(");
                    writer.indent(() => {
                        writer.writeLine(
                            `{ type: { type: "string", ownership: "borrowed" }, value: "${prop.girName}", optional: false },`,
                        );
                        writer.write("{ type: ");
                        this.methodBody.getFfiTypeWriter().toWriter(prop.ffiType)(writer);
                        writer.writeLine(`, value: ${prop.valueExpr}, optional: false },`);
                    });
                    writer.writeLine(");");
                });
                writer.writeLine("}");
            }
            writer.writeLine('__args.push({ type: { type: "null" }, value: null, optional: false });');
            writer.write("this.handle = call(");
            writer.newLine();
            writer.indent(() => {
                writer.writeLine(`"${this.options.gobjectLibrary}",`);
                writer.writeLine('"g_object_new",');
                writer.writeLine("__args,");
                writer.writeLine('{ type: "gobject", ownership: "full" }');
            });
            writer.writeLine(") as NativeHandle;");
        } else {
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
        }
    }

    private collectConstructOnlyProps(): ConstructOnlyPropParam[] {
        const result: ConstructOnlyPropParam[] = [];

        for (const prop of this.cls.getAllProperties()) {
            if (!prop.constructOnly) continue;

            const mapped: MappedType = this.ffiMapper.mapType(prop.type, false, prop.type.transferOwnership);
            this.ctx.addTypeImports(mapped.imports);

            const paramName = toValidIdentifier(toCamelCase(prop.name));
            const isNullable = mapped.nullable === true;
            const valueExpr = this.methodBody.buildValueExpression(paramName, mapped, isNullable);

            result.push({
                paramName,
                girName: prop.name,
                tsType: isNullable ? `${mapped.ts} | null` : mapped.ts,
                ffiType: mapped.ffi,
                valueExpr,
                isNullable,
            });
        }

        return result;
    }

    private addGObjectNewConstructor(classDecl: ClassDeclaration, glibGetType: string): void {
        this.ctx.usesInstantiating = true;
        this.ctx.usesRegisterNativeObject = true;

        const constructOnlyProps = this.collectConstructOnlyProps();
        const parameters = constructOnlyProps.map((prop) => ({
            name: prop.paramName,
            type: prop.tsType,
            hasQuestionToken: true,
        }));

        classDecl.addConstructor({
            parameters,
            statements: this.writeGObjectNewConstructorBody(glibGetType, constructOnlyProps),
        });
    }

    private writeGObjectNewConstructorBody(
        getTypeFunc: string,
        constructOnlyProps: ConstructOnlyPropParam[],
    ): WriterFunction {
        if (constructOnlyProps.length > 0) {
            this.ctx.usesArg = true;
        }

        return (writer) => {
            writer.writeLine("if (!isInstantiating) {");
            writer.indent(() => {
                writer.writeLine("setInstantiating(true);");
                writer.writeLine("// @ts-ignore");
                writer.writeLine("super();");
                writer.writeLine("setInstantiating(false);");

                this.writeGObjectNewCall(
                    writer,
                    getTypeFunc,
                    constructOnlyProps.map((p) => ({
                        girName: p.girName,
                        ffiType: p.ffiType,
                        valueExpr: p.valueExpr,
                        guardExpr: p.paramName,
                    })),
                );

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
