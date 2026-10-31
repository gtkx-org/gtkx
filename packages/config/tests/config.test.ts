import { createServer } from "vite";
import { spawnSync } from "node:child_process";
import { mkdtempDisposableSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defineConfig, loadConfig, mergeConfig } from "../src/index.js";
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

    it("keeps the production application ID as the translation domain in every environment", () => {
        using directory = project();
        const script = `
            import assert from "node:assert/strict";
            import { mkdirSync, writeFileSync } from "node:fs";
            import { join } from "node:path";
            import { loadConfig } from ${JSON.stringify(new URL("../src/index.ts", import.meta.url).href)};
            const root = ${JSON.stringify(directory.path)};
            writeFileSync(join(root, "gtkx.config.ts"), 'export default { extends: "./base.json", applicationId: "org.gtkx.app", $development: { applicationId: "org.gtkx.app.Devel" } };');
            writeFileSync(join(root, "base.json"), JSON.stringify({
                codegen: false,
                $development: { codegen: true },
                $production: { applicationId: "org.gtkx.shared" },
            }));
            const summary = async (mode) => {
                const { config, translationDomain } = await loadConfig(root, { mode });
                return [config.applicationId, config.codegen, translationDomain];
            };
            assert.deepEqual(await summary("development"), ["org.gtkx.app.Devel", true, "org.gtkx.app"]);
            assert.deepEqual(await summary("production"), ["org.gtkx.app", false, "org.gtkx.app"]);
            assert.deepEqual(await summary("test"), ["org.gtkx.app", false, "org.gtkx.app"]);
        `;
        const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
            encoding: "utf8",
            timeout: 30_000,
        });
        expect(result.stderr).toBe("");
        expect(result.status).toBe(0);
    });

    it("loads named ESM exports and configuration metadata", () => {
        using directory = project();
        writeFileSync(
            join(directory.path, "gtkx.config.mts"),
            'export const applicationId = "org.gtkx.named"; export const codegen = false; export const $meta = { name: "Named configuration" };',
        );
        const script = `
            import assert from "node:assert/strict";
            import { loadConfig } from ${JSON.stringify(new URL("../src/index.ts", import.meta.url).href)};
            const loaded = await loadConfig(${JSON.stringify(directory.path)});
            assert.equal(loaded.config.applicationId, "org.gtkx.named");
            assert.equal(loaded.config.codegen, false);
        `;
        const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
            encoding: "utf8",
            timeout: 30_000,
        });
        expect(result.status).toBe(0);
    });

    it("reloads native ESM configuration and recovers after invalid or missing imports", () => {
        using directory = project();
        const script = `
            import assert from "node:assert/strict";
            import { mkdirSync, writeFileSync } from "node:fs";
            import { join } from "node:path";
            import { createConfigReloader } from ${JSON.stringify(new URL("../src/internal.ts", import.meta.url).href)};
            const root = ${JSON.stringify(directory.path)};
            const write = (path, content) => writeFileSync(join(root, path), content);
            write("package.json", JSON.stringify({
                type: "module",
                imports: { "#value": "./value.ts", "#created": "./mapped/settings.mts" },
            }));
            write("gtkx.config.ts", 'import base from "./base.js"; export default { ...base, codegen: false };');
            write("base.ts", 'import applicationId from "#value"; export default { applicationId };');
            write("value.ts", 'export default "org.gtkx.first";');
            const reloader = await createConfigReloader(root);
            assert.equal((await reloader.reload()).config.applicationId, "org.gtkx.first");
            write("value.ts", 'export default "invalid";');
            await assert.rejects(reloader.reload());
            write("value.ts", 'export default "org.gtkx.second";');
            assert.equal((await reloader.reload()).config.applicationId, "org.gtkx.second");
            write("value.ts", 'export default {');
            await assert.rejects(reloader.reload());
            write("value.ts", 'export default "org.gtkx.repaired";');
            assert.equal((await reloader.reload()).config.applicationId, "org.gtkx.repaired");
            for (const [source, directory, extension] of [
                ["./typescript/settings.js", "typescript", "ts"],
                ["./module/settings.mjs", "module", "mts"],
                ["#created", "mapped", "mts"],
            ]) {
                write("base.ts", 'export { default } from "' + source + '";');
                await assert.rejects(reloader.reload());
                mkdirSync(join(root, directory));
                const applicationId = "org.gtkx." + directory;
                write(directory + "/settings." + extension, 'export default { applicationId: "' + applicationId + '" };');
                assert.equal((await reloader.reload()).config.applicationId, applicationId);
            }
            write("gtkx.config.ts", 'export default { extends: ' + JSON.stringify(join(root, "layers/base.jsonc")) + ', codegen: false };');
            await assert.rejects(reloader.reload());
            mkdirSync(join(root, "layers"));
            write("layers/base.jsonc", '{ "applicationId": "org.gtkx.layer" }');
            assert.equal((await reloader.reload()).config.applicationId, "org.gtkx.layer");
            write("layers/base.jsonc", '{');
            await assert.rejects(reloader.reload());
            write("layers/base.jsonc", '{ "applicationId": "org.gtkx.layerrepaired" }');
            assert.equal((await reloader.reload()).config.applicationId, "org.gtkx.layerrepaired");
            write("gtkx.config.ts", 'export default { extends: "./directory", codegen: false };');
            await assert.rejects(reloader.reload());
            mkdirSync(join(root, "directory"));
            write("directory/gtkx.config.ts", 'export default { applicationId: "org.gtkx.directory" };');
            assert.equal((await reloader.reload()).config.applicationId, "org.gtkx.directory");
        `;
        const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
            encoding: "utf8",
            timeout: 30_000,
        });
        expect(result.status).toBe(0);
    });

    it("rejects CommonJS configuration entries while accepting linked external dependencies", () => {
        using directory = project();
        using external = project();
        const script = `
            import assert from "node:assert/strict";
            import { mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
            import { join } from "node:path";
            import { loadConfig } from ${JSON.stringify(new URL("../src/index.ts", import.meta.url).href)};
            const root = ${JSON.stringify(directory.path)};
            const dependency = ${JSON.stringify(external.path)};
            const write = (path, content) => writeFileSync(join(root, path), content);
            write("package.json", JSON.stringify({ type: "module" }));
            for (const extension of ["cjs", "cts"]) {
                const name = "gtkx.config." + extension;
                write(name, 'module.exports = { applicationId: "org.gtkx.commonjs", codegen: false };');
                await assert.rejects(loadConfig(root));
                await assert.rejects(loadConfig(root, { configFile: name }));
                rmSync(join(root, name));
            }
            mkdirSync(join(root, "node_modules"));
            writeFileSync(join(dependency, "package.json"), JSON.stringify({ name: "external-settings", main: "index.cjs" }));
            writeFileSync(join(dependency, "index.cjs"), 'module.exports = "org.gtkx.external";');
            symlinkSync(dependency, join(root, "node_modules/external-settings"), "dir");
            write("gtkx.config.ts", 'import applicationId from "external-settings"; export default { applicationId, codegen: false };');
            assert.equal((await loadConfig(root)).config.applicationId, "org.gtkx.external");
        `;
        const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
            encoding: "utf8",
            timeout: 30_000,
        });
        expect(result.status).toBe(0);
    });

    it("reports graduated flags once per project and lets supervisors own their warnings", () => {
        using first = project();
        using second = project();
        for (const directory of [first, second]) {
            writeFileSync(
                join(directory.path, "gtkx.config.ts"),
                'export default { applicationId: "org.gtkx.test", codegen: false, future: { v2TreeShaking: true } };',
            );
        }
        const script = `
            import { loadConfig } from ${JSON.stringify(new URL("../src/index.ts", import.meta.url).href)};
            const first = ${JSON.stringify(first.path)};
            const second = ${JSON.stringify(second.path)};
            await loadConfig(first, { shouldWarnGraduatedFuture: false });
            await loadConfig(first);
            await loadConfig(first);
            await loadConfig(second);
            await loadConfig(second);
        `;
        const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
            encoding: "utf8",
            timeout: 30_000,
        });
        expect(result.status).toBe(0);
        expect(result.stderr.match(/ignores graduated future flags/g)).toHaveLength(2);
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
