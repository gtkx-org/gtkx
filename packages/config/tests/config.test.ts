import { createServer } from "vite";
import { mkdtempDisposableSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defineConfig, loadConfig, mergeConfig } from "../src/index.js";
import { createConfigReloader } from "../src/internal.js";
import createConfigPlugin from "../src/vite-plugin.js";

const project = () => mkdtempDisposableSync(join(tmpdir(), "gtkx-config-test-"));
const config = (applicationId = "org.gtkx.test") =>
    `export default { applicationId: "${applicationId}", codegen: false };`;

describe("project configuration", () => {
    it.each(["ts", "mjs", "json", "jsonc", "yaml"])("loads a %s project configuration", async (extension) => {
        using directory = project();
        const contents =
            extension === "yaml"
                ? "applicationId: org.gtkx.test\ncodegen: false\n"
                : extension.startsWith("json")
                  ? '{"applicationId":"org.gtkx.test","codegen":false}'
                  : config();
        writeFileSync(join(directory.path, `gtkx.config.${extension}`), contents);
        expect(await loadConfig(directory.path)).toMatchObject({
            root: directory.path,
            config: { applicationId: "org.gtkx.test", codegen: false },
        });
    });

    it("merges a defined configuration and applies an explicitly selected environment", async () => {
        using directory = project();
        const merged = mergeConfig(defineConfig({ applicationId: "org.gtkx.base" }), {
            applicationId: "org.gtkx.base",
            codegen: false,
        });
        expect(merged).toMatchObject({ applicationId: "org.gtkx.base", codegen: false });
        mkdirSync(join(directory.path, "config"));
        writeFileSync(join(directory.path, "gtkx.config.ts"), config("org.gtkx.default"));
        writeFileSync(
            join(directory.path, "config/custom.ts"),
            `export default {
            applicationId: "org.gtkx.selected", codegen: false,
            $development: { applicationId: "org.gtkx.development" },
        };`,
        );
        const selected = await loadConfig(directory.path, { configFile: "config/custom.ts", mode: "development" });
        expect(selected.config.applicationId).toBe("org.gtkx.development");
        expect((await loadConfig(directory.path)).config.applicationId).toBe("org.gtkx.default");
    });

    it("reloads imported configuration and recovers after an invalid edit", async () => {
        using directory = project();
        writeFileSync(
            join(directory.path, "gtkx.config.ts"),
            'import applicationId from "./value.ts"; export default { applicationId, codegen: false };',
        );
        const dependency = join(directory.path, "value.ts");
        writeFileSync(dependency, 'export default "org.gtkx.first";');
        const reloader = await createConfigReloader(directory.path);
        expect((await reloader.reload()).config.applicationId).toBe("org.gtkx.first");
        expect(reloader.resolvePaths()).toContain(dependency);
        writeFileSync(dependency, 'export default "invalid";');
        await expect(reloader.reload()).rejects.toThrow();
        writeFileSync(dependency, 'export default "org.gtkx.second";');
        expect((await reloader.reload()).config.applicationId).toBe("org.gtkx.second");
    });

    it("rejects missing, invalid and out-of-project configurations", async () => {
        using directory = project();
        await expect(loadConfig(directory.path)).rejects.toThrow();
        writeFileSync(join(directory.path, "gtkx.config.ts"), config("invalid"));
        await expect(loadConfig(directory.path)).rejects.toThrow();
        await expect(loadConfig(directory.path, { configFile: "../elsewhere.ts" })).rejects.toThrow("inside");
    });

    it("serves the resolved project configuration through Vite", async () => {
        using directory = project();
        writeFileSync(join(directory.path, "gtkx.config.ts"), config());
        const server = await createServer({
            configFile: false,
            root: directory.path,
            plugins: [createConfigPlugin({ name: "config-integration" })],
            server: { middlewareMode: true },
            appType: "custom",
        });
        try {
            const result = await server.ssrLoadModule("virtual:gtkx-config");
            expect(result).toMatchObject({ applicationId: "org.gtkx.test" });
        } finally {
            await server.close();
        }
    });
});
