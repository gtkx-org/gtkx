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

    it("serializes the resolved config as a constant", () => {
        const source = renderGtkxConfigModule(resolveGtkxConfig({ applicationId: "org.gtk.Demo4" }));
        const configLine = source.split("\n").find((line) => line.startsWith("export const config = "));
        expect(configLine).toBeDefined();
        const parsed = JSON.parse(configLine?.slice("export const config = ".length, -1) ?? "");
        expect(parsed.applicationId).toBe("org.gtk.Demo4");
        expect(parsed.slots).toEqual({});
        expect(parsed.elementMap).toEqual([]);
    });
});
