import { describe, expect, it } from "vitest";
import { toCamelCase, toKebabCase, toLowerFirst, toPascalCase, toUpperFirst } from "../src/string.js";

describe("toUpperFirst", () => {
    it("uppercases the first character", () => {
        expect(toUpperFirst("fred")).toBe("Fred");
    });

    it("preserves the casing of the tail", () => {
        expect(toUpperFirst("fooBar")).toBe("FooBar");
        expect(toUpperFirst("URL")).toBe("URL");
    });

    it("returns the empty string unchanged", () => {
        expect(toUpperFirst("")).toBe("");
    });
});

describe("toLowerFirst", () => {
    it("lowercases the first character", () => {
        expect(toLowerFirst("Fred")).toBe("fred");
    });

    it("preserves the casing of the tail", () => {
        expect(toLowerFirst("FooBar")).toBe("fooBar");
        expect(toLowerFirst("URL")).toBe("uRL");
    });

    it("returns the empty string unchanged", () => {
        expect(toLowerFirst("")).toBe("");
    });
});

describe("toCamelCase", () => {
    it("converts snake_case GIR symbols", () => {
        expect(toCamelCase("icon_name")).toBe("iconName");
        expect(toCamelCase("get_text")).toBe("getText");
        expect(toCamelCase("n_pages")).toBe("nPages");
    });

    it("converts kebab-case ids", () => {
        expect(toCamelCase("start-widget")).toBe("startWidget");
        expect(toCamelCase("content")).toBe("content");
    });

    it("keeps the first segment verbatim and leaves separator-free input unchanged", () => {
        expect(toCamelCase("Box")).toBe("Box");
        expect(toCamelCase("startWidget")).toBe("startWidget");
    });

    it("drops empty segments from leading, trailing, or repeated separators", () => {
        expect(toCamelCase("a__b")).toBe("aB");
        expect(toCamelCase("_leading")).toBe("leading");
        expect(toCamelCase("trailing_")).toBe("trailing");
    });
});

describe("toPascalCase", () => {
    it("title-cases every segment", () => {
        expect(toPascalCase("icon_name")).toBe("IconName");
        expect(toPascalCase("scrolled-window")).toBe("ScrolledWindow");
    });

    it("leaves an already-PascalCase name unchanged", () => {
        expect(toPascalCase("Box")).toBe("Box");
        expect(toPascalCase("ApplicationWindow")).toBe("ApplicationWindow");
    });

    it("returns the empty string unchanged", () => {
        expect(toPascalCase("")).toBe("");
    });
});

describe("toKebabCase", () => {
    it("converts camelCase to kebab-case", () => {
        expect(toKebabCase("iconName")).toBe("icon-name");
        expect(toKebabCase("activeWindow")).toBe("active-window");
    });

    it("lowercases a leading capital without a leading hyphen", () => {
        expect(toKebabCase("Title")).toBe("title");
    });

    it("leaves a lowercase word unchanged", () => {
        expect(toKebabCase("label")).toBe("label");
    });
});
