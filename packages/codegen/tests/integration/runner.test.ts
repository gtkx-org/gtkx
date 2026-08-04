import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { runCodegen } from "../../src/index.js";
import { storeUnit } from "../helpers/store-unit.js";

const GIR_PATH = ["/usr/share/gir-1.0"];
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const workDir = mkdtempSync(join(REPO_ROOT, "node_modules", ".gtkx-test-"));

const projectModules = (name: string): string => join(workDir, name, "node_modules");

const registerStoreWriteTests = (): void => {
    it("writes the gi store with raw modules, barrels, a package.json and the visible alias", async () => {
        const gi = storeUnit(projectModules("gi-only"), "gi");

        const result = await runCodegen({
            libraries: ["GObject-2.0"],
            girPath: GIR_PATH,
            gi,
        });

        expect(result.namespaces).toBeGreaterThan(0);
        expect(result.intrinsicElements).toBe(0);
        expect(result.duration).toBeGreaterThanOrEqual(0);
        expect(existsSync(join(gi.storeDir, "gobject", "gobject.js"))).toBe(true);
        expect(existsSync(join(gi.storeDir, "gobject", "gobject.d.ts"))).toBe(true);
        expect(existsSync(join(gi.storeDir, "gobject", "index.js"))).toBe(true);
        expect(existsSync(join(gi.storeDir, "package.json"))).toBe(true);
        expect(existsSync(join(gi.storeDir, ".codegen-fingerprint.json"))).toBe(true);
        expect(existsSync(gi.linkDir)).toBe(true);
    });

    it("writes the jsx unit when jsx options are given", async () => {
        const nodeModules = projectModules("with-jsx");
        const gi = storeUnit(nodeModules, "gi");
        const jsx = storeUnit(nodeModules, "jsx");

        const result = await runCodegen({
            libraries: ["Gtk-4.0"],
            girPath: GIR_PATH,
            gi,
            jsx,
        });

        expect(result.intrinsicElements).toBeGreaterThan(0);
        expect(existsSync(join(gi.storeDir, "gtk", "gtk.js"))).toBe(true);
        expect(readFileSync(join(jsx.storeDir, "gtk", "gtk.js"), "utf8").length).toBeGreaterThan(0);
        expect(readFileSync(join(jsx.storeDir, "metadata.js"), "utf8").length).toBeGreaterThan(0);
        expect(existsSync(jsx.linkDir)).toBe(true);
    });
};

const registerFreshnessTests = (): void => {
    it("skips regeneration when the store fingerprint is still fresh", async () => {
        const gi = storeUnit(projectModules("rerun"), "gi");
        const options = { libraries: ["GLib-2.0"], girPath: GIR_PATH, gi };
        const first = await runCodegen(options);
        expect(first.isRegenerated).toBe(true);
        const second = await runCodegen(options);
        expect(second.isRegenerated).toBe(false);
        expect(second.namespaces).toBe(0);
    });

    it("regenerates when forced", async () => {
        const gi = storeUnit(projectModules("forced"), "gi");
        const options = { libraries: ["GLib-2.0"], girPath: GIR_PATH, gi };
        await runCodegen(options);
        const result = await runCodegen({ ...options, isForced: true });
        expect(result.isRegenerated).toBe(true);
        expect(result.namespaces).toBeGreaterThan(0);
        expect(existsSync(join(gi.storeDir, "glib", "glib.js"))).toBe(true);
    });

    it("regenerates when the fingerprint no longer matches", async () => {
        const gi = storeUnit(projectModules("stale-fp"), "gi");
        const options = { libraries: ["GLib-2.0"], girPath: GIR_PATH, gi };
        await runCodegen(options);

        writeFileSync(
            join(gi.storeDir, ".codegen-fingerprint.json"),
            JSON.stringify({ value: "stale", girFiles: [], libraries: ["GLib-2.0"] }),
        );

        const rerun = await runCodegen(options);
        expect(rerun.isRegenerated).toBe(true);
    });
};

afterAll(() => {
    rmSync(workDir, { recursive: true, force: true });
});

describe("runCodegen", () => {
    registerStoreWriteTests();
    registerFreshnessTests();
});
