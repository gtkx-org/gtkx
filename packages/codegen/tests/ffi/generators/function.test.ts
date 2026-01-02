import { describe, expect, it } from "vitest";
import { GenerationContext } from "../../../src/core/generation-context.js";
import { FfiMapper } from "../../../src/core/type-system/ffi-mapper.js";
import { createWriters } from "../../../src/core/writers/index.js";
import { FunctionGenerator } from "../../../src/ffi/generators/function.js";
import {
    createNormalizedFunction,
    createNormalizedNamespace,
    createNormalizedParameter,
    createNormalizedType,
} from "../../fixtures/gir-fixtures.js";
import { createMockRepository } from "../../fixtures/mock-repository.js";
import { createTestProject, createTestSourceFile, getGeneratedCode } from "../../fixtures/ts-morph-helpers.js";

function createTestSetup(namespaces: Map<string, ReturnType<typeof createNormalizedNamespace>> = new Map()) {
    const ns = createNormalizedNamespace({ name: "Gtk" });
    namespaces.set("Gtk", ns);
    const repo = createMockRepository(namespaces);
    const ffiMapper = new FfiMapper(repo as Parameters<typeof FfiMapper>[0], "Gtk");
    const ctx = new GenerationContext();
    const writers = createWriters({
        sharedLibrary: "libgtk-4.so.1",
        glibLibrary: "libglib-2.0.so.0",
    });
    const options = {
        namespace: "Gtk",
        sharedLibrary: "libgtk-4.so.1",
        glibLibrary: "libglib-2.0.so.0",
        gobjectLibrary: "libgobject-2.0.so.0",
    };
    const project = createTestProject();
    const sourceFile = createTestSourceFile(project, "functions.ts");
    const generator = new FunctionGenerator(ffiMapper, ctx, writers, options);
    return { generator, ctx, sourceFile, project };
}

describe("FunctionGenerator", () => {
    describe("constructor", () => {
        it("creates generator with dependencies", () => {
            const { generator } = createTestSetup();
            expect(generator).toBeInstanceOf(FunctionGenerator);
        });
    });

    describe("generateToSourceFile", () => {
        it("returns false when no functions provided", () => {
            const { generator, sourceFile } = createTestSetup();

            const result = generator.generateToSourceFile([], sourceFile);

            expect(result).toBe(false);
        });

        it("returns true when functions are generated", () => {
            const { generator, sourceFile } = createTestSetup();
            const func = createNormalizedFunction({
                name: "init",
                cIdentifier: "gtk_init",
                returnType: createNormalizedType({ name: "none" }),
            });

            const result = generator.generateToSourceFile([func], sourceFile);

            expect(result).toBe(true);
        });

        it("generates single function", () => {
            const { generator, sourceFile } = createTestSetup();
            const func = createNormalizedFunction({
                name: "init",
                cIdentifier: "gtk_init",
                returnType: createNormalizedType({ name: "none" }),
            });

            generator.generateToSourceFile([func], sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("export const init");
        });

        it("generates multiple functions", () => {
            const { generator, sourceFile } = createTestSetup();
            const functions = [
                createNormalizedFunction({
                    name: "init",
                    cIdentifier: "gtk_init",
                    returnType: createNormalizedType({ name: "none" }),
                }),
                createNormalizedFunction({
                    name: "main",
                    cIdentifier: "gtk_main",
                    returnType: createNormalizedType({ name: "none" }),
                }),
            ];

            generator.generateToSourceFile(functions, sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("export const init");
            expect(code).toContain("export const main");
        });

        it("converts function names to camelCase", () => {
            const { generator, sourceFile } = createTestSetup();
            const func = createNormalizedFunction({
                name: "some_long_function",
                cIdentifier: "gtk_some_long_function",
                returnType: createNormalizedType({ name: "none" }),
            });

            generator.generateToSourceFile([func], sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("export const someLongFunction");
        });

        it("generates arrow function syntax", () => {
            const { generator, sourceFile } = createTestSetup();
            const func = createNormalizedFunction({
                name: "test",
                cIdentifier: "gtk_test",
                returnType: createNormalizedType({ name: "none" }),
            });

            generator.generateToSourceFile([func], sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("=>");
        });

        it("includes parameters in function signature", () => {
            const { generator, sourceFile } = createTestSetup();
            const func = createNormalizedFunction({
                name: "with_params",
                cIdentifier: "gtk_with_params",
                returnType: createNormalizedType({ name: "none" }),
                parameters: [
                    createNormalizedParameter({
                        name: "label",
                        type: createNormalizedType({ name: "utf8" }),
                    }),
                    createNormalizedParameter({
                        name: "count",
                        type: createNormalizedType({ name: "gint" }),
                    }),
                ],
            });

            generator.generateToSourceFile([func], sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("label: string");
            expect(code).toContain("count: number");
        });

        it("includes return type for non-void functions", () => {
            const { generator, sourceFile } = createTestSetup();
            const func = createNormalizedFunction({
                name: "get_value",
                cIdentifier: "gtk_get_value",
                returnType: createNormalizedType({ name: "gint" }),
            });

            generator.generateToSourceFile([func], sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain(": number");
        });

        it("handles nullable return types", () => {
            const { generator, sourceFile } = createTestSetup();
            const func = createNormalizedFunction({
                name: "get_value",
                cIdentifier: "gtk_get_value",
                returnType: createNormalizedType({ name: "utf8", nullable: true }),
            });

            generator.generateToSourceFile([func], sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("string | null");
        });

        it("marks optional parameters with question token", () => {
            const { generator, sourceFile } = createTestSetup();
            const func = createNormalizedFunction({
                name: "optional_param",
                cIdentifier: "gtk_optional_param",
                returnType: createNormalizedType({ name: "none" }),
                parameters: [
                    createNormalizedParameter({
                        name: "optional",
                        type: createNormalizedType({ name: "utf8", nullable: true }),
                        nullable: true,
                    }),
                ],
            });

            generator.generateToSourceFile([func], sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("optional?:");
        });

        it("includes call expression in function body", () => {
            const { generator, sourceFile } = createTestSetup();
            const func = createNormalizedFunction({
                name: "test",
                cIdentifier: "gtk_test",
                returnType: createNormalizedType({ name: "gint" }),
            });

            generator.generateToSourceFile([func], sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("call(");
            expect(code).toContain('"libgtk-4.so.1"');
            expect(code).toContain('"gtk_test"');
        });

        it("preserves documentation", () => {
            const { generator, sourceFile } = createTestSetup();
            const func = createNormalizedFunction({
                name: "documented",
                cIdentifier: "gtk_documented",
                returnType: createNormalizedType({ name: "none" }),
                doc: "This function has documentation",
            });

            generator.generateToSourceFile([func], sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("This function has documentation");
        });
    });

    describe("context updates", () => {
        it("sets usesCall flag when functions are generated", () => {
            const { generator, sourceFile, ctx } = createTestSetup();
            const func = createNormalizedFunction({
                name: "test",
                cIdentifier: "gtk_test",
                returnType: createNormalizedType({ name: "none" }),
            });

            generator.generateToSourceFile([func], sourceFile);

            expect(ctx.usesCall).toBe(true);
        });

        it("sets usesRef flag when function has out parameter", () => {
            const { generator, sourceFile, ctx } = createTestSetup();
            const func = createNormalizedFunction({
                name: "with_out",
                cIdentifier: "gtk_with_out",
                returnType: createNormalizedType({ name: "none" }),
                parameters: [
                    createNormalizedParameter({
                        name: "out_value",
                        type: createNormalizedType({ name: "gint" }),
                        direction: "out",
                    }),
                ],
            });

            generator.generateToSourceFile([func], sourceFile);

            expect(ctx.usesRef).toBe(true);
        });

        it("does not set usesRef when no out parameters", () => {
            const { generator, sourceFile, ctx } = createTestSetup();
            const func = createNormalizedFunction({
                name: "simple",
                cIdentifier: "gtk_simple",
                returnType: createNormalizedType({ name: "none" }),
                parameters: [
                    createNormalizedParameter({
                        name: "value",
                        type: createNormalizedType({ name: "gint" }),
                    }),
                ],
            });

            generator.generateToSourceFile([func], sourceFile);

            expect(ctx.usesRef).toBe(false);
        });
    });

    describe("filtering", () => {
        it("generates functions with varargs but omits vararg parameter", () => {
            const { generator, sourceFile } = createTestSetup();
            const functions = [
                createNormalizedFunction({
                    name: "with_varargs",
                    cIdentifier: "gtk_with_varargs",
                    returnType: createNormalizedType({ name: "none" }),
                    parameters: [
                        createNormalizedParameter({
                            name: "format",
                            type: createNormalizedType({ name: "utf8" }),
                        }),
                        createNormalizedParameter({ name: "..." }),
                    ],
                }),
                createNormalizedFunction({
                    name: "normal",
                    cIdentifier: "gtk_normal",
                    returnType: createNormalizedType({ name: "none" }),
                }),
            ];

            generator.generateToSourceFile(functions, sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("withVarargs");
            expect(code).toContain("format: string");
            expect(code).not.toContain("...");
            expect(code).toContain("normal");
        });
    });

    describe("batched insertion", () => {
        it("uses batched insertion for performance", () => {
            const { generator, sourceFile } = createTestSetup();
            const functions = Array.from({ length: 5 }, (_, i) =>
                createNormalizedFunction({
                    name: `func_${i}`,
                    cIdentifier: `gtk_func_${i}`,
                    returnType: createNormalizedType({ name: "none" }),
                }),
            );

            generator.generateToSourceFile(functions, sourceFile);

            const statements = sourceFile.getVariableStatements();
            expect(statements).toHaveLength(5);
        });
    });
});
