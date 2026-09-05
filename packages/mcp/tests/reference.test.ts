import { rmSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { callText, callTool, createProject, isToolFailure, type McpServer, startServer } from "./app-session.js";

const state = { project: "", server: {} as McpServer };

const listApi = (args: Record<string, unknown> = {}): Promise<string> =>
    callText(state.server.client, "gtkx_list_api", args);

const searchApi = (args: Record<string, unknown>): Promise<string> =>
    callText(state.server.client, "gtkx_search_api", args);

const apiDocs = (args: Record<string, unknown>): Promise<string> =>
    callText(state.server.client, "gtkx_get_api_docs", args);

const readResource = async (uri: string): Promise<string> => {
    const result = await state.server.client.readResource({ uri });
    const [entry] = result.contents;

    return entry && "text" in entry ? entry.text : "";
};

beforeAll(async () => {
    state.project = createProject();
    state.server = await startServer(state.project);
}, 120_000);

afterAll(async () => {
    await state.server.stop();
    rmSync(state.project, { recursive: true, force: true });
});

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
        expect(await isToolFailure(state.server.client, "gtkx_list_api", { namespace: "Absent" })).toBe(true);
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
        expect(await isToolFailure(state.server.client, "gtkx_search_api", {})).toBe(true);
    });
});

describe("gtkx_get_api_docs", () => {
    it("documents a symbol by qualified name and by JSX element name", async () => {
        const qualified = await apiDocs({ symbol: "Adw.Toast" });
        const element = await apiDocs({ symbol: "AdwToast" });
        expect(qualified).toContain("Adw.Toast");
        expect(qualified).toContain("@gtkx/gi/adw");
        expect(element).toContain("AdwToast");
    });

    it("lists the candidates behind an ambiguous name", async () => {
        const ambiguous = await callTool(state.server.client, "gtkx_get_api_docs", { symbol: "Orientation" });
        expect(JSON.stringify(ambiguous)).toContain("Gtk.Orientation");
    });

    it("fails for a symbol the bindings do not declare", async () => {
        expect(await isToolFailure(state.server.client, "gtkx_get_api_docs", { symbol: "Gtk.Absent" })).toBe(true);
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
