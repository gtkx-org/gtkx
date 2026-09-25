import { existsSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCliProject, runCli, runCliOrThrow } from "./cli-project.js";
import { BROKEN_CASES, fixtureLibrariesConfig, storePath } from "./codegen-helpers.js";

describe("gtkx codegen (projects it cannot generate from)", () => {
    it.each(["native", "runtime"])("requires an installed @gtkx/%s package", (name) => {
        using project = createCliProject({
            prefix: "gtkx-cli-codegen-source-package-",
            config: fixtureLibrariesConfig(["Documented-1.0"]),
            omitPackages: [name],
            files: {
                [`packages/${name}/package.json`]: JSON.stringify({ name: `@gtkx/${name}`, version: "1.0.0" }),
            },
        });

        expect(runCli(project, ["codegen"]).status).not.toBe(0);
    });

    it.each(["@gtkx/react", "react"])("does not treat a source directory as installed %s", (name) => {
        using project = createCliProject({
            prefix: "gtkx-cli-codegen-source-react-",
            config: fixtureLibrariesConfig(["Documented-1.0"]),
            omitPackages: name === "@gtkx/react" ? ["react"] : [],
            files: { "packages/react/package.json": JSON.stringify({ name, version: "1.0.0" }) },
        });

        if (name === "react") {
            rmSync(join(project.nodeModules, "react"));
        }

        runCliOrThrow(project, ["codegen"]);
        const require = createRequire(join(project.root, "probe.js"));

        expect(() => require.resolve("@gtkx/gi/gtk")).not.toThrow();
        expect(() => require.resolve("@gtkx/jsx/gtk")).toThrow();
    });

    it.each(BROKEN_CASES)("fails over $title", ({ config: body }) => {
        using project = createCliProject({ prefix: "gtkx-cli-codegen-broken-", config: body });

        expect(runCli(project, ["codegen"]).status).not.toBe(0);
        expect(existsSync(storePath(project, "gi"))).toBe(false);
    });
});
