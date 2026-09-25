import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createProject } from "./app-session.js";
import { referenceSession } from "./reference-session.js";

const { apiDocs, state } = referenceSession();

describe("reference configuration updates", () => {
    it("resolves relative GIR paths from the requested project instead of the server's working directory", async () => {
        const project = createProject();
        const directory = "relative-gir";
        const requestedGir = join(project, directory);
        const launchGir = join(state.project, directory);
        mkdirSync(requestedGir);
        mkdirSync(launchGir);
        const source = readFileSync(
            new URL("../../cli/tests/fixtures/gir/Documented-1.0.gir", import.meta.url),
            "utf8",
        );
        const original = "Holds a short piece of text the user jotted down.";
        const requested = "A note from the requested project.";
        writeFileSync(join(requestedGir, "Documented-1.0.gir"), source.replace(original, () => requested));
        writeFileSync(
            join(launchGir, "Documented-1.0.gir"),
            source.replace(original, "A note from the server's working directory."),
        );
        const config = {
            applicationId: "org.gtkx.reference",
            libraries: ["Documented-1.0"],
            girPath: [`./${directory}`],
        };
        writeFileSync(join(project, "gtkx.config.mjs"), `export default ${JSON.stringify(config)};\n`);

        try {
            expect(await apiDocs({ symbol: "Documented.Note", projectRoot: project })).toContain(requested);
        } finally {
            rmSync(project, { recursive: true, force: true });
            rmSync(launchGir, { recursive: true, force: true });
        }
    });
});
