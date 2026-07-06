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

    it("does not export any rules binding", () => {
        const rules = {
            relationships: [
                { kind: "reject" as const, parent: "GObject", child: "GtkEventController", prop: "controllers" },
            ],
        };
        const source = renderGtkxConfigModule(resolveGtkxConfig({ rules }));
        expect(source).not.toContain("RULES");
        expect(source).not.toContain("rules");
    });

    it("serializes each resolved config field as a named constant", () => {
        const source = renderGtkxConfigModule(resolveGtkxConfig({ applicationId: "org.gtk.Demo4" }));
        const lines = source.split("\n");
        expect(lines).toContain('export const applicationId = "org.gtk.Demo4";');
        expect(lines).toContain("export const libraries = [];");
    });

    it("serializes an unset applicationId as the default application id", () => {
        const source = renderGtkxConfigModule(resolveGtkxConfig({}));
        expect(source.split("\n")).toContain('export const applicationId = "org.gtkx.app";');
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
