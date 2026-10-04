import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createProject } from "./app-session.js";
import { referenceSession } from "./reference-session.js";

const { apiDocs } = referenceSession();

describe("gtkx_get_api_docs", () => {
    it("keeps configured property omissions scoped to their project", async () => {
        const project = createProject();
        writeFileSync(
            join(project, "gtkx.config.mjs"),
            'export default { applicationId: "org.gtkx.reference", ' +
            'elements: { config: { GtkButton: { omittedProps: ["label"] } } } };\n',
        );

        try {
            const configured = await apiDocs({ symbol: "GtkButton", projectRoot: project });
            expect(configured).not.toContain("### `label`");
            expect(configured).not.toContain("### `child`");
            expect(await apiDocs({ symbol: "GtkButton" })).toContain("### `label`");
        } finally {
            rmSync(project, { recursive: true, force: true });
        }
    });
});
