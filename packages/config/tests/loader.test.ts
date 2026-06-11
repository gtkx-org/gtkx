import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
    createGtkxConfigLoader,
    GtkxConfigNotFoundError,
    loadGtkxConfig,
    loadResolvedGtkxConfig,
    resolveGtkxConfig,
} from "../src/index.js";

let cwd: string;

const writeConfig = (contents: string): void => {
    writeFileSync(join(cwd, "gtkx.config.ts"), contents);
};

const defineConfigImport = (): string =>
    `import { defineConfig } from "${join(import.meta.dirname, "../src/config.ts")}";\n`;

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

describe("loadResolvedGtkxConfig", () => {
    beforeEach(() => {
        cwd = mkdtempSync(join(tmpdir(), "gtkx-resolved-config-"));
    });

    afterEach(() => {
        rmSync(cwd, { recursive: true, force: true });
    });

    it("resolves a declared config", async () => {
        writeConfig(`export default { libraries: ["Gtk-4.0"], applicationId: "org.gtk.Demo4" };\n`);
        const resolved = await loadResolvedGtkxConfig(cwd);
        expect(resolved.libraries).toEqual(["Gtk-4.0"]);
        expect(resolved.applicationId).toBe("org.gtk.Demo4");
        expect(resolved.reactCompiler).toEqual({ target: "19" });
    });

    it("returns the empty resolved config when no config file exists", async () => {
        await expect(loadResolvedGtkxConfig(cwd)).resolves.toEqual(resolveGtkxConfig({}));
    });

    it("propagates validation errors from defineConfig", async () => {
        writeConfig(`export default { applicationId: "not valid" };\n`);
        await expect(loadResolvedGtkxConfig(cwd)).rejects.toThrow(/invalid `applicationId`/);
    });
});

describe("createGtkxConfigLoader", () => {
    beforeEach(() => {
        cwd = mkdtempSync(join(tmpdir(), "gtkx-config-loader-"));
    });

    afterEach(() => {
        rmSync(cwd, { recursive: true, force: true });
    });

    it("loads the config once per root", async () => {
        writeConfig(`export default { applicationId: "org.gtk.Demo4" };\n`);
        const load = createGtkxConfigLoader();
        const first = await load(cwd);
        writeConfig(`export default { applicationId: "org.gtk.Changed" };\n`);
        const second = await load(cwd);
        expect(second).toBe(first);
        expect(second.applicationId).toBe("org.gtk.Demo4");
    });

    it("loads distinct roots independently", async () => {
        writeConfig(`export default { applicationId: "org.gtk.Demo4" };\n`);
        const other = mkdtempSync(join(tmpdir(), "gtkx-config-loader-"));
        try {
            const load = createGtkxConfigLoader();
            expect((await load(cwd)).applicationId).toBe("org.gtk.Demo4");
            expect((await load(other)).applicationId).toBeUndefined();
        } finally {
            rmSync(other, { recursive: true, force: true });
        }
    });
});
