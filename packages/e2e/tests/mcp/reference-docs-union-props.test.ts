import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isToolFailure } from "./app-session.js";
import {
    createConfiguredProject,
    referenceSession,
    REQUEST_OPTIONS,
    writePropsConfig,
} from "./reference-session.js";

const { apiDocs, state } = referenceSession();

describe("gtkx_get_api_docs", () => {
    it("documents union branches and index overlaps across projects, edits, and invalid declarations", async () => {
        const project = createConfiguredProject();
        const other = createConfiguredProject();
        const moduleName = "@audit/union-props";
        writePropsConfig(project, "UnionProps", moduleName);
        writePropsConfig(other, "UnionProps", moduleName);
        const declaration = join(project, "node_modules", moduleName, "index.d.ts");
        const otherDeclaration = join(other, "node_modules", moduleName, "index.d.ts");
        const source = readFileSync(declaration, "utf8");
        writeFileSync(otherDeclaration, source.replaceAll("auditFlag", "auditOther"));
        const docs = (): Promise<string> => apiDocs({ symbol: "GtkButton", projectRoot: project });

        try {
            const initial = await docs();

            for (const name of ["auditCount", "auditFlag", "auditLabel"]) {
                expect(initial).toContain("### `" + name + "`");
            }

            expect(initial).toContain("### `auditDynamic`\n\n`string | number`");
            expect(initial).toContain("### `audit-label-detail-${string}`\n\n`number | boolean`");
            expect(await apiDocs({ symbol: "GtkButton", projectRoot: other })).toContain("### `auditOther`");
            expect(await docs()).toContain("### `auditFlag`");
            writeFileSync(declaration, source.replaceAll("auditFlag", "auditUpdated"));
            await expect.poll(docs).toContain("### `auditUpdated`");
            writeFileSync(declaration, source.replace("auditFlag: boolean", "auditFlag: Gtk.Absent"));
            await expect.poll(() => isToolFailure(state.server.client, "gtkx_get_api_docs", {
                symbol: "GtkButton", projectRoot: project,
            }, REQUEST_OPTIONS)).toBe(true);
            writeFileSync(declaration, source);
            await expect.poll(docs).toContain("### `auditFlag`");
        } finally {
            rmSync(project, { recursive: true, force: true });
            rmSync(other, { recursive: true, force: true });
        }
    });
});
