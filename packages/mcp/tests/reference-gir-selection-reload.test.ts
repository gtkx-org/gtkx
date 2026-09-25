import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createProject } from "./app-session.js";
import { referenceSession } from "./reference-session.js";

const { apiDocs } = referenceSession();

describe("reference configuration updates", () => {
    it("selects a GIR that appears earlier in the configured search path", async () => {
        const project = createProject();
        const earlier = join(project, "earlier");
        const later = join(project, "later");
        mkdirSync(earlier);
        mkdirSync(later);
        const original = readFileSync(
            new URL("../../cli/tests/fixtures/gir/Documented-1.0.gir", import.meta.url),
            "utf8",
        );
        writeFileSync(join(later, "Documented-1.0.gir"), original);
        const config = {
            applicationId: "org.gtkx.reference",
            libraries: ["Documented-1.0"],
            girPath: [earlier, later],
        };
        writeFileSync(join(project, "gtkx.config.mjs"), `export default ${JSON.stringify(config)};\n`);

        try {
            const docs = (): Promise<string> => apiDocs({ symbol: "Documented.Note", projectRoot: project });
            expect(await docs()).toContain("Holds a short piece of text the user jotted down.");
            const selected = join(earlier, "Documented-1.0.gir");
            writeFileSync(
                selected,
                original.replace(
                    "Holds a short piece of text the user jotted down.",
                    "A higher priority reference was selected.",
                ),
            );

            await expect.poll(docs).toContain("A higher priority reference was selected.");
            rmSync(selected);
            await expect.poll(docs)
                .toContain("Holds a short piece of text the user jotted down.");
        } finally {
            rmSync(project, { recursive: true, force: true });
        }
    });
});
