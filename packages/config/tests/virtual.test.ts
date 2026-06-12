import { describe, expect, it } from "vitest";
import {
    GTKX_CONFIG_VIRTUAL_ID,
    RESOLVED_GTKX_CONFIG_VIRTUAL_ID,
    renderGtkxConfigModule,
    resolveGtkxConfig,
} from "../src/index.js";

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

    it("serializes each resolved config field as a named constant", () => {
        const source = renderGtkxConfigModule(resolveGtkxConfig({ applicationId: "org.gtk.Demo4" }));
        const lines = source.split("\n");
        expect(lines).toContain('export const applicationId = "org.gtk.Demo4";');
        expect(lines).toContain("export const containerSlots = {};");
        expect(lines).toContain("export const elementMap = [];");
    });

    it("serializes an unset applicationId as undefined", () => {
        const source = renderGtkxConfigModule(resolveGtkxConfig({}));
        expect(source.split("\n")).toContain("export const applicationId = undefined;");
    });
});
