import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type DocsResult, writeDocs } from "../../src/index.js";

const GIR_PATH = ["/usr/share/gir-1.0"];
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const workDir = mkdtempSync(join(REPO_ROOT, "node_modules", ".gtkx-docs-test-"));

afterAll(() => {
    rmSync(workDir, { recursive: true, force: true });
});

const page = (outDir: string, path: string): string => readFileSync(join(outDir, path), "utf8");

describe("writeDocs", () => {
    const outDir = join(workDir, "default");
    let result: DocsResult;

    beforeAll(() => {
        result = writeDocs({ libraries: ["Gtk-4.0"], girPath: GIR_PATH, outDir });
    });

    it("generates namespaces with Gtk first and one link per element", () => {
        expect(result.regenerated).toBe(true);
        const names = result.namespaces.map((namespace) => namespace.name);
        expect(names[0]).toBe("Gtk");
        expect(names).toContain("Gio");
        expect(names).toContain("GObject");
        const gtk = result.namespaces[0];
        expect(gtk?.directory).toBe("gtk");
        expect(gtk?.link).toBe("/reference/gtk/");
        expect(gtk?.elements.length).toBeGreaterThan(200);
        const button = gtk?.elements.find((element) => element.text === "GtkButton");
        expect(button?.link).toBe("/reference/gtk/button");
    });

    it("writes the root index with a namespace table", () => {
        const root = page(outDir, "index.md");
        expect(root).toContain("# Element Reference");
        expect(root).toContain("`gtkx docs`");
        expect(root).toContain("| [Gtk](/reference/gtk/) | `@gtkx/jsx/gtk` |");
    });

    it("writes a namespace index listing elements with descriptions", () => {
        const index = page(outDir, join("gtk", "index.md"));
        expect(index).toContain("# Gtk elements");
        expect(index).toContain("`@gtkx/jsx/gtk`");
        expect(index).toContain("[GtkButton](/reference/gtk/button)");
    });

    it("renders the element page skeleton: frontmatter, title, import, hierarchy", () => {
        const button = page(outDir, join("gtk", "button.md"));
        expect(button.startsWith("---\ndescription:")).toBe(true);
        expect(button).toContain("# GtkButton");
        expect(button).toContain('import { GtkButton } from "@gtkx/jsx/gtk";');
        expect(button).toContain("## Hierarchy");
        expect(button).toContain("[GtkWidget](/reference/gtk/widget)");
        expect(button).toContain("**GtkButton**");
        expect(button).toContain("Implements");
        expect(button).toContain("`GtkActionable`");
    });

    it("omits the hierarchy for classes without ancestors", () => {
        const object = page(outDir, join("gobject", "object.md"));
        expect(object).toContain("# GObject");
        expect(object).not.toContain("## Hierarchy");
    });

    it("describes children slots from the built-in container rules", () => {
        const button = page(outDir, join("gtk", "button.md"));
        expect(button).toContain("## Children");
        expect(button).toContain("`children` accepts [GtkWidget](/reference/gtk/widget) elements");
        expect(button).toContain("`setChild()`");
        const headerBar = page(outDir, join("gtk", "header-bar.md"));
        expect(headerBar).toContain("`start` is a slot accepting");
    });

    it("renders props with camelCase names, mapped defaults, and interface provenance", () => {
        const button = page(outDir, join("gtk", "button.md"));
        expect(button).toContain("### `label`");
        expect(button).toContain("default `null`");
        expect(button).toContain("### `hasFrame`");
        expect(button).toContain("default `true`");
        expect(button).toContain("### `actionName`");
        expect(button).toContain("from `GtkActionable`");
    });

    it("marks construct-only and read-only props", () => {
        const widget = page(outDir, join("gtk", "widget.md"));
        expect(widget).toContain("### `cssName`");
        expect(widget).toContain("construct-only");
        expect(widget).toContain("read-only, observe with `onNotify");
    });

    it("annotates element props backed by value and list rules", () => {
        const scale = page(outDir, join("gtk", "scale.md"));
        expect(scale).toContain("### `marks`");
        expect(scale).toContain("Array prop; items are applied with `addMark()`.");
        const drawingArea = page(outDir, join("gtk", "drawing-area.md"));
        expect(drawingArea).toContain("### `drawFunc`");
        expect(drawingArea).toContain("Applied with `setDrawFunc()`.");
    });

    it("renders signal handler props with exact signatures", () => {
        const button = page(outDir, join("gtk", "button.md"));
        expect(button).toContain("## Signals");
        expect(button).toContain("### `onClicked`");
        expect(button).toContain("(self: Gtk.Button) => void");
    });

    it("renders methods including promisified async pairs", () => {
        const button = page(outDir, join("gtk", "button.md"));
        expect(button).toContain("## Methods");
        expect(button).toContain("### `setLabel`");
        expect(button).toContain("setLabel(label: string): void");
        const fileDialog = page(outDir, join("gtk", "file-dialog.md"));
        expect(fileDialog).toContain(
            "open(parent: Gtk.Window | null, cancellable?: Gio.Cancellable | null): Promise<Gio.File>",
        );
    });

    it("demotes upstream doc headings and strips media markup", () => {
        const button = page(outDir, join("gtk", "button.md"));
        expect(button).toContain("## CSS nodes");
        expect(button).not.toContain("<picture");
        expect(button).not.toContain("<img");
    });

    it("skips regeneration while fresh and honors force", () => {
        const fresh = writeDocs({ libraries: ["Gtk-4.0"], girPath: GIR_PATH, outDir });
        expect(fresh.regenerated).toBe(false);
        expect(fresh.namespaces).toEqual(result.namespaces);
        const forced = writeDocs({ libraries: ["Gtk-4.0"], girPath: GIR_PATH, outDir, force: true });
        expect(forced.regenerated).toBe(true);
        expect(forced.namespaces).toEqual(result.namespaces);
    });
});

describe("writeDocs with user element props and a custom base path", () => {
    const outDir = join(workDir, "custom");

    it("applies user container rules and roots links at the base path", () => {
        const result = writeDocs({
            libraries: ["Gtk-4.0"],
            girPath: GIR_PATH,
            outDir,
            basePath: "/docs/elements",
            elementProps: {
                GtkFixed: [
                    {
                        kind: "container",
                        prop: "children",
                        child: "GtkWidget",
                        append: { method: "put", args: ["child", { prop: "x" }, { prop: "y" }] },
                        remove: "remove",
                    },
                ],
            },
        });
        expect(result.regenerated).toBe(true);
        const gtk = result.namespaces.find((namespace) => namespace.name === "Gtk");
        expect(gtk?.link).toBe("/docs/elements/gtk/");
        const fixed = page(outDir, join("gtk", "fixed.md"));
        expect(fixed).toContain("`children` accepts [GtkWidget](/docs/elements/gtk/widget) elements");
        expect(fixed).toContain("`put()`");
        expect(existsSync(join(outDir, "manifest.json"))).toBe(true);
    });
});
