import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { callTool, createProject, isToolFailure } from "./app-session.js";
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

    it("documents a symbol by qualified name and by JSX element name", async () => {
        const qualified = await apiDocs({ symbol: "Adw.Toast" });
        const element = await apiDocs({ symbol: "AdwToast" });
        expect(qualified).toContain("Adw.Toast");
        expect(qualified).toContain("@gtkx/gi/adw");
        expect(element).toContain("AdwToast");
    });

    it("documents GTKX factory props and child constraints", async () => {
        expect(await apiDocs({ symbol: "GtkCallbackAction" })).toContain("### `callback`");
        expect(await apiDocs({ symbol: "GMenuItem" })).toContain("### `submenu`");
        expect(await apiDocs({ symbol: "GMenu" })).toContain("must create `GMenuItem` or a subtype");
    });

    it("replaces omitted native child properties with JSX children", async () => {
        const button = await apiDocs({ symbol: "GtkButton" });
        expect(button).toContain("### `children`");
        expect(button).not.toContain("### `child`");
    });

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

    it("lists the candidates behind an ambiguous name", async () => {
        const ambiguous = await callTool(
            state.server.client, "gtkx_get_api_docs", { symbol: "Orientation" }, REQUEST_OPTIONS,
        );
        expect(JSON.stringify(ambiguous)).toContain("Gtk.Orientation");
    });

    it("fails for a symbol the bindings do not declare", async () => {
        expect(await isToolFailure(
            state.server.client, "gtkx_get_api_docs", { symbol: "Gtk.Absent" }, REQUEST_OPTIONS,
        )).toBe(true);
    });
});
