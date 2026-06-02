import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GtkxConfigNotFoundError, loadApplicationId, loadGtkxConfig } from "../../src/codegen/config-loader.js";

let cwd: string;

const writeConfig = (contents: string): void => {
    writeFileSync(join(cwd, "gtkx.config.ts"), contents);
};

const defineConfigImport = (): string =>
    `import { defineConfig } from "${join(import.meta.dirname, "../../src/config.ts")}";\n`;

describe("loadGtkxConfig", () => {
    beforeEach(() => {
        cwd = mkdtempSync(join(tmpdir(), "gtkx-config-"));
    });

    afterEach(() => {
        rmSync(cwd, { recursive: true, force: true });
    });

    it("loads a gtkx.config.ts file using defineConfig", async () => {
        writeConfig(`${defineConfigImport()}export default defineConfig({ libraries: ["Gtk-4.0"] });\n`);
        const result = await loadGtkxConfig(cwd);
        expect(result.config.libraries).toEqual(["Gtk-4.0"]);
        expect(result.configFile?.endsWith("gtkx.config.ts")).toBe(true);
        expect(result.rootDir).toBe(cwd);
    });

    it("loads a config exported as a plain object and validates it", async () => {
        writeConfig("export default { libraries: ['Gtk-4.0', 'Adw-1'], girPath: ['/usr/share/gir-1.0'] };\n");
        const result = await loadGtkxConfig(cwd);
        expect(result.config.libraries).toEqual(["Gtk-4.0", "Adw-1"]);
        expect(result.config.girPath).toEqual(["/usr/share/gir-1.0"]);
    });

    it("accepts a config that omits libraries", async () => {
        writeConfig("export default {};\n");
        const result = await loadGtkxConfig(cwd);
        expect(result.config.libraries).toBeUndefined();
        expect(result.configFile?.endsWith("gtkx.config.ts")).toBe(true);
    });

    it('accepts the "*" wildcard for libraries', async () => {
        writeConfig('export default { libraries: "*" };\n');
        const result = await loadGtkxConfig(cwd);
        expect(result.config.libraries).toBe("*");
    });

    it("throws GtkxConfigNotFoundError when no config file exists", async () => {
        await expect(loadGtkxConfig(cwd)).rejects.toBeInstanceOf(GtkxConfigNotFoundError);
    });

    it("propagates validation errors from defineConfig", async () => {
        writeConfig("export default { libraries: [] };\n");
        await expect(loadGtkxConfig(cwd)).rejects.toThrow(
            '`libraries` must be "*", a non-empty string array, or omitted',
        );
    });

    it("rejects an invalid library identifier", async () => {
        writeConfig("export default { libraries: ['InvalidLib'] };\n");
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

describe("loadApplicationId", () => {
    let cwd: string;

    beforeEach(() => {
        cwd = mkdtempSync(join(tmpdir(), "gtkx-load-application-id-"));
    });

    afterEach(() => {
        rmSync(cwd, { recursive: true, force: true });
    });

    it("returns the applicationId declared in gtkx.config.ts", async () => {
        writeFileSync(join(cwd, "gtkx.config.ts"), `export default { applicationId: "org.gtk.Demo4" };\n`);
        await expect(loadApplicationId(cwd)).resolves.toBe("org.gtk.Demo4");
    });

    it("returns undefined when the config omits applicationId", async () => {
        writeFileSync(join(cwd, "gtkx.config.ts"), `export default { libraries: ["Gtk-4.0"] };\n`);
        await expect(loadApplicationId(cwd)).resolves.toBeUndefined();
    });

    it("returns undefined when no config file exists", async () => {
        await expect(loadApplicationId(cwd)).resolves.toBeUndefined();
    });

    it("propagates validation errors from defineConfig", async () => {
        writeFileSync(join(cwd, "gtkx.config.ts"), `export default { applicationId: "not valid" };\n`);
        await expect(loadApplicationId(cwd)).rejects.toThrow(/invalid `applicationId`/);
    });
});
