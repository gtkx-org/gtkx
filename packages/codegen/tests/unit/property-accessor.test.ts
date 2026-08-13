import { describe, expect, it } from "vitest";
import { fixtureModules } from "../helpers/fixture-modules.js";

const accessor = String(fixtureModules(["Accessor-1.0"]).get("Accessor"));

const blockFrom = (source: string, head: string): string => {
    const index = source.indexOf(head);
    expect(index, `expected ${head} in the generated module`).toBeGreaterThan(-1);

    return source.slice(index, source.indexOf("\n    }", index));
};

const propertiesBlock = (): string => blockFrom(accessor, "export interface PanelProperties");

describe("a property whose getter and setter disagree on nullability", () => {
    it("reads through the getter's own return type", () => {
        expect(accessor).toContain("getCaption(): string | null {");

        expect(blockFrom(accessor, "get caption()")).toBe(
            "get caption(): string | null {\n        return this.getCaption();",
        );
    });

    it("writes through the setter's own parameter type", () => {
        expect(accessor).toContain("setCaption(caption: string): void {");

        expect(blockFrom(accessor, "set caption(")).toBe(
            "set caption(value: string) {\n        this.setCaption(value);",
        );
    });

    it("keeps the getter's type when it is the setter that admits null", () => {
        expect(accessor).toContain("getTitle(): string {");
        expect(blockFrom(accessor, "get title()")).toBe("get title(): string {\n        return this.getTitle();");

        expect(blockFrom(accessor, "set title(")).toBe(
            "set title(value: string | null) {\n        this.setTitle(value);",
        );
    });

    it("types the property map from what the accessor reads", () => {
        expect(propertiesBlock()).toContain("caption: string | null;");
        expect(propertiesBlock()).toContain("title: string;");
    });
});

describe("a property whose setter contradicts the getter's base type", () => {
    it("still reads through the getter it delegates to", () => {
        expect(accessor).toContain("getTags(): string[] {");
        expect(blockFrom(accessor, "get tags()")).toBe("get tags(): string[] {\n        return this.getTags();");
    });

    it("drops the setter delegate and writes through the property descriptor", () => {
        expect(blockFrom(accessor, "set tags(")).toBe(
            "set tags(value: string[] | null) {\n" +
            '        setObjectProperty(this, "tags", t.array(t.string("borrowed"), "array", "borrowed"), value);',
        );
    });
});

describe("every generated accessor", () => {
    it("never casts the result of the method it delegates to", () => {
        expect(accessor).not.toMatch(/return this\.\w+\(\) as /);
    });
});
