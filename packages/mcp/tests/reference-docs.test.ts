import { describe, expect, it } from "vitest";
import { callTool, isToolFailure } from "./app-session.js";
import {
    referenceSession,
    REQUEST_OPTIONS,
} from "./reference-session.js";

const { apiDocs, state } = referenceSession();

describe("gtkx_get_api_docs", () => {
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
