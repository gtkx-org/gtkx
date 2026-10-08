import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { createCliProject, runCliOrThrow } from "./cli-project.js";
import { fixtureLibrariesConfig, linkPath } from "./codegen-helpers.js";

it("generates paired stores beside local React when runtime is hoisted above them", () => {
    using parent = createCliProject({
        prefix: "gtkx-cli-runtime-store-",
        config: fixtureLibrariesConfig(undefined),
        omitPackages: ["runtime"],
    });
    const root = join(parent.root, "application");
    const project = { root, nodeModules: join(root, "node_modules"), tmpDir: parent.tmpDir };
    mkdirSync(root);

    for (const name of ["package.json", "gtkx.config.ts", "node_modules"]) {
        cpSync(join(parent.root, name), join(root, name), { recursive: true, verbatimSymlinks: true });
    }

    const runtimeSource = fileURLToPath(new URL("../../../runtime/", import.meta.url));
    const runtime = join(parent.nodeModules, "@gtkx", "runtime");
    mkdirSync(runtime);

    for (const name of ["dist", "package.json"]) {
        cpSync(join(runtimeSource, name), join(runtime, name), { recursive: true });
    }

    runCliOrThrow(project, ["codegen"]);
    const fromReact = createRequire(join(project.nodeModules, "@gtkx", "react", "package.json"));

    for (const store of ["gi", "jsx"]) {
        expect(realpathSync(fromReact.resolve(`@gtkx/${store}/gtk`))).toBe(
            realpathSync(linkPath(project, store, "gtk", "index.js")),
        );
    }

    const fromRuntime = createRequire(join(runtime, "package.json"));
    expect(() => fromRuntime.resolve("@gtkx/gi/glib")).toThrow();
    const result = spawnSync(
        process.execPath,
        [
            "--input-type=module",
            "--eval",
            `
        import assert from "node:assert/strict";
        import { getMonotonicTime } from "@gtkx/gi/glib";
        import { quit, TYPE_BOOLEAN, typeFromName } from "@gtkx/runtime";
        assert.equal(typeFromName("gboolean"), TYPE_BOOLEAN);
        assert.ok(getMonotonicTime() > 0);
        quit();
    `,
        ],
        { cwd: project.root, encoding: "utf8", timeout: 60_000 },
    );

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
});
