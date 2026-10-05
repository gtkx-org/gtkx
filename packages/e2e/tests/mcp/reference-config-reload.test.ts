import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createProject } from "./app-session.js";
import { referenceSession } from "./reference-session.js";

const { apiDocs } = referenceSession();

describe("reference configuration updates", () => {
    it("reloads when a higher-priority configuration appears or is removed", async () => {
        const project = createProject();
        writeFileSync(
            join(project, "gtkx.config.mjs"),
            'export default { applicationId: "org.gtkx.reference" };\n',
        );

        try {
            const docs = (): Promise<string> => apiDocs({ symbol: "GtkButton", projectRoot: project });
            expect(await docs()).toContain("### `label`");
            const selected = join(project, "gtkx.config.ts");
            writeFileSync(
                selected,
                'export default { applicationId: "org.gtkx.reference", ' +
                'elements: { config: { GtkButton: { omittedProps: ["label"] } } } };\n',
            );

            await expect.poll(docs).not.toContain("### `label`");
            rmSync(selected);
            await expect.poll(docs).toContain("### `label`");
        } finally {
            rmSync(project, { recursive: true, force: true });
        }
    });
});
