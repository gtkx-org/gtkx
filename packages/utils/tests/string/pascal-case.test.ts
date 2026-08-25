import { pascalCase } from "@gtkx/utils";
import { describe, expect, it } from "vitest";

describe("pascalCase", () => {
    it("converts kebab-case to PascalCase", () => {
        expect(pascalCase("hello-world")).toBe("HelloWorld");
        expect(pascalCase("custom-dialog-window")).toBe("CustomDialogWindow");
    });

    it("converts snake_case to PascalCase", () => {
        expect(pascalCase("hello_world")).toBe("HelloWorld");
        expect(pascalCase("get_user_profile")).toBe("GetUserProfile");
    });

    it("converts camelCase to PascalCase", () => {
        expect(pascalCase("helloWorld")).toBe("HelloWorld");
        expect(pascalCase("userProfile")).toBe("UserProfile");
    });

    it("handles mixed separators", () => {
        expect(pascalCase("foo-bar_baz-qux")).toBe("FooBarBazQux");
    });

    it("capitalizes a single word", () => {
        expect(pascalCase("hello")).toBe("Hello");
        expect(pascalCase("Hello")).toBe("Hello");
    });

    it("handles empty strings and separator-only strings", () => {
        expect(pascalCase("")).toBe("");
        expect(pascalCase("---")).toBe("---");
        expect(pascalCase("___")).toBe("___");
    });
});
