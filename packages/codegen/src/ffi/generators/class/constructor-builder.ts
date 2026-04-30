/**
 * Constructor Builder
 *
 * Builds constructor and static factory method code for classes.
 */

import type { DefaultValue, GirClass, GirConstructor, GirProperty, GirRepository } from "@gtkx/gir";
import { type OverloadSignature, param as paramBuilder } from "../../../builders/index.js";
import type { Writer } from "../../../builders/writer.js";
import type { FfiGeneratorOptions } from "../../../core/generator-types.js";
import type { FfiMapper } from "../../../core/type-system/ffi-mapper.js";
import type { FfiTypeDescriptor, MappedType } from "../../../core/type-system/ffi-types.js";
import { collectPropertiesWithDefaults, convertDefaultValue } from "../../../core/utils/default-value.js";
import { buildJsDocStructure } from "../../../core/utils/doc-formatter.js";
import { normalizeClassName, toCamelCase, toKebabCase, toValidIdentifier } from "../../../core/utils/naming.js";
import {
    addTypeImports,
    createMethodBodyWriter,
    type ImportCollector,
    type MethodBodyWriter,
    type MethodStructure,
} from "../../../core/writers/index.js";

type ConstructOnlyPropParam = {
    paramName: string;
    girName: string;
    tsType: string;
    ffiType: FfiTypeDescriptor;
    valueExpr: string;
    isNullable: boolean;
};

type Param = {
    name: string;
    type: string;
    optional?: boolean;
    initializer?: string;
};

/**
 * Constructor overload signature data for the builder API.
 */
type ConstructorOverloads = {
    overloads: OverloadSignature[];
    implParams: Param[];
    bodyWriter: (writer: Writer) => void;
    doc?: string;
};

export class ConstructorBuilder {
    private readonly className: string;
    private readonly methodBody: MethodBodyWriter;
    private parentFactoryMethodNames: Set<string> = new Set();
    private propertyDefaults: Map<string, GirProperty> = new Map();

    constructor(
        private readonly cls: GirClass,
        private readonly ffiMapper: FfiMapper,
        private readonly imports: ImportCollector,
        private readonly repository: GirRepository,
        private readonly options: FfiGeneratorOptions,
        private readonly selfNames: ReadonlySet<string> = new Set(),
    ) {
        this.className = normalizeClassName(cls.name);
        this.methodBody = createMethodBodyWriter(ffiMapper, imports, {
            sharedLibrary: options.sharedLibrary,
            glibLibrary: options.glibLibrary,
            selfNames: this.selfNames,
        });
        this.propertyDefaults = collectPropertiesWithDefaults(cls, repository);
    }

    private getDefaultForParameter(paramName: string): DefaultValue | null {
        const kebabName = toKebabCase(paramName);

        const prop = this.propertyDefaults.get(paramName) ?? this.propertyDefaults.get(kebabName);
        return prop?.defaultValue ?? null;
    }

    private isDefaultCompatible(defaultValue: DefaultValue, param: { type: string; optional?: boolean }): boolean {
        switch (defaultValue.kind) {
            case "null":
                return param.optional === true || param.type.includes("| null");
            case "boolean":
                return param.type === "boolean";
            case "number":
                return param.type === "number";
            case "string":
                return param.type === "string";
            case "enum":
                return !param.optional && !param.type.includes("| null");
            default:
                return false;
        }
    }

    private buildConstructorParameters(ctor: GirConstructor): Param[] {
        const shape = this.methodBody.buildShape(ctor.parameters, undefined, 0);
        const baseParams = this.methodBody.buildSignatureParameters(shape, false);

        return baseParams.map((param) => {
            const defaultValue = this.getDefaultForParameter(param.name);
            if (!defaultValue) return param;

            if (!this.isDefaultCompatible(defaultValue, param)) return param;

            const conversion = convertDefaultValue(defaultValue, this.repository, this.options.namespace);
            if (!conversion) return param;

            for (const imp of conversion.imports) {
                this.imports.addNamespaceImport(`../${imp.namespace.toLowerCase()}/index.js`, imp.namespace);
            }

            return {
                ...param,
                optional: false,
                initializer: conversion.initializer,
            };
        });
    }

    setParentFactoryMethodNames(names: Set<string>): void {
        this.parentFactoryMethodNames = names;
    }

    /**
     * Builds constructor data and factory method structures.
     *
     * @returns An object with constructor data (to be set on the class builder)
     *          and method structures (to be added as static methods).
     */
    buildConstructorAndFactoryMethods(hasParent: boolean): {
        constructorData: ConstructorOverloads | null;
        factoryMethods: MethodStructure[];
    } {
        const { supported: supportedConstructors, main: mainConstructor } = this.methodBody.selectConstructors(
            this.cls.constructors,
        );
        const methodStructures: MethodStructure[] = [];
        let constructorData: ConstructorOverloads | null = null;

        if (mainConstructor && hasParent) {
            constructorData = this.buildConstructorWithOverloads(mainConstructor);
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
                constructorData = this.buildGObjectNewConstructorWithOverloads(this.cls.glibGetType);
            }
        }

        return { constructorData, factoryMethods: methodStructures };
    }

    private buildOverloads(params: Param[]): OverloadSignature[] {
        const handleOverload: OverloadSignature = {
            params: [paramBuilder("handle", "NativeHandle")],
        };

        const optionalFlags = params.map((p) => p.optional || p.initializer !== undefined);

        let seenRequired = false;
        for (let i = optionalFlags.length - 1; i >= 0; i--) {
            if (!optionalFlags[i]) {
                seenRequired = true;
            } else if (seenRequired) {
                optionalFlags[i] = false;
            }
        }

        const typedOverload: OverloadSignature = {
            params: params.map((p, i) => paramBuilder(p.name, p.type, { optional: optionalFlags[i] })),
        };

        return [handleOverload, typedOverload];
    }

    private buildImplementationParams(params: Param[]): Param[] {
        if (params.length === 0) {
            return [{ name: "handle", type: "NativeHandle", optional: true }];
        }

        return params.map((p, i) => {
            if (i === 0) {
                const baseType = p.type.includes("=>") ? `(${p.type})` : p.type;
                return {
                    name: p.name,
                    type: `${baseType} | NativeHandle`,
                    optional: !p.initializer && p.optional,
                    initializer: p.initializer,
                };
            }
            return {
                ...p,
                optional: p.optional || !p.initializer,
            };
        });
    }

    private buildConstructorWithOverloads(ctor: GirConstructor): ConstructorOverloads {
        this.imports.addImport("@gtkx/native", ["isNativeHandle"]);
        this.imports.addTypeImport("../../object.js", ["NativeHandle"]);
        this.imports.addImport("../../registry.js", ["registerNativeObject"]);
        const params = this.buildConstructorParameters(ctor);
        const ownership = ctor.returnType.transferOwnership === "full" ? "full" : "borrowed";

        return {
            overloads: this.buildOverloads(params),
            implParams: this.buildImplementationParams(params),
            bodyWriter: this.writeConstructorBody(ctor, ownership, params),
            doc: ctor.doc,
        };
    }

    private writeConstructorBody(ctor: GirConstructor, ownership: string, params: Param[]): (writer: Writer) => void {
        const shape = this.methodBody.buildShape(ctor.parameters, undefined, 0);
        const args = this.methodBody.buildShapeCallArguments(shape, ctor.parameters);
        const firstParamName = params.length > 0 ? (params[0]?.name ?? "handle") : "handle";

        const forceOptionalNames = new Set(
            params
                .slice(1)
                .filter((p) => !p.optional && !p.initializer)
                .map((p) => p.name),
        );
        for (const arg of args) {
            for (const name of forceOptionalNames) {
                if (arg.value.startsWith(`${name}.`)) {
                    arg.value = arg.value.replace(`${name}.`, `${name}!.`);
                }
            }
        }

        return (writer) => {
            writer.writeLine(`if (isNativeHandle(${firstParamName})) {`);
            writer.withIndent(() => {
                writer.writeLine(`super(${firstParamName});`);
            });
            writer.writeLine("} else {");
            writer.withIndent(() => {
                this.methodBody.writeCallbackWrapperDeclarations(writer, args);
                for (const hidden of shape.hiddenOuts) {
                    this.methodBody.writeHiddenOutDeclarationFor(writer, hidden);
                }
                this.writeCallToVariable(writer, ctor.cIdentifier, args, ownership);
                writer.writeLine("super(__handle);");
                writer.writeLine("registerNativeObject(this);");
            });
            writer.writeLine("}");
        };
    }

    private writeCallToVariable(
        writer: Writer,
        cIdentifier: string,
        args: Array<{ type: FfiTypeDescriptor; value: string; optional?: boolean }>,
        ownership: string,
    ): void {
        const callWriter = this.methodBody.buildCallWriter({
            sharedLibrary: this.options.sharedLibrary,
            cIdentifier,
            args,
            returnType: { type: "gobject", ownership: ownership as "full" | "borrowed" },
        });
        writer.write("const __handle = ");
        callWriter(writer);
        writer.writeLine(" as NativeHandle;");
    }

    private writeGObjectNewCallToVariable(
        writer: Writer,
        getTypeFunc: string,
        props: Array<{ girName: string; ffiType: FfiTypeDescriptor; valueExpr: string; guardExpr: string }>,
    ): void {
        const getTypeWriter = this.methodBody.buildCallWriter({
            sharedLibrary: this.options.sharedLibrary,
            cIdentifier: getTypeFunc,
            args: [],
            returnType: { type: "uint64" },
        });
        writer.write("const gtype = ");
        getTypeWriter(writer);
        writer.writeLine(";");

        if (props.length > 0) {
            this.imports.addImport("../../native.js", ["call"]);
            writer.writeLine('const __args: Arg[] = [{ type: { type: "uint64" }, value: gtype, optional: false }];');
            for (const prop of props) {
                writer.writeLine(`if (${prop.guardExpr} !== undefined) {`);
                writer.withIndent(() => {
                    writer.writeLine("__args.push(");
                    writer.withIndent(() => {
                        writer.writeLine(
                            `{ type: { type: "string", ownership: "borrowed" }, value: "${prop.girName}", optional: false },`,
                        );
                        writer.write("{ type: ");
                        writer.write(JSON.stringify(prop.ffiType));
                        writer.writeLine(`, value: ${prop.valueExpr}, optional: false },`);
                    });
                    writer.writeLine(");");
                });
                writer.writeLine("}");
            }
            writer.writeLine('__args.push({ type: { type: "void" }, value: null, optional: false });');
            writer.write("const __handle = call(");
            writer.newLine();
            writer.withIndent(() => {
                writer.writeLine(`"${this.options.gobjectLibrary}",`);
                writer.writeLine('"g_object_new",');
                writer.writeLine("__args,");
                writer.writeLine('{ type: "gobject", ownership: "full" }');
            });
            writer.writeLine(") as NativeHandle;");
        } else {
            const objectNewWriter = this.methodBody.buildCallWriter({
                sharedLibrary: this.options.gobjectLibrary,
                cIdentifier: "g_object_new",
                args: [
                    { type: { type: "uint64" }, value: "gtype" },
                    { type: { type: "void" }, value: "null" },
                ],
                returnType: { type: "gobject", ownership: "full" },
            });
            writer.write("const __handle = ");
            objectNewWriter(writer);
            writer.writeLine(" as NativeHandle;");
        }
    }

    private collectConstructOnlyProps(): ConstructOnlyPropParam[] {
        const result: ConstructOnlyPropParam[] = [];

        for (const prop of this.cls.getAllProperties()) {
            if (!prop.constructOnly) continue;

            const mapped: MappedType = this.ffiMapper.mapType(prop.type, false, prop.type.transferOwnership);
            addTypeImports(this.imports, mapped.imports, this.selfNames);

            const paramName = toValidIdentifier(toCamelCase(prop.name));
            const isNullable = mapped.nullable === true;

            const callExpr = this.methodBody as unknown as {
                callExpression?: { buildValueExpression(name: string, mapped: MappedType, nullable: boolean): string };
            };
            let valueExpr: string;
            if (callExpr.callExpression) {
                valueExpr = callExpr.callExpression.buildValueExpression(paramName, mapped, isNullable);
            } else {
                valueExpr = isNullable ? `${paramName} ?? null` : paramName;
                if (mapped.ffi.type === "gobject" || mapped.ffi.type === "boxed" || mapped.ffi.type === "fundamental") {
                    valueExpr = isNullable ? `${paramName}?.handle ?? null` : `${paramName}.handle`;
                } else if (mapped.ffi.type === "enum" || mapped.ffi.type === "flags") {
                    valueExpr = isNullable ? `${paramName} ?? null` : `${paramName} as number`;
                }
            }

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

    private buildGObjectNewConstructorWithOverloads(glibGetType: string): ConstructorOverloads {
        this.imports.addImport("@gtkx/native", ["isNativeHandle"]);
        this.imports.addTypeImport("../../object.js", ["NativeHandle"]);
        this.imports.addImport("../../native.js", ["call"]);
        this.imports.addImport("../../registry.js", ["registerNativeObject"]);

        const constructOnlyProps = this.collectConstructOnlyProps();
        const params: Param[] = constructOnlyProps.map((prop) => ({
            name: prop.paramName,
            type: prop.tsType,
            optional: true,
        }));

        if (constructOnlyProps.length > 0) {
            this.imports.addTypeImport("@gtkx/native", ["Arg"]);
        }

        return {
            overloads: this.buildOverloads(params),
            implParams: this.buildImplementationParams(params),
            bodyWriter: this.writeGObjectNewConstructorBody(glibGetType, constructOnlyProps, params),
        };
    }

    private writeGObjectNewConstructorBody(
        getTypeFunc: string,
        constructOnlyProps: ConstructOnlyPropParam[],
        params: Param[],
    ): (writer: Writer) => void {
        const firstParamName = params.length > 0 ? (params[0]?.name ?? "handle") : "handle";

        return (writer) => {
            writer.writeLine(`if (isNativeHandle(${firstParamName})) {`);
            writer.withIndent(() => {
                writer.writeLine(`super(${firstParamName});`);
            });
            writer.writeLine("} else {");
            writer.withIndent(() => {
                this.writeGObjectNewCallToVariable(
                    writer,
                    getTypeFunc,
                    constructOnlyProps.map((p) => ({
                        girName: p.girName,
                        ffiType: p.ffiType,
                        valueExpr: p.valueExpr,
                        guardExpr: p.paramName,
                    })),
                );

                writer.writeLine("super(__handle);");
                writer.writeLine("registerNativeObject(this);");
            });
            writer.writeLine("}");
        };
    }

    private conflictsWithParentFactoryMethod(ctor: GirConstructor): boolean {
        const methodName = toCamelCase(ctor.name);
        return this.parentFactoryMethodNames.has(methodName);
    }

    private buildStaticFactoryMethodStructure(ctor: GirConstructor): MethodStructure {
        const methodName = toCamelCase(ctor.name);
        const shape = this.methodBody.buildShape(ctor.parameters, undefined, 0);
        const params = this.methodBody.buildSignatureParameters(shape, false);
        this.imports.addImport("../../registry.js", ["getNativeObject"]);

        return {
            name: methodName,
            isStatic: true,
            parameters: params,
            returnType: this.className,
            docs: buildJsDocStructure(ctor.doc, this.options.namespace),
            statements: this.writeStaticFactoryMethodBody(ctor),
        };
    }

    private writeStaticFactoryMethodBody(ctor: GirConstructor): (writer: Writer) => void {
        const shape = this.methodBody.buildShape(ctor.parameters, undefined, 0);
        const args = this.methodBody.buildShapeCallArguments(shape, ctor.parameters);
        const ownership = ctor.returnType.transferOwnership === "full" ? "full" : "borrowed";

        return this.methodBody.writeFactoryMethodBody({
            sharedLibrary: this.options.sharedLibrary,
            cIdentifier: ctor.cIdentifier,
            args,
            returnTypeDescriptor: { type: "gobject", ownership },
            wrapClassName: this.className,
            throws: ctor.throws,
            useClassInWrap: false,
            hiddenOuts: shape.hiddenOuts,
        });
    }
}
