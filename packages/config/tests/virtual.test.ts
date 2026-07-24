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

    it("exports an empty element prop table when no rule module is configured", () => {
        const source = renderConfigModule(resolveConfig({ applicationId: "org.gtk.Test" }));
        expect(source.split("\n")).toContain("export const elementProps = {};");
    });

    it("re-exports the configured rule module resolved against the project root", () => {
        const resolved = resolveConfig({ applicationId: "org.gtk.Test", elementProps: "./src/rules.ts" }, "/project");
        const source = renderConfigModule(resolved);
        expect(source.split("\n")).toContain('export { default as elementProps } from "/project/src/rules.ts";');
    });

    it("exports only the metadata re-export, the application id, the signals, and the element props", () => {
        const resolved = resolveConfig({ applicationId: "org.gtk.Test", girPath: ["/opt/gir"] });
        const source = renderConfigModule(resolved);
        expect(source.split("\n")).toEqual([
            'export * from "@gtkx/jsx/metadata";',
            'export const applicationId = "org.gtk.Test";',
            `export const userEventSignals = ${JSON.stringify(resolved.userEventSignals)};`,
            "export const elementProps = {};",
        ]);
    });
});
