import { loadApiReference, readBuiltinElements, resolveGirPath } from "@gtkx/codegen";
import { describe, expect, it } from "vitest";
import { createCliProject } from "./cli-project.js";

describe("generated reference output lookup", () => {
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
