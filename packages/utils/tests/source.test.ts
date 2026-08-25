import {
    escapeIdentifierStart,
    sanitizeIdentifier,
    sanitizeTypeIdentifier,
    sourceStringLiteral,
    toCamelIdentifier,
    unsanitizeIdentifier,
} from "@gtkx/utils";
import { describe, expect, it } from "vitest";

describe("escapeIdentifierStart", () => {
    it("prefixes identifiers starting with a digit with an underscore", () => {
        expect(escapeIdentifierStart("0abc")).toBe("_0abc");
        expect(escapeIdentifierStart("1234")).toBe("_1234");
        expect(escapeIdentifierStart("9item")).toBe("_9item");
    });

    it("leaves identifiers not starting with a digit unchanged", () => {
        expect(escapeIdentifierStart("abc0")).toBe("abc0");
        expect(escapeIdentifierStart("_0abc")).toBe("_0abc");
        expect(escapeIdentifierStart("hello")).toBe("hello");
        expect(escapeIdentifierStart("$var")).toBe("$var");
    });
});

describe("sanitizeIdentifier", () => {
    it("escapes JavaScript reserved words by appending an underscore", () => {
        expect(sanitizeIdentifier("class")).toBe("class_");
        expect(sanitizeIdentifier("function")).toBe("function_");
        expect(sanitizeIdentifier("default")).toBe("default_");
        expect(sanitizeIdentifier("import")).toBe("import_");
        expect(sanitizeIdentifier("return")).toBe("return_");
        expect(sanitizeIdentifier("var")).toBe("var_");
    });

    it("escapes already-escaped reserved words by appending an additional underscore", () => {
        expect(sanitizeIdentifier("class_")).toBe("class__");
        expect(sanitizeIdentifier("function__")).toBe("function___");
    });

    it("prefixes digit-start identifiers with an underscore", () => {
        expect(sanitizeIdentifier("123abc")).toBe("_123abc");
        expect(sanitizeIdentifier("0")).toBe("_0");
    });

    it("leaves normal valid identifiers unchanged", () => {
        expect(sanitizeIdentifier("myIdentifier")).toBe("myIdentifier");
        expect(sanitizeIdentifier("customClass")).toBe("customClass");
    });
});

describe("sanitizeTypeIdentifier", () => {
    it("escapes TypeScript type keywords by appending an underscore", () => {
        expect(sanitizeTypeIdentifier("string")).toBe("string_");
        expect(sanitizeTypeIdentifier("number")).toBe("number_");
        expect(sanitizeTypeIdentifier("boolean")).toBe("boolean_");
        expect(sanitizeTypeIdentifier("any")).toBe("any_");
        expect(sanitizeTypeIdentifier("unknown")).toBe("unknown_");
        expect(sanitizeTypeIdentifier("never")).toBe("never_");
        expect(sanitizeTypeIdentifier("undefined")).toBe("undefined_");
        expect(sanitizeTypeIdentifier("symbol")).toBe("symbol_");
        expect(sanitizeTypeIdentifier("bigint")).toBe("bigint_");
        expect(sanitizeTypeIdentifier("object")).toBe("object_");
    });

    it("also escapes JavaScript reserved words", () => {
        expect(sanitizeTypeIdentifier("class")).toBe("class_");
        expect(sanitizeTypeIdentifier("import")).toBe("import_");
    });

    it("prefixes digit-starting type identifiers with an underscore", () => {
        expect(sanitizeTypeIdentifier("2DVector")).toBe("_2DVector");
    });

    it("leaves normal type identifiers unchanged", () => {
        expect(sanitizeTypeIdentifier("MyType")).toBe("MyType");
        expect(sanitizeTypeIdentifier("UserProps")).toBe("UserProps");
    });
});

describe("unsanitizeIdentifier", () => {
    it("reverses reserved word escaping", () => {
        expect(unsanitizeIdentifier("class_")).toBe("class");
        expect(unsanitizeIdentifier("function_")).toBe("function");
        expect(unsanitizeIdentifier("class__")).toBe("class_");
    });

    it("reverses digit-starting prefix escaping", () => {
        expect(unsanitizeIdentifier("_123abc")).toBe("123abc");
        expect(unsanitizeIdentifier("_0")).toBe("0");
    });

    it("round-trips correctly with sanitizeIdentifier", () => {
        expect(unsanitizeIdentifier(sanitizeIdentifier("class"))).toBe("class");
        expect(unsanitizeIdentifier(sanitizeIdentifier("123test"))).toBe("123test");
        expect(unsanitizeIdentifier(sanitizeIdentifier("myVar"))).toBe("myVar");
    });

    it("leaves normal unescaped identifiers unchanged", () => {
        expect(unsanitizeIdentifier("normalVar")).toBe("normalVar");
        expect(unsanitizeIdentifier("_privateVar")).toBe("_privateVar");
    });
});

describe("toCamelIdentifier", () => {
    it("converts kebab-case and snake_case to camelCase", () => {
        expect(toCamelIdentifier("hello-world")).toBe("helloWorld");
        expect(toCamelIdentifier("user_first_name")).toBe("userFirstName");
    });

    it("escapes reserved words after conversion", () => {
        expect(toCamelIdentifier("class")).toBe("class_");
        expect(toCamelIdentifier("default")).toBe("default_");
        expect(toCamelIdentifier("new")).toBe("new_");
    });

    it("escapes digit-starting identifiers after conversion", () => {
        expect(toCamelIdentifier("123-abc")).toBe("_123Abc");
    });
});

describe("sourceStringLiteral", () => {
    it("wraps string in double quotes and escapes standard JSON characters", () => {
        expect(sourceStringLiteral("hello world")).toBe('"hello world"');
        expect(sourceStringLiteral('hello "world"')).toBe(String.raw`"hello \"world\""`);
        expect(sourceStringLiteral("line 1\nline 2")).toBe(String.raw`"line 1\nline 2"`);
    });

    it("escapes HTML angle brackets < and > to unicode escapes", () => {
        expect(sourceStringLiteral("<script>alert('xss')</script>")).toBe(
            String.raw`"\u003Cscript\u003Ealert('xss')\u003C/script\u003E"`,
        );
    });

    it("escapes Unicode line and paragraph separators", () => {
        const lineSep = String.fromCodePoint(0x20_28);
        const paraSep = String.fromCodePoint(0x20_29);
        expect(sourceStringLiteral(`a${lineSep}b`)).toBe(String.raw`"a\u2028b"`);
        expect(sourceStringLiteral(`c${paraSep}d`)).toBe(String.raw`"c\u2029d"`);
    });

    it("handles empty strings", () => {
        expect(sourceStringLiteral("")).toBe('""');
    });
});
