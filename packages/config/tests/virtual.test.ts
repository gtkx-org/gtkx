import { describe, expect, it } from "vitest";
import {
    GTKX_CONFIG_VIRTUAL_ID,
    RESOLVED_GTKX_CONFIG_VIRTUAL_ID,
    renderGtkxConfigModule,
    resolveGtkxConfig,
    serializeGtkxConfig,
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
        expect(lines).toContain("export const containerProps = {};");
        expect(lines).toContain("export const elementMap = [];");
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
            [
                "applicationId",
                "arrayProps",
                "containerProps",
                "elementMap",
                "girPath",
                "libraries",
                "objectProps",
                "reactCompiler",
                "virtualProps",
            ].sort(),
        );
        expect(serialized.applicationId).toBe("org.gtk.Demo4");
    });
});
