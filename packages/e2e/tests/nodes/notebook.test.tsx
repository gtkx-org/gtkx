import type * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel, GtkNotebook, GtkNotebookPage } from "@gtkx/jsx/gtk";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { buildLabelNotebook } from "../helpers/notebook-render.js";
import { renderChildren } from "../helpers/render-children.js";

const getPageLabels = (notebook: Gtk.Notebook): string[] => {
    const labels: string[] = [];
    const nPages = notebook.getNPages();
    for (let i = 0; i < nPages; i++) {
        const child = notebook.getNthPage(i);
        const tabLabel = child ? notebook.getPage(child).tabLabel : null;
        if (tabLabel != null) labels.push(tabLabel);
    }
    return labels;
};

describe("render - Notebook (1)", () => {
    describe("GtkNotebook", () => {
        it("creates Notebook widget", async () => {
            const ref = createRef<Gtk.Notebook>();

            await render(<GtkNotebook ref={ref} />);

            expect(ref.current).not.toBeNull();
        });
    });

    describe("NotebookPage", () => {
        it("adds page with label", async () => {
            const notebookRef = createRef<Gtk.Notebook>();

            await render(
                <GtkNotebook ref={notebookRef}>
                    <GtkNotebookPage tabLabel="Tab 1">
                        <GtkLabel label="Page 1 Content" />
                    </GtkNotebookPage>
                </GtkNotebook>,
            );

            expect(notebookRef.current?.getNPages()).toBe(1);
            const labels = getPageLabels(notebookRef.current as Gtk.Notebook);
            expect(labels).toEqual(["Tab 1"]);
        });
    });
});

describe("render - Notebook (2)", () => {
    describe("page management", () => {
        it("inserts page before existing page", async () => {
            const notebookRef = createRef<Gtk.Notebook>();

            const { rerender } = await renderChildren(["First", "Last"], buildLabelNotebook(notebookRef));

            await rerender(["First", "Middle", "Last"]);

            const labels = getPageLabels(notebookRef.current as Gtk.Notebook);
            expect(labels).toEqual(["First", "Middle", "Last"]);
        });

        it("removes page", async () => {
            const notebookRef = createRef<Gtk.Notebook>();

            const { rerender } = await renderChildren(["A", "B", "C"], buildLabelNotebook(notebookRef));

            await rerender(["A", "C"]);

            const labels = getPageLabels(notebookRef.current as Gtk.Notebook);
            expect(labels).toEqual(["A", "C"]);
        });

        it("updates tab label when prop changes", async () => {
            const notebookRef = createRef<Gtk.Notebook>();

            function App({ label }: { label: string }) {
                return (
                    <GtkNotebook ref={notebookRef}>
                        <GtkNotebookPage tabLabel={label}>
                            <GtkLabel label="Content" />
                        </GtkNotebookPage>
                    </GtkNotebook>
                );
            }

            await render(<App label="Initial" />);

            expect(getPageLabels(notebookRef.current as Gtk.Notebook)).toEqual(["Initial"]);

            await render(<App label="Updated" />);

            expect(getPageLabels(notebookRef.current as Gtk.Notebook)).toEqual(["Updated"]);
        });
    });
});
