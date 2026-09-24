import { loadApiReference, readBuiltinElements, resolveGirPath } from "@gtkx/codegen";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type CliProject, createCliProject, runCliOrThrow } from "./cli-project.js";
import { isolateTypeConsumer, typecheckSource } from "./type-consumer.js";

const OUTPUT = "docs/reference";
const CONFIG = 'export default { applicationId: "org.gtkx.referenceoutput",' +
    " agents: { reference: true, rules: false } };";
const page = (project: CliProject, path: string): string => readFileSync(join(project.root, OUTPUT, path), "utf8");
type ReferenceManifest = {
    namespaces: { name: string; link: string; elements: { text: string; link: string }[] }[];
};

describe("generated reference output", () => {
    it.each([
        { basePath: "/", expected: "" },
        { basePath: "/reference", expected: "/reference" },
        { basePath: "/reference/", expected: "/reference" },
        { basePath: "https://docs.example.test/reference/", expected: "https://docs.example.test/reference" },
    ])("links pages beneath $basePath", ({ basePath, expected }) => {
        using project = createCliProject({ prefix: "gtkx-reference-links-", config: CONFIG });
        runCliOrThrow(project, ["docs", "--out", OUTPUT, "--base-path", basePath]);
        const manifest = JSON.parse(page(project, "manifest.json")) as ReferenceManifest;
        const gtk = manifest.namespaces.find((namespace) => namespace.name === "Gtk");
        expect(gtk?.link).toBe(`${expected}/gtk/`);
        expect(gtk?.elements).toContainEqual({ text: "GtkButton", link: `${expected}/gtk/button` });
        expect(page(project, "gtk/index.md")).toContain(`[GtkButton](${expected}/gtk/button)`);
        expect(page(project, "gtk/button.md")).toContain(`[GtkWidget](${expected}/gtk/widget)`);
    });

    it("keeps inherited base references without presenting abstract classes as JSX components", () => {
        using project = createCliProject({ prefix: "gtkx-reference-bases-", config: CONFIG });
        runCliOrThrow(project, ["codegen"]);
        runCliOrThrow(project, ["docs", "--out", OUTPUT]);
        const manifest = JSON.parse(page(project, "manifest.json")) as ReferenceManifest;
        const gtk = manifest.namespaces.find((namespace) => namespace.name === "Gtk");
        expect(gtk?.elements).toContainEqual({ text: "GtkButton", link: "/reference/gtk/button" });
        expect(gtk?.elements).toContainEqual({ text: "GtkShortcutTrigger", link: "/reference/gtk/shortcut-trigger" });
        expect(gtk?.elements.map((element) => element.text)).not.toContain("GtkWidget");
        const base = page(project, "gtk/widget.md");
        expect(base).toContain('import type { GtkWidgetProps } from "@gtkx/jsx/gtk";');
        expect(base).toContain("### `widthRequest`");
        expect(base).not.toContain('import { GtkWidget } from "@gtkx/jsx/gtk";');
        expect(page(project, "gtk/index.md")).toContain("## Abstract bases");
        expect(page(project, "gtk/index.md")).toContain("[GtkWidget](/reference/gtk/widget)");
        expect(readFileSync(join(project.root, ".gtkx/reference/gtk/button.md"), "utf8"))
            .toContain("[GtkWidget](.gtkx/reference/gtk/widget.md)");
        expect(readFileSync(join(project.root, ".gtkx/reference/gtk/widget.md"), "utf8"))
            .toContain('import type { GtkWidgetProps } from "@gtkx/jsx/gtk";');
        isolateTypeConsumer(project);
        expect(typecheckSource(project, `import { GtkButton, GtkShortcutTrigger } from "@gtkx/jsx/gtk";
import type { GtkWidgetProps } from "@gtkx/jsx/gtk";
export const inherited = { widthRequest: 200 } satisfies GtkWidgetProps;
export const views = [<GtkButton {...inherited} />, <GtkShortcutTrigger accelerator="F5" />];
`)).toBe(0);
        expect(typecheckSource(project, `import { GtkWidget } from "@gtkx/jsx/gtk";
export const view = <GtkWidget />;
`)).not.toBe(0);
    });

    it("indexes concrete and factory elements while retaining abstract class references", async () => {
        using project = createCliProject({ prefix: "gtkx-reference-lookup-", hasStore: true });
        const builtin = await readBuiltinElements();
        const reference = loadApiReference({
            libraries: ["Adw-1"],
            girPath: resolveGirPath(undefined, project.root),
            resolveFrom: project.root,
            props: builtin.props,
            omittedProps: builtin.omittedProps,
        });
        expect(reference.lookup("GtkWidget", "element").outcome).toBe("notFound");
        const widget = reference.lookup("Gtk.Widget", "class");
        expect(widget.outcome).toBe("page");
        expect(widget).toHaveProperty("markdown", expect.not.stringContaining(
            "Also available as the `GtkWidget` JSX element",
        ));
        for (const name of ["GtkButton", "GtkShortcutTrigger"]) {
            expect(reference.lookup(name, "element")).toMatchObject({
                outcome: "page",
                symbol: { name, kind: "element" },
            });
        }
        expect(reference.symbols({ namespace: "Gtk", kinds: ["element"] }).map((symbol) => symbol.name))
            .not.toContain("GtkWidget");
    });
});
