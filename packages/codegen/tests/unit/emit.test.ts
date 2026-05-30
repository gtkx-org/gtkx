import { describe, expect, it } from "vitest";
import { quote } from "../../src/dsl/emit.js";

const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

describe("quote", () => {
    it("wraps a plain string in double quotes", () => {
        expect(quote("hello")).toBe('"hello"');
    });

    it("escapes angle brackets so a literal cannot break out of an enclosing script context", () => {
        const quoted = quote("a<b>c");
        expect(quoted).not.toContain("<");
        expect(quoted).not.toContain(">");
        expect(JSON.parse(quoted)).toBe("a<b>c");
    });

    it("escapes the line and paragraph separators that prematurely terminate a string literal", () => {
        const raw = `a${LINE_SEPARATOR}b${PARAGRAPH_SEPARATOR}c`;
        const quoted = quote(raw);
        expect(quoted).not.toContain(LINE_SEPARATOR);
        expect(quoted).not.toContain(PARAGRAPH_SEPARATOR);
        expect(JSON.parse(quoted)).toBe(raw);
    });

    it("preserves the standard JSON escapes for quotes and backslashes", () => {
        expect(quote('a"b\\c')).toBe('"a\\"b\\\\c"');
    });
});
