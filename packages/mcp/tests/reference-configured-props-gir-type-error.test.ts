import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isToolFailure } from "./app-session.js";
import {
    createConfiguredProject,
    PROPS_MODULE,
    referenceSession,
    REQUEST_OPTIONS,
} from "./reference-session.js";

const INVALID_DECLARATION = 'import type * as Gtk from "@gtkx/gi/gtk";\n' +
    "export interface AliasProps { auditWidget: Gtk.Absent; }\n";

const { apiDocs, state } = referenceSession();

describe("reference configuration updates", () => {
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
