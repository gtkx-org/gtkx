import { describe, expect, it } from "vitest";
import { isToolFailure } from "./app-session.js";
import { referenceSession, REQUEST_OPTIONS } from "./reference-session.js";

const { listApi, readResource, searchApi, state } = referenceSession();

describe("gtkx_list_api", () => {
    it("lists the namespaces the project's bindings expose", async () => {
        const overview = await listApi();
        expect(overview).toContain("Adw");
        expect(overview).toContain("@gtkx/gi/adw");
        expect(overview).toContain("Gtk");
        expect(overview).toContain("@gtkx/gi/gtk");
        expect(overview.indexOf("| Adw |")).toBeLessThan(overview.indexOf("| Gtk |"));
    });

    it("lists the symbols of one namespace", async () => {
        const namespace = await listApi({ namespace: "Gtk" });
        expect(namespace).toContain("Button");
        expect(namespace).toContain("Orientation");
    });

    it("fails for a namespace the project does not bind", async () => {
        expect(await isToolFailure(
            state.server.client, "gtkx_list_api", { namespace: "Absent" }, REQUEST_OPTIONS,
        )).toBe(true);
    });
});

describe("gtkx_search_api", () => {
    it("finds symbols by substring, narrowed by namespace and kind", async () => {
        const matches = await searchApi({ query: "headerbar", namespace: "Gtk", kind: "class" });
        expect(matches).toContain("HeaderBar");
        expect(matches).toContain("\"kind\": \"class\"");
    });

    it("reports that nothing matched an unknown query", async () => {
        const matches = await searchApi({ query: "nosuchsymbolanywhere" });
        expect(matches).not.toContain("\"namespace\"");
    });

    it("fails when the query is missing", async () => {
        expect(await isToolFailure(state.server.client, "gtkx_search_api", {}, REQUEST_OPTIONS)).toBe(true);
    });
});

describe("the API reference resources", () => {
    it("serves the reference index and the namespace and symbol pages", async () => {
        const listed = await state.server.client.listResources();
        expect(listed.resources.map((resource) => resource.name)).toContain("gtkx-api-reference");
        expect(await readResource("gtkx://reference/index")).toContain("Gtk");
        expect(await readResource("gtkx://reference/Gtk")).toContain("Button");
        expect(await readResource("gtkx://reference/Gtk/Button")).toContain("Gtk.Button");
    });

    it("fails to read a symbol the bindings do not declare", async () => {
        await expect(readResource("gtkx://reference/Gtk/Absent")).rejects.toThrow();
    });
});
