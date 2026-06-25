import { describe, expect, it } from "vitest";
import { resolveGtkxConfig } from "../src/config.js";
import {
    GTKX_CONFIG_VIRTUAL_ID,
    RESOLVED_GTKX_CONFIG_VIRTUAL_ID,
    renderGtkxConfigModule,
    serializeGtkxConfig,
} from "../src/virtual.js";

describe("virtual module ids", () => {
    it("marks the resolved id with the rollup virtual prefix", () => {
        expect(GTKX_CONFIG_VIRTUAL_ID).toBe("virtual:gtkx-config");
        expect(RESOLVED_GTKX_CONFIG_VIRTUAL_ID).toBe("\0virtual:gtkx-config");
    });
});

describe("renderGtkxConfigModule", () => {
    it("re-exports the generated metadata tables", () => {
        const source = renderGtkxConfigModule(resolveGtkxConfig({}));
        expect(source).toContain('export * from "@gtkx/jsx/metadata";');
    });

    it("merges the built-in rule registry, defaulting user rules to undefined", () => {
        const lines = renderGtkxConfigModule(resolveGtkxConfig({})).split("\n");
        expect(lines).toContain('import { BUILT_IN_RULES, mergeRules } from "@gtkx/config/rules";');
        expect(lines).toContain("const userRules = undefined;");
        expect(lines).toContain("export const RULE_REGISTRY = mergeRules(BUILT_IN_RULES, userRules);");
    });

    it("imports the user rules module when configured", () => {
        const lines = renderGtkxConfigModule(resolveGtkxConfig({ rules: "./gtkx.rules.ts" })).split("\n");
        expect(lines).toContain('import userRules from "./gtkx.rules.ts";');
    });

    it("serializes each resolved config field as a named constant", () => {
        const source = renderGtkxConfigModule(resolveGtkxConfig({ applicationId: "org.gtk.Demo4" }));
        const lines = source.split("\n");
        expect(lines).toContain('export const applicationId = "org.gtk.Demo4";');
        expect(lines).toContain("export const libraries = [];");
    });

    it("serializes an unset applicationId as undefined", () => {
        const source = renderGtkxConfigModule(resolveGtkxConfig({}));
        expect(source.split("\n")).toContain("export const applicationId = undefined;");
    });
});

describe("serializeGtkxConfig", () => {
    it("projects only the config-derived fields exported into the virtual module", () => {
        const serialized = serializeGtkxConfig(resolveGtkxConfig({ applicationId: "org.gtk.Demo4" }));
        expect(Object.keys(serialized).sort()).toEqual(
            ["applicationId", "girPath", "libraries", "reactCompiler"].sort(),
        );
        expect(serialized.applicationId).toBe("org.gtk.Demo4");
    });
});
