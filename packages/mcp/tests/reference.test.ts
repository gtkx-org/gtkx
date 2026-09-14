import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
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

describe("reference configuration updates", () => {
    it.each(["gtkx.config.cjs", "gtkx.config.cts", ".config/gtkx.ts", ".config/gtkx.config.ts"])(
        "finds a project using %s from a child directory",
        async (configuration) => {
            const project = createProject();
            rmSync(join(project, "gtkx.config.mjs"));
            const path = join(project, configuration);
            mkdirSync(dirname(path), { recursive: true });
            writeFileSync(path, 'module.exports = { applicationId: "org.gtkx.reference" };\n');

            try {
                expect(await listApi({ projectRoot: join(project, "src") })).toContain("Adw");
            } finally {
                rmSync(project, { recursive: true, force: true });
            }
        },
    );

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

            await expect.poll(() => listApi({ projectRoot: project }), { timeout: 30_000 })
                .not.toContain("GtkSource");
        } finally {
            rmSync(project, { recursive: true, force: true });
        }
    }, 60_000);
});
