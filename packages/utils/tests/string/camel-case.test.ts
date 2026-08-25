import { camelCase } from "@gtkx/utils";
import { describe, expect, it } from "vitest";

describe("camelCase", () => {
    it("converts kebab-case to camelCase", () => {
        expect(camelCase("hello-world")).toBe("helloWorld");
        expect(camelCase("button-primary-active")).toBe("buttonPrimaryActive");
    });

    it("converts snake_case to camelCase", () => {
        expect(camelCase("hello_world")).toBe("helloWorld");
        expect(camelCase("user_first_name")).toBe("userFirstName");
    });

    it("leaves already camelCase strings unchanged", () => {
        expect(camelCase("helloWorld")).toBe("helloWorld");
        expect(camelCase("myIdentifier")).toBe("myIdentifier");
    });

    it("handles mixed separators", () => {
        expect(camelCase("foo-bar_baz-qux")).toBe("fooBarBazQux");
    });

    it("handles consecutive separators", () => {
        expect(camelCase("foo--bar__baz")).toBe("fooBarBaz");
    });

    it("handles leading and trailing separators", () => {
        expect(camelCase("-foo-bar-")).toBe("fooBar");
        expect(camelCase("_foo_bar_")).toBe("fooBar");
    });

    it("leaves single words unchanged", () => {
        expect(camelCase("word")).toBe("word");
    });

    it("handles empty strings and separator-only strings", () => {
        expect(camelCase("")).toBe("");
        expect(camelCase("---")).toBe("---");
        expect(camelCase("___")).toBe("___");
    });
});
