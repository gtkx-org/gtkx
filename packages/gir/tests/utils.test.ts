import { describe, expect, it } from "vitest";
import { toCamelCase, toPascalCase } from "../src/utils.js";

describe("toCamelCase", () => {
    it("converts kebab-case to camelCase", () => {
        expect(toCamelCase("get-name")).toBe("getName");
        expect(toCamelCase("set-visible")).toBe("setVisible");
        expect(toCamelCase("my-long-property-name")).toBe("myLongPropertyName");
    });

    it("converts snake_case to camelCase", () => {
        expect(toCamelCase("get_name")).toBe("getName");
        expect(toCamelCase("set_visible")).toBe("setVisible");
        expect(toCamelCase("my_long_property_name")).toBe("myLongPropertyName");
    });

    it("handles mixed separators", () => {
        expect(toCamelCase("get-my_property")).toBe("getMyProperty");
        expect(toCamelCase("set_some-value")).toBe("setSomeValue");
    });

    it("handles single-word input", () => {
        expect(toCamelCase("name")).toBe("name");
        expect(toCamelCase("visible")).toBe("visible");
    });

    it("handles already camelCase input", () => {
        expect(toCamelCase("getName")).toBe("getName");
        expect(toCamelCase("setVisible")).toBe("setVisible");
    });

    it("handles empty string", () => {
        expect(toCamelCase("")).toBe("");
    });

    it("handles consecutive separators", () => {
        expect(toCamelCase("get--name")).toBe("get-Name");
        expect(toCamelCase("get__name")).toBe("get_Name");
    });

    it("handles leading separator", () => {
        expect(toCamelCase("-name")).toBe("Name");
        expect(toCamelCase("_name")).toBe("Name");
    });

    it("handles trailing separator", () => {
        expect(toCamelCase("name-")).toBe("name-");
        expect(toCamelCase("name_")).toBe("name_");
    });
});

describe("toPascalCase", () => {
    it("converts kebab-case to PascalCase", () => {
        expect(toPascalCase("get-name")).toBe("GetName");
        expect(toPascalCase("set-visible")).toBe("SetVisible");
        expect(toPascalCase("my-long-property-name")).toBe("MyLongPropertyName");
    });

    it("converts snake_case to PascalCase", () => {
        expect(toPascalCase("get_name")).toBe("GetName");
        expect(toPascalCase("set_visible")).toBe("SetVisible");
        expect(toPascalCase("my_long_property_name")).toBe("MyLongPropertyName");
    });

    it("handles single-word input", () => {
        expect(toPascalCase("name")).toBe("Name");
        expect(toPascalCase("visible")).toBe("Visible");
    });

    it("handles already PascalCase input", () => {
        expect(toPascalCase("GetName")).toBe("GetName");
        expect(toPascalCase("SetVisible")).toBe("SetVisible");
    });

    it("capitalizes first letter of lowercase input", () => {
        expect(toPascalCase("widget")).toBe("Widget");
        expect(toPascalCase("button")).toBe("Button");
    });

    it("handles empty string", () => {
        expect(toPascalCase("")).toBe("");
    });
});
