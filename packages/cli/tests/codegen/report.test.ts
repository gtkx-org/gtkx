import { describe, expect, it } from "vitest";
import { formatCodegenResult } from "../../src/codegen/report.js";
import type { RunCodegenResult } from "../../src/codegen/run-codegen.js";

const result = (overrides: Partial<RunCodegenResult> = {}): RunCodegenResult => ({
    regenerated: true,
    namespaces: 2,
    intrinsicElements: 142,
    duration: 250,
    girPath: ["/usr/share/gir-1.0"],
    configFile: "/project/gtkx.config.ts",
    libraries: ["Gtk-4.0", "Adw-1"],
    ...overrides,
});

describe("formatCodegenResult", () => {
    it("emits config, libraries, gir path, and totals in order", () => {
        expect(formatCodegenResult(result(), 300)).toEqual([
            "codegen: config=/project/gtkx.config.ts",
            "codegen: libraries=Gtk-4.0, Adw-1",
            "codegen: girPath=/usr/share/gir-1.0",
            "codegen: 2 namespaces, 142 intrinsic elements in 250ms (total 300ms)",
        ]);
    });

    it("skips optional fields when absent", () => {
        const lines = formatCodegenResult(
            result({ configFile: undefined, libraries: undefined, girPath: undefined }),
            5,
        );
        expect(lines).toEqual(["codegen: 2 namespaces, 142 intrinsic elements in 250ms (total 5ms)"]);
    });
});
