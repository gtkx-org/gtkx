import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { CodegenRunner } from "../../src/index.js";

const GIR_PATH = ["/usr/share/gir-1.0"];
const workDir = mkdtempSync(join(tmpdir(), "gtkx-codegen-"));

afterAll(() => {
    rmSync(workDir, { recursive: true, force: true });
});

const REAL_FFI_DIR = join(import.meta.dirname, "..", "..", "..", "ffi");
const REAL_NATIVE_DIR = join(import.meta.dirname, "..", "..", "..", "native");

const giOptions = (name: string) => {
    const root = join(workDir, name);
    return {
        root,
        gi: {
            storeDir: join(root, "node_modules", ".gtkx", "gi"),
            linkDir: join(root, "node_modules", "@gtkx", "gi"),
            realFfiDir: REAL_FFI_DIR,
            realNativeDir: REAL_NATIVE_DIR,
            version: "0.0.0",
        },
    };
};

describe("CodegenRunner", () => {
    it("writes the gi store with raw modules, barrels, a package.json and the visible alias", async () => {
        const { gi } = giOptions("gi-only");
        const result = await new CodegenRunner({ libraries: ["GObject-2.0"], girPath: GIR_PATH, gi }).run();

        expect(result.namespaces).toBeGreaterThan(0);
        expect(result.widgets).toBe(0);
        expect(result.duration).toBeGreaterThanOrEqual(0);
        expect(existsSync(join(gi.storeDir, "gobject", "gobject.js"))).toBe(true);
        expect(existsSync(join(gi.storeDir, "gobject", "gobject.d.ts"))).toBe(true);
        expect(existsSync(join(gi.storeDir, "gobject", "index.js"))).toBe(true);
        expect(existsSync(join(gi.storeDir, "package.json"))).toBe(true);
        expect(existsSync(join(gi.storeDir, ".codegen-fingerprint.json"))).toBe(true);
        expect(existsSync(gi.linkDir)).toBe(true);
    });

    it("writes the jsx unit when jsx options are given", async () => {
        const { root, gi } = giOptions("with-jsx");
        const realReactRuntimeDir = join(root, "fake-react");
        const realReactPackageDir = join(root, "fake-gtkx-react");
        mkdirSync(realReactRuntimeDir, { recursive: true });
        mkdirSync(realReactPackageDir, { recursive: true });
        const jsx = {
            storeDir: join(root, "node_modules", ".gtkx", "jsx"),
            linkDir: join(root, "node_modules", "@gtkx", "jsx"),
            giStoreDir: gi.storeDir,
            realReactRuntimeDir,
            realReactPackageDir,
            version: "0.0.0",
        };

        const result = await new CodegenRunner({ libraries: ["Gtk-4.0"], girPath: GIR_PATH, gi, jsx }).run();

        expect(result.widgets).toBeGreaterThan(0);
        expect(existsSync(join(gi.storeDir, "gtk", "gtk.js"))).toBe(true);
        expect(readFileSync(join(jsx.storeDir, "gtk", "gtk.js"), "utf8").length).toBeGreaterThan(0);
        expect(readFileSync(join(jsx.storeDir, "metadata.js"), "utf8").length).toBeGreaterThan(0);
        expect(existsSync(jsx.linkDir)).toBe(true);
    });

    it("overwrites a pre-existing store on a second run", async () => {
        const { gi } = giOptions("rerun");
        const options = { libraries: ["GLib-2.0"], girPath: GIR_PATH, gi };
        await new CodegenRunner(options).run();
        const result = await new CodegenRunner(options).run();
        expect(result.namespaces).toBeGreaterThan(0);
        expect(existsSync(join(gi.storeDir, "glib", "glib.js"))).toBe(true);
    });
});
