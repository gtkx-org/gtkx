import {
    camelCase,
    escapeIdentifierStart,
    kebabCase,
    pascalCase,
    sanitizeIdentifier,
    sanitizeTypeIdentifier,
    sourceStringLiteral,
    toCamelIdentifier,
    unsanitizeIdentifier,
} from "@gtkx/utils";
import { describe, expect, it } from "vitest";

describe("source identifiers", () => {
    it.each([
        ["class", "class_"],
        ["class_", "class__"],
        ["2D", "_2D"],
        ["label", "label"],
    ])("escapes %s as %s", (input, output) => {
        expect(sanitizeIdentifier(input)).toBe(output);
        expect(unsanitizeIdentifier(output)).toBe(input);
    });

    it("escapes TypeScript primitive names in type positions", () => {
        expect(sanitizeTypeIdentifier("string")).toBe("string_");
        expect(sanitizeTypeIdentifier("string_")).toBe("string__");
        expect(sanitizeIdentifier("string")).toBe("string");
    });

    it("preserves existing identifier prefixes", () => {
        expect(escapeIdentifierStart("3d")).toBe("_3d");
        expect(escapeIdentifierStart("_name")).toBe("_name");
        expect(unsanitizeIdentifier("_name")).toBe("_name");
        expect(toCamelIdentifier("2d-view")).toBe("_2dView");
    });

    it("serializes source strings without raw markup or line separators", () => {
        const input = '</script>"\\\n\u2028\u2029';
        const literal = sourceStringLiteral(input);
        expect(JSON.parse(literal)).toBe(input);
        expect(literal).not.toMatch(/[<>\u2028\u2029]/);
    });
});

describe("name conversion", () => {
    it.each([
        ["hello_world", "helloWorld", "HelloWorld"],
        ["hello--world", "helloWorld", "HelloWorld"],
        ["alreadyCamel", "alreadyCamel", "AlreadyCamel"],
        ["", "", ""],
    ])("converts %s", (input, camel, pascal) => {
        expect(camelCase(input)).toBe(camel);
        expect(pascalCase(input)).toBe(pascal);
    });

    it("converts property capitals into hyphens", () => {
        expect(kebabCase("marginTop")).toBe("margin-top");
        expect(kebabCase("GtkWidget")).toBe("gtk-widget");
    });
});
