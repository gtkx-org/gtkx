import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { callTool, createProject, isToolFailure } from "./app-session.js";
import {
    createConfiguredProject,
    referenceSession,
    REQUEST_OPTIONS,
    writePropsConfig,
} from "./reference-session.js";

const { apiDocs, listApi, readResource, searchApi, state } = referenceSession();

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
    it("resolves relative GIR paths from the requested project instead of the server's working directory", async () => {
        const project = createProject();
        const directory = "relative-gir";
        const requestedGir = join(project, directory);
        const launchGir = join(state.project, directory);
        mkdirSync(requestedGir);
        mkdirSync(launchGir);
        const source = readFileSync(
            new URL("../../cli/tests/fixtures/gir/Documented-1.0.gir", import.meta.url),
            "utf8",
        );
        const original = "Holds a short piece of text the user jotted down.";
        const requested = "A note from the requested project.";
        writeFileSync(join(requestedGir, "Documented-1.0.gir"), source.replace(original, () => requested));
        writeFileSync(
            join(launchGir, "Documented-1.0.gir"),
            source.replace(original, "A note from the server's working directory."),
        );
        const config = {
            applicationId: "org.gtkx.reference",
            libraries: ["Documented-1.0"],
            girPath: [`./${directory}`],
        };
        writeFileSync(join(project, "gtkx.config.mjs"), `export default ${JSON.stringify(config)};\n`);

        try {
            expect(await apiDocs({ symbol: "Documented.Note", projectRoot: project })).toContain(requested);
        } finally {
            rmSync(project, { recursive: true, force: true });
            rmSync(launchGir, { recursive: true, force: true });
        }
    });

    it("reloads when a higher-priority configuration appears or is removed", async () => {
        const project = createProject();
        writeFileSync(
            join(project, "gtkx.config.mjs"),
            'export default { applicationId: "org.gtkx.reference" };\n',
        );

        try {
            const docs = (): Promise<string> => apiDocs({ symbol: "GtkButton", projectRoot: project });
            expect(await docs()).toContain("### `label`");
            const selected = join(project, "gtkx.config.ts");
            writeFileSync(
                selected,
                'export default { applicationId: "org.gtkx.reference", ' +
                'elements: { config: { GtkButton: { omittedProps: ["label"] } } } };\n',
            );

            await expect.poll(docs).not.toContain("### `label`");
            rmSync(selected);
            await expect.poll(docs).toContain("### `label`");
        } finally {
            rmSync(project, { recursive: true, force: true });
        }
    });

    it("selects a GIR that appears earlier in the configured search path", async () => {
        const project = createProject();
        const earlier = join(project, "earlier");
        const later = join(project, "later");
        mkdirSync(earlier);
        mkdirSync(later);
        const original = readFileSync(
            new URL("../../cli/tests/fixtures/gir/Documented-1.0.gir", import.meta.url),
            "utf8",
        );
        writeFileSync(join(later, "Documented-1.0.gir"), original);
        const config = {
            applicationId: "org.gtkx.reference",
            libraries: ["Documented-1.0"],
            girPath: [earlier, later],
        };
        writeFileSync(join(project, "gtkx.config.mjs"), `export default ${JSON.stringify(config)};\n`);

        try {
            const docs = (): Promise<string> => apiDocs({ symbol: "Documented.Note", projectRoot: project });
            expect(await docs()).toContain("Holds a short piece of text the user jotted down.");
            const selected = join(earlier, "Documented-1.0.gir");
            writeFileSync(
                selected,
                original.replace(
                    "Holds a short piece of text the user jotted down.",
                    "A higher priority reference was selected.",
                ),
            );

            await expect.poll(docs).toContain("A higher priority reference was selected.");
            rmSync(selected);
            await expect.poll(docs)
                .toContain("Holds a short piece of text the user jotted down.");
        } finally {
            rmSync(project, { recursive: true, force: true });
        }
    });

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

            await expect.poll(() => listApi({ projectRoot: project }))
                .not.toContain("GtkSource");
        } finally {
            rmSync(project, { recursive: true, force: true });
        }
    });
});
