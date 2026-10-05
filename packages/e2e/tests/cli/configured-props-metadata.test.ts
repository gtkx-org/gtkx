import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCliProject, runCliOrThrow } from "./cli-project.js";
import {
    BOX_PAGE,
    installConfiguredProps,
    installHoistedToolchain,
    OUTPUT,
    readButton,
    runDocs,
    typecheckMetadataConsumer,
    writeMetadataConfig,
    writePropsConfig,
} from "./configured-props-fixture.js";

describe("configured element prop reference", () => {
    it("preserves prop metadata and accepted child types across generated consumer surfaces", () => {
        using project = createCliProject({ prefix: "gtkx-props-metadata-" });
        installConfiguredProps(project.root);
        writeMetadataConfig(project.root);
        runCliOrThrow(project, ["codegen"]);
        runDocs(project);

        for (const directory of [OUTPUT, ".gtkx/reference"]) {
            const page = readFileSync(join(project.root, directory, BOX_PAGE), "utf8");
            expect(page).toContain("Each GTKX element rendered into it must create");
            expect(page).toContain("[GtkLabel]");
        }

        typecheckMetadataConsumer(project);
    });

    it("documents configured props when the installed toolchain has hoisted dependencies", () => {
        using project = createCliProject({ prefix: "gtkx-props-hoisted-" });
        installConfiguredProps(project.root);
        writePropsConfig(project.root);
        installHoistedToolchain(project);
        const result = spawnSync(process.execPath, [
            join(project.nodeModules, "@gtkx/cli/bin/gtkx.js"), "docs", "--out", OUTPUT,
        ], { cwd: project.root, encoding: "utf8", timeout: 120_000 });

        expect(result.status).toBe(0);
        expect(readButton(project.root)).toContain("### `auditCaption`");
        expect(readButton(project.root)).toContain("Gtk.Widget | null");
    });
});
