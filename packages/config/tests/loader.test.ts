import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig } from "../src/index.js";
import { createConfigLoader } from "../src/internal.js";

type TempRoot = { path: string };

const installTempRoot = (prefix: string): TempRoot => {
    const root: TempRoot = { path: "" };

    beforeEach(() => {
        root.path = mkdtempSync(join(tmpdir(), prefix));
    });

    afterEach(() => {
        rmSync(root.path, { recursive: true, force: true });
    });

    return root;
};

const writeConfigIn = (root: TempRoot, contents: string): void => {
    writeFileSync(join(root.path, "gtkx.config.ts"), contents);
};

const defineConfigImport = (): string =>
    `import { defineConfig } from "${join(import.meta.dirname, "../src/config.ts")}";\n`;

describe("loadConfig — accepted config shapes", () => {
    const root = installTempRoot("gtkx-config-");

    it("loads a gtkx.config.ts file using defineConfig", async () => {
        writeConfigIn(
            root,
            `${defineConfigImport()}export default defineConfig({ applicationId: "org.gtk.Demo4", ` +
            'libraries: ["Gtk-4.0"] });\n',
        );

        const result = await loadConfig(root.path);
        expect(result.config.libraries).toEqual(["Gtk-4.0"]);
        expect(result.configFile?.endsWith("gtkx.config.ts")).toBe(true);
        expect(result.root).toBe(root.path);
    });

    it("loads a config exported as a plain object and validates it", async () => {
        writeConfigIn(
            root,
            "export default { applicationId: 'org.gtk.Demo4', libraries: ['Gtk-4.0', 'Adw-1'], " +
            "girPath: ['/usr/share/gir-1.0'] };\n",
        );

        const result = await loadConfig(root.path);
        expect(result.config.libraries).toEqual(["Gtk-4.0", "Adw-1"]);
        expect(result.config.girPath).toEqual(["/usr/share/gir-1.0"]);
    });

    it("accepts a config that omits libraries", async () => {
        writeConfigIn(root, "export default { applicationId: \"org.gtk.Demo4\" };\n");
        const result = await loadConfig(root.path);
        expect(result.config.libraries).toBeUndefined();
        expect(result.configFile?.endsWith("gtkx.config.ts")).toBe(true);
    });

    it('accepts the "*" wildcard for libraries', async () => {
        writeConfigIn(root, "export default { applicationId: \"org.gtk.Demo4\", libraries: \"*\" };\n");
        const result = await loadConfig(root.path);
        expect(result.config.libraries).toBe("*");
    });

    it("returns an undefined configFile when no config file exists", async () => {
        const result = await loadConfig(root.path);
        expect(result.configFile).toBeUndefined();
        expect(result.config).toEqual({});
    });
});

describe("loadConfig — validation and mode layering", () => {
    const root = installTempRoot("gtkx-config-");

    it("propagates validation errors from the loader", async () => {
        writeConfigIn(root, "export default { libraries: [] };\n");

        await expect(loadConfig(root.path)).rejects.toThrow(
            '`libraries` must be "*", a non-empty string array, or omitted',
        );
    });

    it("rejects an invalid library identifier", async () => {
        writeConfigIn(root, "export default { libraries: ['InvalidLib'] };\n");
        await expect(loadConfig(root.path)).rejects.toThrow(/invalid library identifier/);
    });

    it("applies a c12 $production layer when the mode is production", async () => {
        writeConfigIn(
            root,
            "export default { applicationId: \"org.gtk.Base\", $production: { applicationId: \"org.gtk.Prod\" } };\n",
        );

        const result = await loadConfig(root.path, { mode: "production" });
        expect(result.config.applicationId).toBe("org.gtk.Prod");
    });

    it("passes the mode to a function-form config through the c12 context", async () => {
        writeConfigIn(
            root,
            'export default (env) => ({ applicationId: env.mode === "production" ? "org.gtk.Prod" : ' +
            '"org.gtk.Dev" });\n',
        );

        const result = await loadConfig(root.path, { mode: "production" });
        expect(result.config.applicationId).toBe("org.gtk.Prod");
    });
});

describe("createConfigLoader", () => {
    const root = installTempRoot("gtkx-config-loader-");

    it("resolves a declared config", async () => {
        writeConfigIn(root, "export default { libraries: [\"Gtk-4.0\"], applicationId: \"org.gtk.Demo4\" };\n");
        const resolved = await createConfigLoader()(root.path);
        expect(resolved.applicationId).toBe("org.gtk.Demo4");
        expect(resolved.reactCompiler).toEqual({ target: "19" });
    });

    it("rejects when no config file exists because applicationId is required", async () => {
        await expect(createConfigLoader()(root.path)).rejects.toThrow(/invalid `applicationId`/);
    });

    it("propagates validation errors from the loader", async () => {
        writeConfigIn(root, "export default { applicationId: \"not valid\" };\n");
        await expect(createConfigLoader()(root.path)).rejects.toThrow(/invalid `applicationId`/);
    });

    it("loads the config once per root", async () => {
        writeConfigIn(root, "export default { applicationId: \"org.gtk.Demo4\" };\n");
        const load = createConfigLoader();
        const first = await load(root.path);
        writeConfigIn(root, "export default { applicationId: \"org.gtk.Changed\" };\n");
        const second = await load(root.path);
        expect(second).toBe(first);
        expect(second.applicationId).toBe("org.gtk.Demo4");
    });

    it("loads distinct roots independently", async () => {
        writeConfigIn(root, "export default { applicationId: \"org.gtk.Demo4\" };\n");
        const other = mkdtempSync(join(tmpdir(), "gtkx-config-loader-"));
        writeFileSync(join(other, "gtkx.config.ts"), "export default { applicationId: \"org.gtk.Other\" };\n");

        try {
            const load = createConfigLoader();
            const cwdConfig = await load(root.path);
            const otherConfig = await load(other);
            expect(cwdConfig.applicationId).toBe("org.gtk.Demo4");
            expect(otherConfig.applicationId).toBe("org.gtk.Other");
        } finally {
            rmSync(other, { recursive: true, force: true });
        }
    });
});
