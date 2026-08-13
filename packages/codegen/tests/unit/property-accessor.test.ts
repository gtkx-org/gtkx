import { describe, expect, it } from "vitest";
import { fixtureModules } from "../helpers/fixture-modules.js";

const accessor = String(fixtureModules(["Accessor-1.0"]).get("Accessor"));

const sliceFrom = (source: string, head: string, closing: string): string => {
    const index = source.indexOf(head);
    expect(index, `expected ${head} in the generated module`).toBeGreaterThan(-1);

    return source.slice(index, source.indexOf(closing, index));
};

const blockFrom = (source: string, head: string): string => sliceFrom(source, head, "\n    }");
const propertiesBlock = (): string => blockFrom(accessor, "export interface PanelProperties");
const dockClass = (): string => sliceFrom(accessor, "export class Dock extends Frame {", "\n}");

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

describe("a property a subclass redeclares against what its ancestor declares", () => {
    it("reads through the property descriptor when the getter it would delegate to is wider", () => {
        const dock = dockClass();
        expect(dock).toContain("getBadge(): string | null {");

        expect(blockFrom(dock, "get badge()")).toBe(
            'get badge(): string {\n        return getObjectProperty(this, "badge", t.string("borrowed")) as string;',
        );

        expect(blockFrom(dock, "set badge(")).toBe("set badge(value: string) {\n        this.setBadge(value);");
    });

    it("writes through the property descriptor when the setter it would delegate to is narrower", () => {
        const dock = dockClass();
        expect(dock).toContain("setMotto(motto: string): void {");

        expect(blockFrom(dock, "set motto(")).toBe(
            'set motto(value: string | null) {\n        setObjectProperty(this, "motto", t.string("borrowed"), value);',
        );

        expect(blockFrom(dock, "get motto()")).toBe("get motto(): string {\n        return this.getMotto();");
    });
});

describe("every generated accessor", () => {
    it("never casts the result of the method it delegates to", () => {
        expect(accessor).not.toMatch(/return this\.\w+\(\) as /);
    });
});
