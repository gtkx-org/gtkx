import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isToolFailure } from "./app-session.js";
import {
    createConfiguredProject,
    PROPS_MODULE,
    referenceSession,
    REQUEST_OPTIONS,
    writePropsConfig,
} from "./reference-session.js";

const BASE_DECLARATION = "export interface SharedProps<T> { auditReplacement: T; }\n";
const INVALID_DECLARATION = 'import type * as Gtk from "@gtkx/gi/gtk";\n' +
    "export interface AliasProps { auditWidget: Gtk.Absent; }\n";
const INVALID_PROPS = [
    { title: "an uninstalled package", module: "@audit/not-installed", exported: "Props" },
    { title: "a missing export", module: PROPS_MODULE, exported: "MissingProps" },
    { title: "a value-only export", module: PROPS_MODULE, exported: "ValueProps" },
    { title: "a function export", module: PROPS_MODULE, exported: "FunctionProps" },
];

const { apiDocs, state } = referenceSession();

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

    it.each(INVALID_PROPS)("rejects configured props from $title", async ({ module, exported }) => {
        const project = createConfiguredProject();
        const request = { symbol: "GtkButton", projectRoot: project };

        try {
            expect(await apiDocs(request)).toContain("### `auditCaption`");
            writePropsConfig(project, exported, module);
            await expect.poll(
                () => isToolFailure(state.server.client, "gtkx_get_api_docs", request, REQUEST_OPTIONS),
            ).toBe(true);
            writePropsConfig(project);
            await expect.poll(() => apiDocs(request)).toContain("### `auditCaption`");
        } finally {
            rmSync(project, { recursive: true, force: true });
        }
    });

    it("rejects a configured prop with an absent GIR type", async () => {
        const project = createConfiguredProject();
        const request = { symbol: "GtkButton", projectRoot: project };

        try {
            expect(await apiDocs(request)).toContain("### `auditCaption`");
            writeFileSync(join(project, "node_modules", PROPS_MODULE, "index.d.ts"), INVALID_DECLARATION);
            await expect.poll(
                () => isToolFailure(state.server.client, "gtkx_get_api_docs", request, REQUEST_OPTIONS),
            ).toBe(true);
        } finally {
            rmSync(project, { recursive: true, force: true });
        }
    });
});
