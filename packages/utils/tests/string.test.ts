import { describe, expect, it } from "vitest";
import { camelCase, kebabCase, pascalCase, upperFirst } from "../src/string.js";

describe("upperFirst", () => {
    it("uppercases the first character", () => {
        expect(upperFirst("fred")).toBe("Fred");
    });

    it("preserves the casing of the tail", () => {
        expect(upperFirst("fooBar")).toBe("FooBar");
        expect(upperFirst("URL")).toBe("URL");
    });

    it("returns the empty string unchanged", () => {
        expect(upperFirst("")).toBe("");
    });
});

describe("camelCase", () => {
    it("converts snake_case GIR symbols", () => {
        expect(camelCase("icon_name")).toBe("iconName");
        expect(camelCase("get_text")).toBe("getText");
        expect(camelCase("n_pages")).toBe("nPages");
    });

    it("converts kebab-case ids", () => {
        expect(camelCase("start-widget")).toBe("startWidget");
        expect(camelCase("content")).toBe("content");
    });

    it("keeps the first segment verbatim and leaves separator-free input unchanged", () => {
        expect(camelCase("Box")).toBe("Box");
        expect(camelCase("startWidget")).toBe("startWidget");
    });

    it("drops empty segments from leading, trailing, or repeated separators", () => {
        expect(camelCase("a__b")).toBe("aB");
        expect(camelCase("_leading")).toBe("leading");
        expect(camelCase("trailing_")).toBe("trailing");
    });
});

describe("pascalCase", () => {
    it("title-cases every segment", () => {
        expect(pascalCase("icon_name")).toBe("IconName");
        expect(pascalCase("scrolled-window")).toBe("ScrolledWindow");
    });

    it("leaves an already-PascalCase name unchanged", () => {
        expect(pascalCase("Box")).toBe("Box");
        expect(pascalCase("ApplicationWindow")).toBe("ApplicationWindow");
    });

    it("returns the empty string unchanged", () => {
        expect(pascalCase("")).toBe("");
    });
});

describe("kebabCase", () => {
    it("converts camelCase to kebab-case", () => {
        expect(kebabCase("iconName")).toBe("icon-name");
        expect(kebabCase("activeWindow")).toBe("active-window");
    });

    it("lowercases a leading capital without a leading hyphen", () => {
        expect(kebabCase("Title")).toBe("title");
    });

    it("leaves a lowercase word unchanged", () => {
        expect(kebabCase("label")).toBe("label");
    });
});
