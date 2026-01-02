import { describe, expect, it } from "vitest";
import { ConstantGenerator } from "../../../src/ffi/generators/constant.js";
import { createNormalizedConstant, createNormalizedType } from "../../fixtures/gir-fixtures.js";
import { createTestProject, createTestSourceFile, getGeneratedCode } from "../../fixtures/ts-morph-helpers.js";

function createTestSetup() {
    const project = createTestProject();
    const sourceFile = createTestSourceFile(project, "constants.ts");
    const generator = new ConstantGenerator(sourceFile, { namespace: "Gtk" });
    return { project, sourceFile, generator };
}

describe("ConstantGenerator", () => {
    describe("constructor", () => {
        it("creates generator with source file and options", () => {
            const { generator } = createTestSetup();
            expect(generator).toBeInstanceOf(ConstantGenerator);
        });
    });

    describe("addConstants", () => {
        it("adds single constant to source file", () => {
            const { sourceFile, generator } = createTestSetup();
            const constant = createNormalizedConstant({
                name: "MAJOR_VERSION",
                value: "4",
                type: createNormalizedType({ name: "gint" }),
            });

            generator.addConstants([constant]);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("export const MAJOR_VERSION = 4");
        });

        it("adds multiple constants to source file", () => {
            const { sourceFile, generator } = createTestSetup();
            const constants = [
                createNormalizedConstant({
                    name: "MAJOR_VERSION",
                    value: "4",
                    type: createNormalizedType({ name: "gint" }),
                }),
                createNormalizedConstant({
                    name: "MINOR_VERSION",
                    value: "0",
                    type: createNormalizedType({ name: "gint" }),
                }),
            ];

            generator.addConstants(constants);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("MAJOR_VERSION = 4");
            expect(code).toContain("MINOR_VERSION = 0");
        });

        it("handles empty constants array", () => {
            const { sourceFile, generator } = createTestSetup();

            generator.addConstants([]);

            expect(sourceFile.getVariableStatements()).toHaveLength(0);
        });

        it("wraps string values in quotes", () => {
            const { sourceFile, generator } = createTestSetup();
            const constant = createNormalizedConstant({
                name: "VERSION_STRING",
                value: "4.0.0",
                type: createNormalizedType({ name: "utf8" }),
            });

            generator.addConstants([constant]);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain('VERSION_STRING = "4.0.0"');
        });

        it("wraps filename type values in quotes", () => {
            const { sourceFile, generator } = createTestSetup();
            const constant = createNormalizedConstant({
                name: "DEFAULT_PATH",
                value: "/usr/share/gtk",
                type: createNormalizedType({ name: "filename" }),
            });

            generator.addConstants([constant]);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain('DEFAULT_PATH = "/usr/share/gtk"');
        });

        it("does not wrap numeric values in quotes", () => {
            const { sourceFile, generator } = createTestSetup();
            const constant = createNormalizedConstant({
                name: "MAX_SIZE",
                value: "65535",
                type: createNormalizedType({ name: "guint" }),
            });

            generator.addConstants([constant]);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("MAX_SIZE = 65535");
            expect(code).not.toContain('"65535"');
        });

        it("does not wrap boolean-like values in quotes", () => {
            const { sourceFile, generator } = createTestSetup();
            const constant = createNormalizedConstant({
                name: "IS_ENABLED",
                value: "true",
                type: createNormalizedType({ name: "gboolean" }),
            });

            generator.addConstants([constant]);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("IS_ENABLED = true");
        });

        it("preserves documentation on constants", () => {
            const { sourceFile, generator } = createTestSetup();
            const constant = createNormalizedConstant({
                name: "DOCUMENTED",
                value: "1",
                type: createNormalizedType({ name: "gint" }),
                doc: "This constant has documentation",
            });

            generator.addConstants([constant]);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("This constant has documentation");
        });

        it("exports all constants", () => {
            const { sourceFile, generator } = createTestSetup();
            const constant = createNormalizedConstant({
                name: "TEST",
                value: "1",
                type: createNormalizedType({ name: "gint" }),
            });

            generator.addConstants([constant]);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("export const TEST");
        });
    });

    describe("deduplication", () => {
        it("skips duplicate constants with same name", () => {
            const { sourceFile, generator } = createTestSetup();
            const constants = [
                createNormalizedConstant({
                    name: "DUPLICATE",
                    value: "1",
                    type: createNormalizedType({ name: "gint" }),
                }),
                createNormalizedConstant({
                    name: "DUPLICATE",
                    value: "2",
                    type: createNormalizedType({ name: "gint" }),
                }),
            ];

            generator.addConstants(constants);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("DUPLICATE = 1");
            expect(code).not.toContain("DUPLICATE = 2");
        });

        it("keeps first occurrence when duplicates exist", () => {
            const { sourceFile, generator } = createTestSetup();
            const constants = [
                createNormalizedConstant({
                    name: "FIRST",
                    value: "first_value",
                    type: createNormalizedType({ name: "utf8" }),
                }),
                createNormalizedConstant({
                    name: "FIRST",
                    value: "second_value",
                    type: createNormalizedType({ name: "utf8" }),
                }),
            ];

            generator.addConstants(constants);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain('"first_value"');
            expect(code).not.toContain('"second_value"');
        });

        it("tracks duplicates across multiple addConstants calls", () => {
            const { sourceFile, generator } = createTestSetup();

            generator.addConstants([
                createNormalizedConstant({
                    name: "SHARED",
                    value: "1",
                    type: createNormalizedType({ name: "gint" }),
                }),
            ]);

            generator.addConstants([
                createNormalizedConstant({
                    name: "SHARED",
                    value: "2",
                    type: createNormalizedType({ name: "gint" }),
                }),
            ]);

            const statements = sourceFile.getVariableStatements();
            expect(statements).toHaveLength(1);
        });

        it("allows different constants with different names", () => {
            const { sourceFile, generator } = createTestSetup();
            const constants = [
                createNormalizedConstant({
                    name: "CONST_A",
                    value: "1",
                    type: createNormalizedType({ name: "gint" }),
                }),
                createNormalizedConstant({
                    name: "CONST_B",
                    value: "2",
                    type: createNormalizedType({ name: "gint" }),
                }),
            ];

            generator.addConstants(constants);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("CONST_A = 1");
            expect(code).toContain("CONST_B = 2");
        });
    });

    describe("batched insertion", () => {
        it("uses batched insertion for performance", () => {
            const { sourceFile, generator } = createTestSetup();
            const constants = Array.from({ length: 10 }, (_, i) =>
                createNormalizedConstant({
                    name: `CONST_${i}`,
                    value: String(i),
                    type: createNormalizedType({ name: "gint" }),
                }),
            );

            generator.addConstants(constants);

            const statements = sourceFile.getVariableStatements();
            expect(statements).toHaveLength(10);
        });
    });

    describe("edge cases", () => {
        it("handles negative numeric values", () => {
            const { sourceFile, generator } = createTestSetup();
            const constant = createNormalizedConstant({
                name: "NEGATIVE",
                value: "-1",
                type: createNormalizedType({ name: "gint" }),
            });

            generator.addConstants([constant]);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("NEGATIVE = -1");
        });

        it("handles floating point values", () => {
            const { sourceFile, generator } = createTestSetup();
            const constant = createNormalizedConstant({
                name: "PI",
                value: "3.14159",
                type: createNormalizedType({ name: "gdouble" }),
            });

            generator.addConstants([constant]);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("PI = 3.14159");
        });

        it("handles empty string values", () => {
            const { sourceFile, generator } = createTestSetup();
            const constant = createNormalizedConstant({
                name: "EMPTY",
                value: "",
                type: createNormalizedType({ name: "utf8" }),
            });

            generator.addConstants([constant]);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain('EMPTY = ""');
        });

        it("handles string with special characters", () => {
            const { sourceFile, generator } = createTestSetup();
            const constant = createNormalizedConstant({
                name: "SPECIAL",
                value: "hello\\nworld",
                type: createNormalizedType({ name: "utf8" }),
            });

            generator.addConstants([constant]);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("SPECIAL =");
        });
    });
});
