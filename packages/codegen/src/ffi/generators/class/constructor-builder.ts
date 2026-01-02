/**
 * Constructor Builder
 *
 * Builds constructor and factory method code for classes.
 */

import type { NormalizedClass, NormalizedConstructor } from "@gtkx/gir";
import type { ClassDeclaration, MethodDeclarationStructure, WriterFunction } from "ts-morph";
import { Scope, StructureKind } from "ts-morph";
import type { GenerationContext } from "../../../core/generation-context.js";
import type { FfiGeneratorOptions } from "../../../core/generator-types.js";
import type { FfiMapper } from "../../../core/type-system/ffi-mapper.js";
import { buildJsDocStructure } from "../../../core/utils/doc-formatter.js";
import { normalizeClassName, toCamelCase } from "../../../core/utils/naming.js";
import type { Writers } from "../../../core/writers/index.js";
import { MethodBodyWriter } from "../../../core/writers/method-body-writer.js";

/**
 * Builds constructor code for a class.
 */
export class ConstructorBuilder {
    private readonly className: string;
    private readonly methodBody: MethodBodyWriter;
    private parentFactoryMethodNames: Set<string> = new Set();

    constructor(
        private readonly cls: NormalizedClass,
        ffiMapper: FfiMapper,
        private readonly ctx: GenerationContext,
        writers: Writers,
        private readonly options: FfiGeneratorOptions,
    ) {
        this.className = normalizeClassName(cls.name, options.namespace);
        this.methodBody = new MethodBodyWriter(ffiMapper, ctx, writers.ffiTypeWriter);
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

    private addConstructorWithFlag(classDecl: ClassDeclaration, ctor: NormalizedConstructor): void {
        this.ctx.usesInstantiating = true;
        const params = this.methodBody.buildParameterList(ctor.parameters);
        const ownership = ctor.returnType.transferOwnership === "full" ? "full" : "none";

        classDecl.addConstructor({
            parameters: params,
            docs: buildJsDocStructure(ctor.doc, this.options.namespace),
            statements: this.writeConstructorWithFlagBody(ctor, ownership),
        });
    }

    private writeConstructorWithFlagBody(ctor: NormalizedConstructor, ownership: string): WriterFunction {
        const args = this.methodBody.buildCallArgumentsArray(ctor.parameters);

        return (writer) => {
            writer.writeLine("if (!isInstantiating) {");
            writer.indent(() => {
                writer.writeLine("setInstantiating(true);");
                writer.writeLine("// @ts-ignore");
                writer.writeLine("super();");
                writer.writeLine("setInstantiating(false);");
                writer.write("this.id = call(");
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
                writer.writeLine(");");
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

                writer.write("this.id = call(");
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
                writer.writeLine(");");
            });
            writer.writeLine("} else {");
            writer.indent(() => {
                writer.writeLine("// @ts-ignore");
                writer.writeLine("super();");
            });
            writer.writeLine("}");
        };
    }

    private conflictsWithParentFactoryMethod(ctor: NormalizedConstructor): boolean {
        const methodName = toCamelCase(ctor.name);
        return this.parentFactoryMethodNames.has(methodName);
    }

    private buildStaticFactoryMethodStructure(ctor: NormalizedConstructor): MethodDeclarationStructure {
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

    private writeStaticFactoryMethodBody(ctor: NormalizedConstructor): WriterFunction {
        const args = this.methodBody.buildCallArgumentsArray(ctor.parameters);
        const ownership = ctor.returnType.transferOwnership === "full" ? "full" : "none";

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
