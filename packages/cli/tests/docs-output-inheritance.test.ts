import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runCliOrThrow } from "./cli-project.js";
import {
    createReferenceOutputProject,
    readReferencePage,
    REFERENCE_OUTPUT,
} from "./docs-output-fixture.js";
import { isolateTypeConsumer, typecheckSource } from "./type-consumer.js";

describe("generated reference output inheritance", () => {
    it("keeps inherited base references without presenting abstract classes as JSX components", () => {
        using project = createReferenceOutputProject("gtkx-reference-bases-");
        runCliOrThrow(project, ["codegen"]);
        runCliOrThrow(project, ["docs", "--out", REFERENCE_OUTPUT]);
        const manifest = JSON.parse(readReferencePage(project, "manifest.json")) as {
            namespaces: { name: string; elements: { text: string; link: string }[] }[];
        };
        const gtk = manifest.namespaces.find((namespace) => namespace.name === "Gtk");
        expect(gtk?.elements).toContainEqual({ text: "GtkButton", link: "/reference/gtk/button" });
        expect(gtk?.elements).toContainEqual({ text: "GtkShortcutTrigger", link: "/reference/gtk/shortcut-trigger" });
        expect(gtk?.elements.map((element) => element.text)).not.toContain("GtkWidget");
        const base = readReferencePage(project, "gtk/widget.md");
        expect(base).toContain('import type { GtkWidgetProps } from "@gtkx/jsx/gtk";');
        expect(base).toContain("### `widthRequest`");
        expect(base).not.toContain('import { GtkWidget } from "@gtkx/jsx/gtk";');
        expect(readReferencePage(project, "gtk/index.md")).toContain("## Abstract bases");
        expect(readReferencePage(project, "gtk/index.md")).toContain("[GtkWidget](/reference/gtk/widget)");
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
});
