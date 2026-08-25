import { kebabCase } from "@gtkx/utils";
import { describe, expect, it } from "vitest";

describe("kebabCase", () => {
    it("converts camelCase to kebab-case", () => {
        expect(kebabCase("helloWorld")).toBe("hello-world");
        expect(kebabCase("userFirstName")).toBe("user-first-name");
    });

    it("converts PascalCase to kebab-case with lowercase initial character", () => {
        expect(kebabCase("HelloWorld")).toBe("hello-world");
        expect(kebabCase("UserFirstName")).toBe("user-first-name");
    });

    it("leaves already kebab-case strings unchanged", () => {
        expect(kebabCase("hello-world")).toBe("hello-world");
        expect(kebabCase("already-kebab-case")).toBe("already-kebab-case");
    });

    it("handles strings with consecutive uppercase letters", () => {
        expect(kebabCase("XMLHTTPRequest")).toBe("x-m-l-h-t-t-p-request");
        expect(kebabCase("ABC")).toBe("a-b-c");
    });

    it("leaves single lowercase words unchanged", () => {
        expect(kebabCase("hello")).toBe("hello");
    });

    it("lowercases a single uppercase letter", () => {
        expect(kebabCase("A")).toBe("a");
    });

    it("handles empty strings", () => {
        expect(kebabCase("")).toBe("");
    });
});
