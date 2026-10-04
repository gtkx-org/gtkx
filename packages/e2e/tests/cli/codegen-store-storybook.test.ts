import { cpSync, mkdirSync, realpathSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type CliProject, createCliProject, runCli } from "./cli-project.js";
import { fixtureLibrariesConfig, linkPath } from "./codegen-helpers.js";

const nestedProject = (parent: CliProject): CliProject => {
    const root = join(parent.root, "application");
    const tmpDir = join(parent.tmpDir, "application");
    mkdirSync(root);
    mkdirSync(tmpDir);

    for (const name of ["package.json", "gtkx.config.ts"]) {
        cpSync(join(parent.root, name), join(root, name));
    }

    return { root, nodeModules: join(root, "node_modules"), tmpDir };
};

const installNestedPackages = (parent: CliProject, project: CliProject): void => {
    cpSync(parent.nodeModules, project.nodeModules, { recursive: true, verbatimSymlinks: true });
};

describe("gtkx codegen (Storybook dependency placement)", () => {
    it.each(["local", "ancestor"])("keeps generated stores reachable from a %s Storybook installation", (placement) => {
        using parent = createCliProject({
            prefix: "gtkx-cli-storybook-store-",
            config: fixtureLibrariesConfig(undefined),
        });
        const project = nestedProject(parent);

        if (placement === "local") {
            installNestedPackages(parent, project);
        }

        expect(runCli(project, ["codegen"]).status).toBe(0);
        const installed = placement === "local" ? project : parent;
        const require = createRequire(join(installed.nodeModules, "@gtkx", "storybook", "package.json"));

        expect(realpathSync(require.resolve("@gtkx/gi/gtk")))
            .toBe(realpathSync(linkPath(installed, "gi", "gtk", "index.js")));
        expect(realpathSync(require.resolve("@gtkx/jsx/gtk")))
            .toBe(realpathSync(linkPath(installed, "jsx", "gtk", "index.js")));
    });

    it("rejects Storybook above the generated store's dependency directory", () => {
        using parent = createCliProject({
            prefix: "gtkx-cli-storybook-split-store-",
            config: fixtureLibrariesConfig(undefined),
        });
        const project = nestedProject(parent);
        installNestedPackages(parent, project);
        rmSync(join(project.nodeModules, "@gtkx", "storybook"));

        expect(runCli(project, ["codegen"]).status).not.toBe(0);
    });
});
