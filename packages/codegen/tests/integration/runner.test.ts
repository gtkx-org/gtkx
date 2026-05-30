import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { CodegenRunner } from "../../src/index.js";

const GIR_PATH = ["/usr/share/gir-1.0"];
const workDir = mkdtempSync(join(tmpdir(), "gtkx-codegen-"));

afterAll(() => {
    rmSync(workDir, { recursive: true, force: true });
});

describe("CodegenRunner", () => {
    it("writes the FFI tree and skips React when no reactOutDir is given", async () => {
        const ffiOutDir = join(workDir, "ffi-only");
        const result = await new CodegenRunner({
            libraries: ["GObject-2.0"],
            girPath: GIR_PATH,
            ffiOutDir,
        }).run();

        expect(result.namespaces).toBeGreaterThan(0);
        expect(result.widgets).toBe(0);
        expect(result.duration).toBeGreaterThanOrEqual(0);
        expect(existsSync(join(ffiOutDir, "gobject", "gobject.js"))).toBe(true);
        expect(existsSync(join(ffiOutDir, "gobject", "gobject.d.ts"))).toBe(true);
    });

    it("writes both FFI and React trees when reactOutDir is given", async () => {
        const ffiOutDir = join(workDir, "ffi");
        const reactOutDir = join(workDir, "react");
        const result = await new CodegenRunner({
            libraries: ["Gtk-4.0"],
            girPath: GIR_PATH,
            ffiOutDir,
            reactOutDir,
        }).run();

        expect(result.widgets).toBeGreaterThan(0);
        expect(existsSync(join(ffiOutDir, "gtk", "gtk.js"))).toBe(true);
        const jsx = readFileSync(join(reactOutDir, "jsx.js"), "utf8");
        expect(jsx.length).toBeGreaterThan(0);
    });

    it("overwrites a pre-existing output tree on a second run", async () => {
        const ffiOutDir = join(workDir, "rerun");
        const options = { libraries: ["GLib-2.0"], girPath: GIR_PATH, ffiOutDir };
        await new CodegenRunner(options).run();
        const result = await new CodegenRunner(options).run();
        expect(result.namespaces).toBeGreaterThan(0);
        expect(existsSync(join(ffiOutDir, "glib", "glib.js"))).toBe(true);
    });
});
