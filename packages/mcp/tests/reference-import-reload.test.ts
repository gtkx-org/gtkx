import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createProject } from "./app-session.js";
import { referenceSession } from "./reference-session.js";

const { listApi } = referenceSession();

describe("reference configuration updates", () => {
    it("reloads imported configuration when the selected libraries change", async () => {
        const project = createProject();
        const dependency = join(project, "libraries.mjs");
        writeFileSync(dependency, 'export default ["GtkSource-5"];\n');
        writeFileSync(
            join(project, "gtkx.config.mjs"),
            'import libraries from "./libraries.mjs";\n' +
            'export default { applicationId: "org.gtkx.reference", libraries };\n',
        );

        try {
            expect(await listApi({ projectRoot: project })).toContain("GtkSource");
            writeFileSync(dependency, "export default undefined;\n");

            await expect.poll(() => listApi({ projectRoot: project }))
                .not.toContain("GtkSource");
        } finally {
            rmSync(project, { recursive: true, force: true });
        }
    });
});
