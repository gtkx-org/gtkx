import { describe, expect, it } from "vitest";
import { sanitizeIdentifier, sourceStringLiteral, toCamelIdentifier } from "../src/source.js";

const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

describe("sanitizeIdentifier", () => {
    it("leaves a non-reserved identifier unchanged", () => {
        expect(sanitizeIdentifier("iconName")).toBe("iconName");
    });

    it("appends an underscore to a reserved word", () => {
        expect(sanitizeIdentifier("class")).toBe("class_");
        expect(sanitizeIdentifier("new")).toBe("new_");
        expect(sanitizeIdentifier("default")).toBe("default_");
    });

    it("leaves the empty string unchanged", () => {
        expect(sanitizeIdentifier("")).toBe("");
    });
});

describe("toCamelIdentifier", () => {
    it("camelCases a snake_case GIR name", () => {
        expect(toCamelIdentifier("icon_name")).toBe("iconName");
        expect(toCamelIdentifier("n_pages")).toBe("nPages");
    });

    it("escapes a name that camelCases to a reserved word", () => {
        expect(toCamelIdentifier("class")).toBe("class_");
        expect(toCamelIdentifier("new")).toBe("new_");
    });

    it("leaves the empty string unchanged", () => {
        expect(toCamelIdentifier("")).toBe("");
    });
});

describe("sourceStringLiteral", () => {
    it("wraps a plain string in double quotes", () => {
        expect(sourceStringLiteral("hello")).toBe('"hello"');
    });

    it("escapes angle brackets so a literal cannot break out of an enclosing script context", () => {
        const quoted = sourceStringLiteral("a<b>c");
        expect(quoted).not.toContain("<");
        expect(quoted).not.toContain(">");
        expect(JSON.parse(quoted)).toBe("a<b>c");
    });

    it("escapes the line and paragraph separators that prematurely terminate a string literal", () => {
        const raw = `a${LINE_SEPARATOR}b${PARAGRAPH_SEPARATOR}c`;
        const quoted = sourceStringLiteral(raw);
        expect(quoted).not.toContain(LINE_SEPARATOR);
        expect(quoted).not.toContain(PARAGRAPH_SEPARATOR);
        expect(JSON.parse(quoted)).toBe(raw);
    });

    it("preserves the standard JSON escapes for quotes and backslashes", () => {
        expect(sourceStringLiteral('a"b\\c')).toBe('"a\\"b\\\\c"');
    });
});
