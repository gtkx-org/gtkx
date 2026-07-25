import { describe, expect, it } from "vitest";
import { resolveConfig } from "../src/config.js";
import { GTKX_CONFIG_VIRTUAL_ID, RESOLVED_GTKX_CONFIG_VIRTUAL_ID, renderConfigModule } from "../src/virtual.js";

describe("GTKX_CONFIG_VIRTUAL_ID / RESOLVED_GTKX_CONFIG_VIRTUAL_ID", () => {
    it("marks the resolved id with the rollup virtual prefix", () => {
        expect(GTKX_CONFIG_VIRTUAL_ID).toBe("virtual:gtkx-config");
        expect(RESOLVED_GTKX_CONFIG_VIRTUAL_ID).toBe("\0virtual:gtkx-config");
    });
});

describe("renderConfigModule", () => {
    it("re-exports the generated metadata tables", () => {
        const source = renderConfigModule(resolveConfig({ applicationId: "org.gtk.Test" }));
        expect(source).toContain('export * from "@gtkx/jsx/metadata";');
    });

    it("exports the application id as a named constant", () => {
        const source = renderConfigModule(resolveConfig({ applicationId: "org.gtk.Demo4" }));
        expect(source.split("\n")).toContain('export const applicationId = "org.gtk.Demo4";');
    });

    it("exports the resolved user event signals table", () => {
        const resolved = resolveConfig({
            applicationId: "org.gtk.Test",
            userEventSignals: { MyWidget: ["changed"] },
        });
        const source = renderConfigModule(resolved);
        expect(source).toContain(`export const userEventSignals = ${JSON.stringify(resolved.userEventSignals)};`);
    });

    it("exports an empty element behavior table when no behavior module is configured", () => {
        const source = renderConfigModule(resolveConfig({ applicationId: "org.gtk.Test" }));
        expect(source.split("\n")).toContain("export const elementBehaviors = {};");
    });

    it("re-exports the configured behavior module resolved against the project root", () => {
        const resolved = resolveConfig(
            { applicationId: "org.gtk.Test", elementBehaviors: "./src/behaviors.ts" },
            "/project",
        );
        const source = renderConfigModule(resolved);
        expect(source.split("\n")).toContain(
            'export { default as elementBehaviors } from "/project/src/behaviors.ts";',
        );
    });

    it("exports the metadata re-export, application id, signals, lazy elements, and behaviors", () => {
        const resolved = resolveConfig({ applicationId: "org.gtk.Test", girPath: ["/opt/gir"] });
        const source = renderConfigModule(resolved);
        expect(source.split("\n")).toEqual([
            'export * from "@gtkx/jsx/metadata";',
            'export const applicationId = "org.gtk.Test";',
            `export const userEventSignals = ${JSON.stringify(resolved.userEventSignals)};`,
            "export const lazyElements = [];",
            "export const elementBehaviors = {};",
        ]);
    });
});
