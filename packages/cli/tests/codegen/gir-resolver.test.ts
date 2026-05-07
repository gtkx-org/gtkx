import { describe, expect, it } from "vitest";
import { resolveGirPath } from "../../src/codegen/gir-resolver.js";

describe("resolveGirPath", () => {
    it("returns the configured paths when provided", () => {
        const result = resolveGirPath(["/custom/gir"]);
        expect(result).toContain("/custom/gir");
        expect(result.indexOf("/custom/gir")).toBe(0);
    });

    it("returns an array even when no config is given", () => {
        const result = resolveGirPath(undefined);
        expect(Array.isArray(result)).toBe(true);
    });

    it("includes paths from GTKX_GIR_PATH environment variable", () => {
        const original = process.env.GTKX_GIR_PATH;
        process.env.GTKX_GIR_PATH = "/env/gir1:/env/gir2";
        try {
            const result = resolveGirPath(undefined);
            expect(result).toContain("/env/gir1");
            expect(result).toContain("/env/gir2");
        } finally {
            if (original === undefined) {
                delete process.env.GTKX_GIR_PATH;
            } else {
                process.env.GTKX_GIR_PATH = original;
            }
        }
    });

    it("filters out empty entries from GTKX_GIR_PATH", () => {
        const original = process.env.GTKX_GIR_PATH;
        process.env.GTKX_GIR_PATH = "/env/gir1::/env/gir2:";
        try {
            const result = resolveGirPath(undefined);
            expect(result).not.toContain("");
            expect(result).toContain("/env/gir1");
            expect(result).toContain("/env/gir2");
        } finally {
            if (original === undefined) {
                delete process.env.GTKX_GIR_PATH;
            } else {
                process.env.GTKX_GIR_PATH = original;
            }
        }
    });

    it("ignores GTKX_GIR_PATH when unset", () => {
        const original = process.env.GTKX_GIR_PATH;
        delete process.env.GTKX_GIR_PATH;
        try {
            const result = resolveGirPath(["/cfg"]);
            expect(result).toEqual(expect.arrayContaining(["/cfg"]));
        } finally {
            if (original !== undefined) {
                process.env.GTKX_GIR_PATH = original;
            }
        }
    });

    it("deduplicates overlapping entries across sources", () => {
        const original = process.env.GTKX_GIR_PATH;
        process.env.GTKX_GIR_PATH = "/dup/path";
        try {
            const result = resolveGirPath(["/dup/path"]);
            const occurrences = result.filter((p) => p === "/dup/path").length;
            expect(occurrences).toBe(1);
        } finally {
            if (original === undefined) {
                delete process.env.GTKX_GIR_PATH;
            } else {
                process.env.GTKX_GIR_PATH = original;
            }
        }
    });

    it("preserves config priority over environment variable", () => {
        const original = process.env.GTKX_GIR_PATH;
        process.env.GTKX_GIR_PATH = "/env";
        try {
            const result = resolveGirPath(["/cfg"]);
            expect(result.indexOf("/cfg")).toBeLessThan(result.indexOf("/env"));
        } finally {
            if (original === undefined) {
                delete process.env.GTKX_GIR_PATH;
            } else {
                process.env.GTKX_GIR_PATH = original;
            }
        }
    });
});
