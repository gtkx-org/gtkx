import { runCommand } from "citty";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempDisposableSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "vite";
import { describe, expect, it } from "vitest";
import { createCommand } from "../dist/command.js";
import { gtkxVitePlugins } from "../dist/vite-plugins/index.js";
import { createProject } from "./project.js";

describe("ESM applications", () => {
    it.each(["installed", "linked"])("runs ESM apps with %s CommonJS dependencies", async (installation) => {
        using project = createProject();
        using output = mkdtempDisposableSync(join(tmpdir(), "gtkx-esm-output-"));
        using dependency = mkdtempDisposableSync(join(tmpdir(), "gtkx-esm-dependency-"));
        if (installation === "linked") {
            symlinkSync(dependency.path, join(project.root, "node_modules/legacy-dependency"), "dir");
        }
        project.write(
            "node_modules/legacy-dependency/package.json",
            JSON.stringify({ name: "legacy-dependency", version: "1.0.0", main: "index.cjs", license: "MIT" }),
        );
        project.write("node_modules/legacy-dependency/index.cjs", 'module.exports = { message: "legacy value" };');
        project.write(
            "src/index.tsx",
            'import legacy from "legacy-dependency"; const view = <>{legacy.message}</>; export const value = view.props.children; console.log(value);',
        );
        project.write(
            "vite.config.ts",
            'export default { build: { rolldownOptions: { output: { format: "cjs" } } } };',
        );

        for (const phase of ["cold", "warm"]) {
            await runCommand(createCommand(), { rawArgs: ["build", "--cwd", project.root, "src/index.tsx"] });
            const bundle = join(output.path, `${phase}.mjs`);
            copyFileSync(join(project.root, "dist/bundle.mjs"), bundle);
            expect(execFileSync(process.execPath, [bundle], { encoding: "utf8", timeout: 30_000 }).trim()).toBe(
                "legacy value",
            );
        }
        const entryPath = join(project.root, "src/index.tsx");
        const server = await createServer({
            configFile: false,
            root: project.root,
            plugins: gtkxVitePlugins({ entryPath, mode: "development" }),
            ssr: { external: true },
            server: { middlewareMode: true, ws: false },
            appType: "custom",
        });
        try {
            const application = await server.ssrLoadModule(entryPath);
            expect(application.value).toBe("legacy value");
        } finally {
            await server.close();
        }
    });

    it.each(["build", "dev"])("rejects CommonJS entries before %s starts", async (command) => {
        using project = createProject();
        project.write("src/index.cjs", 'module.exports = "local value";');
        await expect(
            runCommand(createCommand(), { rawArgs: [command, "--cwd", project.root, "src/index.cjs"] }),
        ).rejects.toThrow();
    });

    it.each(["main.cjs", "main.cts"])("rejects CommonJS Storybook configuration in %s", async (filename) => {
        using project = createProject();
        project.write(filename, "module.exports = { stories: [] };");
        await expect(
            runCommand(createCommand(), {
                rawArgs: ["storybook", "--cwd", project.root, "--storybook-config", filename],
            }),
        ).rejects.toThrow();
    });
});
