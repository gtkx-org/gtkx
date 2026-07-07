import { describe, expect, it } from "vitest";
import { resolveGtkxConfig } from "../src/config.js";
import { GTKX_CONFIG_VIRTUAL_ID, RESOLVED_GTKX_CONFIG_VIRTUAL_ID, renderGtkxConfigModule } from "../src/virtual.js";

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

    it("exports the application id as a named constant", () => {
        const source = renderGtkxConfigModule(resolveGtkxConfig({ applicationId: "org.gtk.Demo4" }));
        expect(source.split("\n")).toContain('export const applicationId = "org.gtk.Demo4";');
    });

    it("exports only the metadata re-export and the application id", () => {
        const source = renderGtkxConfigModule(resolveGtkxConfig({ girPath: ["/opt/gir"] }));
        expect(source.split("\n")).toEqual([
            'export * from "@gtkx/jsx/metadata";',
            'export const applicationId = "org.gtkx.app";',
        ]);
    });

    it("serializes an unset applicationId as the default application id", () => {
        const source = renderGtkxConfigModule(resolveGtkxConfig({}));
        expect(source.split("\n")).toContain('export const applicationId = "org.gtkx.app";');
    });
});
