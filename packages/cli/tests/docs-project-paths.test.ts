import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { cliEnvironment, createCliProject } from "./cli-project.js";
import { config, DOCUMENTED_PAGE, FIXTURE_GIR, OUT_DIR, readPage } from "./docs-fixture.js";

const CLI_ENTRY = fileURLToPath(new URL("../dist/cli.js", import.meta.url));

describe("project-relative GIR paths", () => {
    it("uses the requested project's GIR for docs and codegen from another working directory", () => {
        const source = readFileSync(join(FIXTURE_GIR, "Documented-1.0.gir"), "utf8");
        const original = "Holds a short piece of text the user jotted down.";
        const requested = "A note from the requested project.";
        using project = createCliProject({
            prefix: "gtkx-cli-gir-requested-",
            config: config(', girPath: ["./gir"], agents: { reference: true }', ["Documented-1.0"]),
            files: { "gir/Documented-1.0.gir": source.replace(original, () => requested) },
        });
        using launcher = createCliProject({
            prefix: "gtkx-cli-gir-launcher-",
            files: {
                "gir/Documented-1.0.gir": source.replace(original, "A note from the launching project."),
            },
        });

        for (const args of [["docs", "--out", OUT_DIR], ["codegen"]]) {
            const result = spawnSync(process.execPath, [CLI_ENTRY, ...args, "--cwd", project.root], {
                cwd: launcher.root,
                env: cliEnvironment(project),
                encoding: "utf8",
                timeout: 300_000,
            });
            expect(result.status).toBe(0);
        }

        expect(readPage(project, DOCUMENTED_PAGE)).toContain(requested);
        expect(readFileSync(join(project.root, ".gtkx/reference", DOCUMENTED_PAGE), "utf8")).toContain(requested);
    });
});
