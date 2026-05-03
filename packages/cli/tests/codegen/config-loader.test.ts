import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GtkxConfigNotFoundError, loadGtkxConfig } from "../../src/codegen/config-loader.js";

describe("loadGtkxConfig", () => {
    let cwd: string;

    beforeEach(() => {
        cwd = mkdtempSync(join(tmpdir(), "gtkx-config-"));
    });

    afterEach(() => {
        rmSync(cwd, { recursive: true, force: true });
    });

    it("loads a gtkx.config.ts file using defineConfig", async () => {
        writeFileSync(
            join(cwd, "gtkx.config.ts"),
            `import { defineConfig } from "${join(import.meta.dirname, "../../src/config.ts")}";\n` +
                `export default defineConfig({ libraries: ["Gtk-4.0"] });\n`,
        );

        const result = await loadGtkxConfig(cwd);

        expect(result.config.libraries).toEqual(["Gtk-4.0"]);
        expect(result.configFile?.endsWith("gtkx.config.ts")).toBe(true);
        expect(result.rootDir).toBe(cwd);
    });

    it("loads a config exported as a plain object and validates it", async () => {
        writeFileSync(
            join(cwd, "gtkx.config.ts"),
            "export default { libraries: ['Gtk-4.0', 'Adw-1'], girPath: ['/usr/share/gir-1.0'] };\n",
        );

        const result = await loadGtkxConfig(cwd);

        expect(result.config.libraries).toEqual(["Gtk-4.0", "Adw-1"]);
        expect(result.config.girPath).toEqual(["/usr/share/gir-1.0"]);
    });

    it("throws GtkxConfigNotFoundError when no config file exists", async () => {
        await expect(loadGtkxConfig(cwd)).rejects.toBeInstanceOf(GtkxConfigNotFoundError);
    });

    it("propagates validation errors from defineConfig", async () => {
        writeFileSync(join(cwd, "gtkx.config.ts"), "export default { libraries: [] };\n");
        await expect(loadGtkxConfig(cwd)).rejects.toThrow(/`libraries` must be a non-empty string array/);
    });

    it("rejects an invalid library identifier", async () => {
        writeFileSync(join(cwd, "gtkx.config.ts"), "export default { libraries: ['InvalidLib'] };\n");
        await expect(loadGtkxConfig(cwd)).rejects.toThrow(/invalid library identifier/);
    });
});

describe("GtkxConfigNotFoundError", () => {
    it("includes the cwd in the message and a sample config", () => {
        const error = new GtkxConfigNotFoundError("/some/dir");
        expect(error.name).toBe("GtkxConfigNotFoundError");
        expect(error.message).toContain("/some/dir");
        expect(error.message).toContain("defineConfig");
        expect(error.message).toContain('"Gtk-4.0"');
    });
});
