import { describe, expect, it } from "vitest";
import { EnumGenerator } from "../../../src/ffi/generators/enum.js";
import { createNormalizedEnumeration, createNormalizedEnumerationMember } from "../../fixtures/gir-fixtures.js";
import { createTestProject, createTestSourceFile, getGeneratedCode } from "../../fixtures/ts-morph-helpers.js";

function createTestSetup() {
    const project = createTestProject();
    const sourceFile = createTestSourceFile(project, "enums.ts");
    const generator = new EnumGenerator(sourceFile, { namespace: "Gtk" });
    return { project, sourceFile, generator };
}

describe("EnumGenerator", () => {
    describe("constructor", () => {
        it("creates generator with source file and options", () => {
            const { generator } = createTestSetup();
            expect(generator).toBeInstanceOf(EnumGenerator);
        });
    });

    describe("addEnums", () => {
        it("adds single enum to source file", () => {
            const { sourceFile, generator } = createTestSetup();
            const enumeration = createNormalizedEnumeration({
                name: "Orientation",
                members: [
                    createNormalizedEnumerationMember({ name: "HORIZONTAL", value: "0" }),
                    createNormalizedEnumerationMember({ name: "VERTICAL", value: "1" }),
                ],
            });

            generator.addEnums([enumeration]);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("export enum Orientation");
            expect(code).toContain("HORIZONTAL = 0");
            expect(code).toContain("VERTICAL = 1");
        });

        it("adds multiple enums to source file", () => {
            const { sourceFile, generator } = createTestSetup();
            const enums = [
                createNormalizedEnumeration({
                    name: "Orientation",
                    members: [createNormalizedEnumerationMember({ name: "HORIZONTAL", value: "0" })],
                }),
                createNormalizedEnumeration({
                    name: "Align",
                    members: [createNormalizedEnumerationMember({ name: "START", value: "0" })],
                }),
            ];

            generator.addEnums(enums);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("export enum Orientation");
            expect(code).toContain("export enum Align");
        });

        it("handles empty enumeration array", () => {
            const { sourceFile, generator } = createTestSetup();

            generator.addEnums([]);

            expect(sourceFile.getEnums()).toHaveLength(0);
        });

        it("converts enum name to PascalCase", () => {
            const { sourceFile, generator } = createTestSetup();
            const enumeration = createNormalizedEnumeration({
                name: "text_direction",
                members: [createNormalizedEnumerationMember({ name: "LTR", value: "0" })],
            });

            generator.addEnums([enumeration]);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("export enum TextDirection");
        });

        it("converts member names to CONSTANT_CASE", () => {
            const { sourceFile, generator } = createTestSetup();
            const enumeration = createNormalizedEnumeration({
                name: "Type",
                members: [
                    createNormalizedEnumerationMember({ name: "some-value", value: "0" }),
                    createNormalizedEnumerationMember({ name: "anotherValue", value: "1" }),
                ],
            });

            generator.addEnums([enumeration]);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("SOME_VALUE = 0");
            expect(code).toContain("ANOTHERVALUE = 1");
        });

        it("prefixes member names starting with digit", () => {
            const { sourceFile, generator } = createTestSetup();
            const enumeration = createNormalizedEnumeration({
                name: "Format",
                members: [
                    createNormalizedEnumerationMember({ name: "1X", value: "0" }),
                    createNormalizedEnumerationMember({ name: "2D", value: "1" }),
                    createNormalizedEnumerationMember({ name: "3D_STEREO", value: "2" }),
                ],
            });

            generator.addEnums([enumeration]);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("_1X = 0");
            expect(code).toContain("_2D = 1");
            expect(code).toContain("_3D_STEREO = 2");
        });

        it("converts string values to numbers", () => {
            const { sourceFile, generator } = createTestSetup();
            const enumeration = createNormalizedEnumeration({
                name: "Value",
                members: [
                    createNormalizedEnumerationMember({ name: "NEGATIVE", value: "-1" }),
                    createNormalizedEnumerationMember({ name: "ZERO", value: "0" }),
                    createNormalizedEnumerationMember({ name: "LARGE", value: "999" }),
                ],
            });

            generator.addEnums([enumeration]);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("NEGATIVE = -1");
            expect(code).toContain("ZERO = 0");
            expect(code).toContain("LARGE = 999");
        });

        it("exports all enums", () => {
            const { sourceFile, generator } = createTestSetup();
            const enumeration = createNormalizedEnumeration({
                name: "Test",
                members: [createNormalizedEnumerationMember({ name: "VALUE", value: "0" })],
            });

            generator.addEnums([enumeration]);

            const enumDecl = sourceFile.getEnum("Test");
            expect(enumDecl?.isExported()).toBe(true);
        });

        it("preserves documentation on enum", () => {
            const { sourceFile, generator } = createTestSetup();
            const enumeration = createNormalizedEnumeration({
                name: "Documented",
                doc: "This is a documented enum",
                members: [createNormalizedEnumerationMember({ name: "VALUE", value: "0" })],
            });

            generator.addEnums([enumeration]);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("This is a documented enum");
        });

        it("preserves documentation on enum members", () => {
            const { sourceFile, generator } = createTestSetup();
            const enumeration = createNormalizedEnumeration({
                name: "Test",
                members: [
                    createNormalizedEnumerationMember({
                        name: "DOCUMENTED",
                        value: "0",
                        doc: "This member has docs",
                    }),
                ],
            });

            generator.addEnums([enumeration]);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("This member has docs");
        });

        it("handles enum with many members", () => {
            const { sourceFile, generator } = createTestSetup();
            const members = Array.from({ length: 20 }, (_, i) =>
                createNormalizedEnumerationMember({ name: `VALUE_${i}`, value: String(i) }),
            );
            const enumeration = createNormalizedEnumeration({ name: "Large", members });

            generator.addEnums([enumeration]);

            const enumDecl = sourceFile.getEnum("Large");
            expect(enumDecl?.getMembers()).toHaveLength(20);
        });
    });

    describe("batched insertion", () => {
        it("uses batched insertion for performance", () => {
            const { sourceFile, generator } = createTestSetup();
            const enums = Array.from({ length: 5 }, (_, i) =>
                createNormalizedEnumeration({
                    name: `Enum${i}`,
                    members: [createNormalizedEnumerationMember({ name: "VALUE", value: "0" })],
                }),
            );

            generator.addEnums(enums);

            expect(sourceFile.getEnums()).toHaveLength(5);
        });
    });
});
