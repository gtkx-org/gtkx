/* eslint-disable gtkx/no-library-prefix */
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { writeDocs } from "../../src/internal.js";
import { readBuiltinElements } from "../../src/react/element-config.js";

const GIR_PATH = ["/usr/share/gir-1.0"];
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const GI_STORE_DIR = join(REPO_ROOT, "node_modules", ".gtkx", "gi");
const REACT_SUBEXPORTS = ["config", "adw", "adw/config", "internal"];
const REACT_SURFACE = await readBuiltinElements(REACT_SUBEXPORTS, GI_STORE_DIR);
const workDir = mkdtempSync(join(REPO_ROOT, "node_modules", ".gtkx-docs-test-"));
const defaultOutDir = join(workDir, "default");
const defaultResult = writeDocs({ libraries: ["Gtk-4.0"], girPath: GIR_PATH, outDir: defaultOutDir });

const page = (outDir: string, path: string): string => readFileSync(join(outDir, path), "utf8");

const registerNamespaceIndexTests = (): void => {
    it("generates namespaces with Gtk first and one link per element", () => {
        expect(defaultResult.isRegenerated).toBe(true);
        const names = defaultResult.namespaces.map((namespace) => namespace.name);
        expect(names[0]).toBe("Gtk");
        expect(names).toContain("Gio");
        expect(names).toContain("GObject");
        const gtk = defaultResult.namespaces[0];
        expect(gtk?.directory).toBe("gtk");
        expect(gtk?.link).toBe("/reference/gtk/");
        expect(gtk?.elements.length).toBeGreaterThan(200);
        const button = gtk?.elements.find((element) => element.text === "GtkButton");
        expect(button?.link).toBe("/reference/gtk/button");
    });

    it("writes the root index with a namespace table", () => {
        const root = page(defaultOutDir, "index.md");
        expect(root).toContain("# Element Reference");
        expect(root).toContain("`gtkx docs`");
        expect(root).toContain("| [Gtk](/reference/gtk/) | `@gtkx/jsx/gtk` |");
    });

    it("writes a namespace index listing elements with descriptions", () => {
        const index = page(defaultOutDir, join("gtk", "index.md"));
        expect(index).toContain("# Gtk elements");
        expect(index).toContain("`@gtkx/jsx/gtk`");
        expect(index).toContain("[GtkButton](/reference/gtk/button)");
    });
};

const registerElementPageTests = (): void => {
    it("renders the element page skeleton: frontmatter, title, import, hierarchy", () => {
        const button = page(defaultOutDir, join("gtk", "button.md"));
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
        const object = page(defaultOutDir, join("gobject", "object.md"));
        expect(object).toContain("# GObject");
        expect(object).not.toContain("## Hierarchy");
    });

    it("renders props with camelCase names, mapped defaults, and interface provenance", () => {
        const button = page(defaultOutDir, join("gtk", "button.md"));
        expect(button).toContain("### `label`");
        expect(button).toContain("default `null`");
        expect(button).toContain("### `hasFrame`");
        expect(button).toContain("default `true`");
        expect(button).toContain("### `actionName`");
        expect(button).toContain("from `GtkActionable`");
    });

    it("marks construct-only and read-only props", () => {
        const widget = page(defaultOutDir, join("gtk", "widget.md"));
        expect(widget).toContain("### `cssName`");
        expect(widget).toContain("construct-only");
        expect(widget).toContain("read-only, observe with `onNotify");
    });
};

const registerSignalAndMethodTests = (): void => {
    it("renders signal handler props with exact signatures", () => {
        const button = page(defaultOutDir, join("gtk", "button.md"));
        expect(button).toContain("## Signals");
        expect(button).toContain("### `onClicked`");
        expect(button).toContain("(self: Gtk.Button) => void");
    });

    it("renders methods including promisified async pairs", () => {
        const button = page(defaultOutDir, join("gtk", "button.md"));
        expect(button).toContain("## Methods");
        expect(button).toContain("### `setLabel`");
        expect(button).toContain("setLabel(label: string): void");
        const fileDialog = page(defaultOutDir, join("gtk", "file-dialog.md"));

        expect(fileDialog).toContain(
            "open(parent: Gtk.Window | null, cancellable?: Gio.Cancellable | null): Promise<Gio.File>",
        );
    });

    it("skips regeneration while fresh and honors force", () => {
        const fresh = writeDocs({ libraries: ["Gtk-4.0"], girPath: GIR_PATH, outDir: defaultOutDir });
        expect(fresh.isRegenerated).toBe(false);
        expect(fresh.namespaces).toEqual(defaultResult.namespaces);
        const forced = writeDocs({ libraries: ["Gtk-4.0"], girPath: GIR_PATH, outDir: defaultOutDir, isForced: true });
        expect(forced.isRegenerated).toBe(true);
        expect(forced.namespaces).toEqual(defaultResult.namespaces);
    });
};

const registerElementDocTests = (): void => {
    it("documents signal handler parameters and return values", () => {
        const label = page(defaultOutDir, join("gtk", "label.md"));
        const handler = label.slice(label.indexOf("### `onActivateLink`"));
        expect(handler).toContain("**Parameters**");
        expect(handler).toContain("- `uri`: the URI that is activated");
        expect(handler).toContain("- `self`: The instance the signal was emitted on.");
        expect(handler).toContain("**Returns**");
        expect(handler).toContain("the link has been activated");
    });

    it("marks a deprecated element and its deprecated props", () => {
        const assistant = page(defaultOutDir, join("gtk", "assistant.md"));
        expect(assistant).toContain("> **Deprecated since 4.10.** This widget will be removed in GTK 5");
        const useHeaderBar = assistant.slice(assistant.indexOf("### `useHeaderBar`"));
        expect(useHeaderBar).toContain("deprecated since 4.10");
        const apply = assistant.slice(assistant.indexOf("### `onApply`"));
        expect(apply.slice(0, apply.indexOf("### `on", 1))).toContain("**Deprecated since 4.10.**");
    });

    it("demotes upstream doc headings and strips media markup", () => {
        const button = page(defaultOutDir, join("gtk", "button.md"));
        expect(button).toContain("## CSS nodes");
        expect(button).not.toContain("<picture");
        expect(button).not.toContain("<img");
    });

    it("keeps DocBook and media markup off every page", () => {
        for (const element of ["button", "window", "label", "picture", "text-view"]) {
            const rendered = page(defaultOutDir, join("gtk", `${element}.md`));
            expect(rendered).not.toContain("<picture");
            expect(rendered).not.toContain("<video");
            expect(rendered).not.toContain("<itemizedlist");
            expect(rendered).not.toContain("<listitem");
        }
    });
};

afterAll(() => {
    rmSync(workDir, { recursive: true, force: true });
});

describe("writeDocs", () => {
    registerNamespaceIndexTests();
    registerElementPageTests();
    registerSignalAndMethodTests();
    registerElementDocTests();
});

describe("writeDocs with element props", () => {
    const outDir = join(workDir, "omitted");

    const result = writeDocs({
        libraries: ["Gtk-4.0"],
        girPath: GIR_PATH,
        outDir,
        omittedProps: { GtkButton: ["child"] },
        props: {
            GtkWidget: { module: "@gtkx/react/internal", export: "GtkWidgetProps" },
            GtkHeaderBar: { module: "@gtkx/react/internal", export: "GtkHeaderBarProps" },
        },
    });

    it("leaves the omitted props out of the element page", () => {
        expect(result.isRegenerated).toBe(true);
        const button = page(outDir, join("gtk", "button.md"));
        expect(button).not.toContain("### `child`");
        expect(button).toContain("### `label`");
        expect(page(outDir, join("gtk", "frame.md"))).toContain("### `child`");
    });

    it("documents the element props GTKX adds alongside the GObject properties", () => {
        const widget = page(outDir, join("gtk", "widget.md"));
        expect(widget).toContain("### `children`");
        expect(widget).toContain("Elements attached to the element's default child slot");
        expect(widget).toContain("### `controllers`");
        expect(widget).toContain("`Gtk.EventController` elements added to the widget.");
        expect(widget).toContain("### `actionGroups`");
        const headerBar = page(outDir, join("gtk", "header-bar.md"));
        expect(headerBar).toContain("### `start`");
        expect(headerBar).toContain("Widgets packed at the start of the bar.");
        expect(headerBar).toContain("### `end`");
        expect(headerBar).toContain("Widgets packed at the end of the bar.");
    });
});

describe("writeDocs with the built-in Adwaita element config", () => {
    const outDir = join(workDir, "adw");

    const result = writeDocs({
        libraries: ["Gtk-4.0", "Adw-1"],
        girPath: GIR_PATH,
        outDir,
        props: REACT_SURFACE.props,
        omittedProps: REACT_SURFACE.omittedProps,
    });

    it("documents the slots declared in @gtkx/react/adw", () => {
        expect(result.isRegenerated).toBe(true);
        const toolbarView = page(outDir, join("adw", "toolbar-view.md"));
        expect(toolbarView).toContain("### `topBar`");
        expect(toolbarView).toContain("Widgets stacked above the content.");
        expect(toolbarView).toContain("### `bottomBar`");
        expect(toolbarView).toContain("Widgets stacked below the content.");
        expect(toolbarView).toContain("### `children`");
        expect(toolbarView).toContain("`ReactNode | null`");
        const alertDialog = page(outDir, join("adw", "alert-dialog.md"));
        expect(alertDialog).toContain("### `responses`");
        expect(alertDialog).toContain("`AlertDialogResponse[] | null`");
        expect(alertDialog).toContain("Buttons the dialog offers, added and removed as the list changes.");
    });

    it("documents the props reached through an intersected props type", () => {
        const expanderRow = page(outDir, join("adw", "expander-row.md"));
        expect(expanderRow).toContain("### `rows`");
        expect(expanderRow).toContain("Widgets added to the area the row reveals when it expands.");
        expect(expanderRow).toContain("### `prefix`");
        expect(expanderRow).toContain("Widgets added at the start of the row, before its title.");
        expect(expanderRow).toContain("### `suffix`");
    });

    it("documents the multi-layout view's slot index signature", () => {
        const multiLayoutView = page(outDir, join("adw", "multi-layout-view.md"));
        expect(multiLayoutView).toContain("### `layouts`");
        expect(multiLayoutView).toContain("`Adw.Layout` elements added to the view");
        expect(multiLayoutView).toContain("### `${string}Slot`");
        expect(multiLayoutView).toContain("so `sidebarSlot` fills the slot with id `sidebar`");
    });
});

describe("writeDocs with a custom base path", () => {
    const outDir = join(workDir, "custom");

    it("roots links at the base path", () => {
        const result = writeDocs({
            libraries: ["Gtk-4.0"],
            girPath: GIR_PATH,
            outDir,
            basePath: "/docs/elements",
        });

        expect(result.isRegenerated).toBe(true);
        const gtk = result.namespaces.find((namespace) => namespace.name === "Gtk");
        expect(gtk?.link).toBe("/docs/elements/gtk/");
        expect(existsSync(join(outDir, "manifest.json"))).toBe(true);
    });
});
