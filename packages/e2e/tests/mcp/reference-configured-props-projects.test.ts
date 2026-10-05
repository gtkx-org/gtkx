import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
    createConfiguredProject,
    referenceSession,
} from "./reference-session.js";

const BASE_DECLARATION = "export interface SharedProps<T> { auditReplacement: T; }\n";

const { apiDocs } = referenceSession();

describe("reference configuration updates", () => {
    it("refreshes configured declarations and isolates installed prop packages by project", async () => {
        const project = createConfiguredProject();
        const other = createConfiguredProject();
        const baseFile = join(project, "node_modules/@audit/element-base/index.d.ts");
        writeFileSync(
            join(other, "node_modules/@audit/element-base/index.d.ts"),
            "export interface SharedProps<T> { auditOther: T; }\n",
        );

        try {
            const docs = (projectRoot: string): Promise<string> => apiDocs({ symbol: "GtkButton", projectRoot });
            expect(await docs(project)).toContain("### `auditCaption`");
            expect(await docs(other)).toContain("### `auditOther`");
            expect(await docs(project)).not.toContain("### `auditOther`");
            writeFileSync(baseFile, BASE_DECLARATION);

            await expect.poll(() => docs(project)).toContain("### `auditReplacement`");
            expect(await docs(project)).not.toContain("### `auditCaption`");
            expect(await docs(other)).toContain("### `auditOther`");
        } finally {
            rmSync(project, { recursive: true, force: true });
            rmSync(other, { recursive: true, force: true });
        }
    });
});
