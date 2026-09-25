import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runCli } from "./cli-project.js";
import {
    expectModules,
    fixtureLibrariesConfig,
    generatedModule,
    storePath,
    withProject,
} from "./codegen-helpers.js";

describe("gtkx codegen (the libraries a project binds without naming them)", () => {
    it("binds Adwaita and its transitive GTK dependency by default", () => {
        withProject("default-libraries", fixtureLibrariesConfig(undefined), (project) => {
            expect(runCli(project, ["codegen"]).status).toBe(0);
            expectModules(storePath(project, "gi"), [join("adw", "adw.js"), join("gtk", "gtk.js")]);
            expectModules(storePath(project, "jsx"), [join("adw", "adw.js"), join("gtk", "gtk.js")]);
        });
    });

    it("adds libraries the project names", () => {
        const source = fixtureLibrariesConfig(["Documented-1.0"]);

        withProject("default-libraries-extra", source, (project) => {
            expect(runCli(project, ["codegen", "--force"]).status).toBe(0);
            expect(existsSync(storePath(project, "gi", "documented"))).toBe(true);
        });
    });

    it("preserves illegal control codes in GIR constants", () => {
        const source = fixtureLibrariesConfig(["Malformed-1.0"]);

        withProject("control-code-library", source, (project) => {
            expect(runCli(project, ["codegen", "--force"]).status).toBe(0);
            const moduleSource = `import { EOT_STR, PUA_STR } from "@gtkx/gi/malformed";
process.stdout.write(JSON.stringify([EOT_STR, PUA_STR]));`;
            const output = execFileSync(
                process.execPath,
                ["--conditions=source", "--import=tsx", "--input-type=module", "--eval", moduleSource],
                { cwd: project.root, encoding: "utf8" },
            );

            expect(output).toBe(JSON.stringify([String.fromCodePoint(4), "&#xE004;"]));
        });
    });

    it("keeps the version of a mandatory namespace that the project pins", () => {
        const source = fixtureLibrariesConfig(["Adw-2"]);

        withProject("default-libraries-pinned", source, (project) => {
            expect(runCli(project, ["codegen", "--force"]).status).toBe(0);
            expect(generatedModule(project, "gi", "adw", "adw.d.ts")).toContain("export declare const Slab");
        });
    });
});
