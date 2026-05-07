import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { writeGeneratedDir } from "../../../src/core/utils/writer.js";

describe("writeGeneratedDir", () => {
    let outputDir: string;

    beforeEach(() => {
        outputDir = mkdtempSync(join(tmpdir(), "gtkx-writer-test-"));
    });

    afterEach(() => {
        rmSync(outputDir, { recursive: true, force: true });
    });

    it("writes flat files into the output directory", () => {
        const files = new Map<string, string>([
            ["alpha.ts", "export const a = 1;"],
            ["beta.ts", "export const b = 2;"],
        ]);

        writeGeneratedDir(outputDir, files);

        expect(readFileSync(join(outputDir, "alpha.ts"), "utf8")).toBe("export const a = 1;");
        expect(readFileSync(join(outputDir, "beta.ts"), "utf8")).toBe("export const b = 2;");
    });

    it("creates nested subdirectories for namespaced paths", () => {
        const files = new Map<string, string>([
            ["gtk/widget.ts", "// widget"],
            ["gtk/box.ts", "// box"],
            ["adw/window.ts", "// window"],
        ]);

        writeGeneratedDir(outputDir, files);

        expect(readFileSync(join(outputDir, "gtk/widget.ts"), "utf8")).toBe("// widget");
        expect(readFileSync(join(outputDir, "gtk/box.ts"), "utf8")).toBe("// box");
        expect(readFileSync(join(outputDir, "adw/window.ts"), "utf8")).toBe("// window");
    });

    it("wipes prior contents so removed namespaces do not persist", () => {
        const stalePath = join(outputDir, "stale", "old.ts");
        writeFileSync(join(outputDir, "leftover.ts"), "stale");
        rmSync(stalePath, { force: true });

        const files = new Map<string, string>([["fresh.ts", "fresh"]]);
        writeGeneratedDir(outputDir, files);

        expect(existsSync(join(outputDir, "leftover.ts"))).toBe(false);
        expect(readFileSync(join(outputDir, "fresh.ts"), "utf8")).toBe("fresh");
    });

    it("creates the output directory when it does not yet exist", () => {
        const target = join(outputDir, "nested", "out");
        const files = new Map<string, string>([["index.ts", "// index"]]);

        writeGeneratedDir(target, files);

        expect(readFileSync(join(target, "index.ts"), "utf8")).toBe("// index");
    });

    it("accepts an empty file map and produces an empty directory", () => {
        writeGeneratedDir(outputDir, new Map());
        expect(existsSync(outputDir)).toBe(true);
    });
});
